// Attack-runner logic with a MOCK chain context (unit tests only, no network).
// The mock imitates a vault with the config's caps so the runner's pass/fail
// rules can be checked. Real results come from scripts/attacks.js on testnet.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  AccessKeyDoesNotExistError,
  AccessKeyMethodNameMismatchActionError,
  AccessKeyRequiresFullAccessActionError,
} from 'near-api-js/rpc-errors';
import { ATTACKS, describeStep, getAttack, runAll, runAttack, summarize } from '../lib/attacks.js';
import { agentRules, resolveConfig } from '../lib/config.js';
import { readRawConfig } from '../lib/node.js';

function cfg() {
  const raw = readRawConfig();
  raw.ownerAccountId = 'ade.testnet';
  raw.demoKeys = { apiBuyerPublicKey: 'ed25519:buyer', apiBuyerPrivateKey: 'x', oldBotPublicKey: 'ed25519:old', oldBotPrivateKey: 'y' };
  return resolveConfig(raw);
}

/** MOCK vault that follows the PRD 6.3 rules for the api-buyer agent. */
function mockCtx({ paidToday = 0n, heldCount = 0, brokenVault = false } = {}) {
  const c = cfg();
  const rules = agentRules(c, 'apiBuyer');
  const state = { paidToday, held: heldCount, n: 0 };
  const result = (status, code) => ({ result: { payment_id: state.n++, status, code, retryable: false, next_action: 'none' }, txHash: `tx${state.n}` });
  return {
    cfg: c,
    state,
    async spend({ key, to, amountYocto }) {
      if (key === 'oldBot') throw new AccessKeyDoesNotExistError('ed25519:old', 'b', 1);
      const amount = BigInt(amountYocto);
      if (brokenVault) {
        state.paidToday += amount;
        return result('PAID', 'OK_PAID');
      }
      if (!rules.allowed.includes(to)) {
        if (state.held >= c.holdQueueMax) return result('BLOCKED', 'BLOCKED_HOLD_QUEUE_FULL');
        state.held++;
        return result('HELD', 'HELD_RECIPIENT_NOT_APPROVED');
      }
      if (amount > BigInt(rules.perTxCap)) return result('BLOCKED', 'BLOCKED_OVER_TX_CAP');
      if (state.paidToday + amount > BigInt(rules.dailyCap)) return result('BLOCKED', 'BLOCKED_OVER_DAILY_CAP');
      state.paidToday += amount;
      return result('PAID', 'OK_PAID');
    },
    async transfer() {
      throw new AccessKeyRequiresFullAccessActionError(0, 'txT', 'b');
    },
    async call({ method }) {
      throw new AccessKeyMethodNameMismatchActionError(method, 0, 'txC', 'b');
    },
    async getAgent() {
      return { paid_today: state.paidToday.toString(), daily_cap: rules.dailyCap };
    },
  };
}

test('there are 7 attacks J1–J7 with plans', () => {
  assert.deepEqual(ATTACKS.map((a) => a.id), ['J1', 'J2', 'J3', 'J4', 'J5', 'J6', 'J7']);
  for (const a of ATTACKS) assert.ok(a.steps(cfg()).map(describeStep).every((s) => s.length > 10));
  assert.equal(getAttack('J4').steps(cfg()).length, 5);
  assert.throws(() => getAttack('J9'));
});

test('all attacks refused as expected against a vault that follows the rules (mock)', async () => {
  const ctx = mockCtx();
  const seen = [];
  const rows = await runAll(ctx, (r) => seen.push(r.id));
  assert.equal(seen.length, 7);
  for (const r of rows) assert.ok(r.pass, `${r.id}: ${r.actual}`);
  const byId = Object.fromEntries(rows.map((r) => [r.id, r]));
  assert.equal(byId.J1.actual, 'PAID');
  assert.equal(byId.J2.actual, 'HELD');
  assert.equal(byId.J3.actual, 'BLOCKED_OVER_TX_CAP');
  // 0.01 (J1) + 0.5 paid, then 4 blocked by the 0.6 daily cap
  assert.equal(byId.J4.actual, 'PAID ×1, BLOCKED_OVER_DAILY_CAP ×4');
  assert.match(byId.J4.note, /today's total 0\.51 NEAR ≤ daily cap 0\.6 NEAR/);
  assert.equal(byId.J5.actual, 'REFUSED_BY_NEAR: TRANSFER_NOT_ALLOWED');
  assert.equal(byId.J6.actual, 'REFUSED_BY_NEAR: METHOD_NOT_ALLOWED');
  assert.equal(byId.J7.actual, 'REFUSED_BY_NEAR: KEY_NOT_FOUND');
  assert.equal(byId.J5.steps[0].txHash, 'txT');
  assert.equal(byId.J5.steps[0].error.name, 'AccessKeyRequiresFullAccessActionError');
});

test('J1 still passes when today’s cap is used (proves the cap)', async () => {
  const row = await runAttack(getAttack('J1'), mockCtx({ paidToday: 6n * 10n ** 23n }));
  assert.equal(row.actual, 'BLOCKED_OVER_DAILY_CAP');
  assert.ok(row.pass);
});

test('J2 passes with a full hold queue', async () => {
  const row = await runAttack(getAttack('J2'), mockCtx({ heldCount: 20 }));
  assert.equal(row.actual, 'BLOCKED_HOLD_QUEUE_FULL');
  assert.ok(row.pass);
});

test('a broken vault that pays everything fails J2, J3 and J4 (mock)', async () => {
  const ctx = mockCtx({ brokenVault: true });
  for (const id of ['J2', 'J3', 'J4']) {
    const row = await runAttack(getAttack(id), ctx);
    assert.equal(row.pass, false, id);
  }
});

test('a transfer or call that succeeds is reported, never hidden', async () => {
  const ctx = { ...mockCtx(), transfer: async () => ({ txHash: 'oops' }), call: async () => ({ result: null, txHash: 'oops2' }) };
  const j5 = await runAttack(getAttack('J5'), ctx);
  assert.equal(j5.pass, false);
  assert.equal(j5.steps[0].code, 'TRANSFER_SUCCEEDED');
  const j6 = await runAttack(getAttack('J6'), ctx);
  assert.equal(j6.steps[0].code, 'CALL_SUCCEEDED');
});

test('network errors become ERROR rows with the raw message', async () => {
  const ctx = { ...mockCtx(), spend: async () => Promise.reject(new Error('fetch failed')) };
  const row = await runAttack(getAttack('J3'), ctx);
  assert.equal(row.actual, 'ERROR');
  assert.equal(row.steps[0].message, 'fetch failed');
  assert.equal(row.pass, false);
});

test('summarize', () => {
  assert.equal(summarize([{ label: 'PAID' }]), 'PAID');
  assert.equal(summarize([{ label: 'PAID' }, { label: 'X' }, { label: 'X' }]), 'PAID ×1, X ×2');
});
