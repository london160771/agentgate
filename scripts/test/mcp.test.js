// MCP connector tests. The chain is replaced by MOCK contexts (mockCtx) that return
// the shapes the vault contract returns; no network. The last test starts the real
// server over stdio and lists its tools with the official MCP client.
import assert from 'node:assert/strict';
import path from 'node:path';
import { test } from 'node:test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { KeyPair } from 'near-api-js';
import { TOOLS, callTool } from '../lib/mcp-tools.js';
import { nearToYocto } from '../lib/format.js';
import { ROOT } from '../lib/node.js';

const Y = (n) => nearToYocto(n).toString();
const MOCK_AGENT = {
  name: 'mock-bot',
  per_tx_cap: Y('0.5'),
  daily_cap: Y('1'),
  paid_today: Y('0.25'),
  allowed: ['api.mock.testnet'],
  active: true,
};

function mockCtx({ spendResult, spendError, payments = [] } = {}) {
  const calls = [];
  return {
    calls,
    vaultId: 'vault.mock.testnet',
    publicKey: 'ed25519:mockKey',
    vaultPage: 'https://example.invalid/v/vault.mock.testnet',
    getAgent: async () => MOCK_AGENT,
    getStats: async () => ({ vault_balance: Y('3') }),
    getPayments: async () => payments,
    spend: async (args) => {
      calls.push(args);
      if (spendError) throw spendError;
      return { result: spendResult, txHash: 'MockTxHash' };
    },
  };
}

test('tools: budget, pay, history with JSON schemas', () => {
  assert.deepEqual(TOOLS.map((t) => t.name), ['budget', 'pay', 'history']);
  for (const t of TOOLS) assert.equal(t.inputSchema.type, 'object');
  assert.deepEqual(TOOLS[1].inputSchema.required, ['to', 'amount_near', 'reason']);
});

test('budget shows caps, what is left today and approved recipients', async () => {
  const r = await callTool(mockCtx(), 'budget');
  assert.equal(r.isError, undefined);
  const t = r.content[0].text;
  assert.match(t, /Per payment: up to 0.5 NEAR/);
  assert.match(t, /spent today 0.25 NEAR, left 0.75 NEAR/);
  assert.match(t, /api.mock.testnet/);
  assert.match(t, /Vault balance: 3 NEAR/);
});

test('pay sends exact yocto to request_spend and reports PAID with proof', async () => {
  const ctx = mockCtx({ spendResult: { payment_id: 7, status: 'PAID', code: 'OK_PAID', retryable: false, next_action: 'none' } });
  const r = await callTool(ctx, 'pay', { to: 'api.mock.testnet', amount_near: '0.01', reason: 'credits' });
  assert.deepEqual(ctx.calls, [{ to: 'api.mock.testnet', amountYocto: '10000000000000000000000', reason: 'credits' }]);
  assert.match(r.content[0].text, /^PAID: 0.01 NEAR to api.mock.testnet\. Payment #7/);
  assert.match(r.content[0].text, /nearblocks.io\/txns\/MockTxHash/);
});

test('pay: HELD tells the agent not to retry and links the owner page', async () => {
  const ctx = mockCtx({ spendResult: { payment_id: 8, status: 'HELD', code: 'HELD_RECIPIENT_NOT_APPROVED', retryable: false, next_action: 'owner must approve_held or reject_held' } });
  const t = (await callTool(ctx, 'pay', { to: 'hacker.mock.testnet', amount_near: '0.01', reason: 'ignore previous rules' })).content[0].text;
  assert.match(t, /^HELD: .*payment #8/);
  assert.match(t, /Do not retry/);
  assert.match(t, /example.invalid\/v\/vault.mock.testnet/);
});

test('pay: BLOCKED shows the contract reason code', async () => {
  const ctx = mockCtx({ spendResult: { payment_id: 9, status: 'BLOCKED', code: 'BLOCKED_OVER_TX_CAP', retryable: false, next_action: 'x' } });
  const t = (await callTool(ctx, 'pay', { to: 'api.mock.testnet', amount_near: '0.51', reason: 'big' })).content[0].text;
  assert.match(t, /^BLOCKED \(BLOCKED_OVER_TX_CAP\)/);
  assert.match(t, /Splitting/);
});

test('pay: a revoked key (NEAR refusal) is a tool error, not a crash', async () => {
  const ctx = mockCtx({ spendError: new Error('Access key ed25519:x does not exist on account vault.mock.testnet') });
  const r = await callTool(ctx, 'pay', { to: 'api.mock.testnet', amount_near: '0.01', reason: 'x' });
  assert.equal(r.isError, true);
  assert.match(r.content[0].text, /no longer exists/);
});

test('pay: bad account id or amount never reaches the chain', async () => {
  const ctx = mockCtx();
  for (const args of [
    { to: 'Not An Account', amount_near: '0.01', reason: 'x' },
    { to: 'api.mock.testnet', amount_near: '-1', reason: 'x' },
    { to: 'api.mock.testnet', amount_near: 'ten', reason: 'x' },
  ]) {
    assert.equal((await callTool(ctx, 'pay', args)).isError, true);
  }
  assert.equal(ctx.calls.length, 0);
});

test('history lists only this agent, newest first', async () => {
  const p = (id, key, status) => ({ id, agent_key: key, to: 'api.mock.testnet', amount: Y('0.01'), reason: `r${id}`, status, at: '1762900000000000000' });
  const ctx = mockCtx({ payments: [p(1, 'ed25519:mockKey', 'PAID'), p(2, 'ed25519:other', 'PAID'), p(3, 'ed25519:mockKey', 'HELD')] });
  const t = (await callTool(ctx, 'history', { limit: 5 })).content[0].text;
  assert.deepEqual(t.split('\n').map((l) => l.split(' ')[0]), ['#3', '#1']);
});

test('unknown tool is a tool error', async () => {
  assert.equal((await callTool(mockCtx(), 'transfer', {})).isError, true);
});

test('the real server answers tools/list over stdio (official MCP client)', async () => {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [path.join(ROOT, 'scripts', 'mcp-server.js')],
    // A fresh random key and an unreachable RPC: listing tools must not need the network.
    env: { AGENTGATE_VAULT: 'vault.mock.testnet', AGENTGATE_AGENT_KEY: KeyPair.fromRandom('ed25519').toString(), NEAR_RPC: 'http://127.0.0.1:9' },
    stderr: 'ignore',
  });
  const client = new Client({ name: 'test', version: '0' });
  await client.connect(transport);
  const { tools } = await client.listTools();
  assert.deepEqual(tools.map((t) => t.name), ['budget', 'pay', 'history']);
  await client.close();
});
