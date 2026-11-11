// Attack Lab runner with a MOCKED RPC object (unit test only; real runs hit testnet).
import { describe, expect, it } from 'vitest';
import {
  AccessKeyDoesNotExistError,
  AccessKeyMethodNameMismatchActionError,
  AccessKeyRequiresFullAccessActionError,
} from 'near-api-js/rpc-errors';
import { agentRules } from '../../../scripts/lib/config.js';
import { ALL_IDS, proofs, runAttacks } from '../lib/judge.js';
import { cfg } from '../lib/near.js';

/** MOCK chain context: a vault that follows the PRD rules, with caps from config/seed.json. */
function mockCtx() {
  const rules = agentRules(cfg, 'apiBuyer');
  const state = { paid: 0n, n: 0 };
  const res = (status, code) => ({ result: { payment_id: state.n++, status, code }, txHash: `MOCKTX${state.n}` });
  return {
    cfg,
    async spend({ key, to, amountYocto }) {
      if (key === 'oldBot') throw new AccessKeyDoesNotExistError('ed25519:old', 'b', 1);
      const amount = BigInt(amountYocto);
      if (!rules.allowed.includes(to)) return res('HELD', 'HELD_RECIPIENT_NOT_APPROVED');
      if (amount > BigInt(rules.perTxCap)) return res('BLOCKED', 'BLOCKED_OVER_TX_CAP');
      if (state.paid + amount > BigInt(rules.dailyCap)) return res('BLOCKED', 'BLOCKED_OVER_DAILY_CAP');
      state.paid += amount;
      return res('PAID', 'OK_PAID');
    },
    async transfer() {
      throw new AccessKeyRequiresFullAccessActionError(null, '', '');
    },
    async call({ method }) {
      throw new AccessKeyMethodNameMismatchActionError(method, null, '', '');
    },
    async getAgent() {
      return { paid_today: state.paid.toString(), daily_cap: rules.dailyCap };
    },
  };
}

describe('Attack Lab runner (mock RPC)', () => {
  it('runs J1–J7 in order, reports rows and the live meter', async () => {
    const started = [];
    const meters = [];
    const rows = await runAttacks(ALL_IDS, mockCtx(), { onStart: (id) => started.push(id), onMeter: (m) => meters.push(m) });
    expect(started).toEqual(['J1', 'J2', 'J3', 'J4', 'J5', 'J6', 'J7']);
    expect(rows.every((r) => r.pass)).toBe(true);
    expect(meters).toHaveLength(7);
    const last = meters.at(-1);
    expect(BigInt(last.paidToday) <= BigInt(last.dailyCap)).toBe(true);
  });

  it('gives tx links for vault decisions and raw NEAR text for refusals', async () => {
    const [j1, j5] = await runAttacks(['J1', 'J5'], mockCtx());
    expect(proofs(j1)[0]).toMatchObject({ kind: 'tx', href: 'https://testnet.nearblocks.io/txns/MOCKTX1' });
    expect(proofs(j5)[0]).toEqual({ kind: 'raw', text: 'AccessKeyRequiresFullAccessActionError: Access key requires full access' });
  });

  it('keeps going and shows an error row when the RPC is down', async () => {
    const ctx = { ...mockCtx(), spend: () => Promise.reject(new Error('Failed to fetch')), getAgent: () => Promise.reject(new Error('Failed to fetch')) };
    const meters = [];
    const rows = await runAttacks(['J1', 'J3'], ctx, { onMeter: (m) => meters.push(m) });
    expect(rows.map((r) => r.actual)).toEqual(['ERROR', 'ERROR']);
    expect(rows.every((r) => !r.pass)).toBe(true);
    expect(meters[0].error.message).toBe('Failed to fetch');
  });
});
