// Unit tests for the multi-user helpers. No wallet, no network.
import { describe, expect, it } from 'vitest';
import { actionCreators } from '@near-wallet-selector/core';
import { addAgentArgs, agentSnippet, mcpSnippet, createdFromOutcome, createVaultAction, GAS_CREATE_VAULT, parseRecipients, validVaultName, vaultIdFor } from '../lib/factory.js';

describe('validVaultName (same rules as the factory contract)', () => {
  it('accepts simple lowercase names', () => {
    for (const n of ['alice', 'my-vault', 'a1', 'team_42', 'x-y_z']) expect(validVaultName(n)).toBe(true);
  });
  it('rejects the names the contract rejects', () => {
    for (const n of ['', 'a', 'Alice', 'my.vault', '-alice', 'alice-', 'a--b', 'a_-b', 'has space', 'a'.repeat(33)]) expect(validVaultName(n)).toBe(false);
  });
  it('builds the vault account id', () => {
    expect(vaultIdFor('alice', 'factory.ade.testnet')).toBe('alice.factory.ade.testnet');
  });
});

describe('createVaultAction', () => {
  it('calls create_vault with the deposit and enough gas', () => {
    const a = createVaultAction(actionCreators.functionCall, 'alice', '2700000000000000000000000');
    expect(a.functionCall.methodName).toBe('create_vault');
    expect(JSON.parse(Buffer.from(a.functionCall.args).toString())).toEqual({ name: 'alice' });
    expect(a.functionCall.deposit).toBe(2_700_000_000_000_000_000_000_000n);
    expect(a.functionCall.gas).toBe(GAS_CREATE_VAULT);
  });
  it('refuses a bad name before opening the wallet', () => {
    expect(() => createVaultAction(actionCreators.functionCall, 'Bad.Name', '1')).toThrow(/Vault name/);
  });
});

describe('parseRecipients', () => {
  it('splits, trims, lowercases and dedupes', () => {
    expect(parseRecipients(' a.testnet,b.testnet\nA.testnet  ').list).toEqual(['a.testnet', 'b.testnet']);
  });
  it('flags bad ids, empty lists and more than 10', () => {
    expect(parseRecipients('').problems.length).toBe(1);
    expect(parseRecipients('not an id!').problems.join()).toMatch(/not a NEAR account id/);
    const many = Array.from({ length: 11 }, (_, i) => `r${i}.testnet`).join(',');
    expect(parseRecipients(many).problems.join()).toMatch(/At most 10/);
  });
});

describe('addAgentArgs', () => {
  const base = { publicKey: 'ed25519:abc', name: 'shopper', perTxNear: '0.5', dailyNear: '1', recipients: 'shop.testnet', allowanceNear: '0.25' };
  it('converts NEAR to yocto strings for the contract', () => {
    const { args, problems } = addAgentArgs(base);
    expect(problems).toEqual([]);
    expect(args).toEqual({ public_key: 'ed25519:abc', name: 'shopper', per_tx_cap: '500000000000000000000000', daily_cap: '1000000000000000000000000', allowed: ['shop.testnet'], allowance: '250000000000000000000000' });
  });
  it('catches the common mistakes', () => {
    expect(addAgentArgs({ ...base, name: ' ' }).problems.join()).toMatch(/name/);
    expect(addAgentArgs({ ...base, perTxNear: '0' }).problems.join()).toMatch(/Per-payment cap must be more than 0/);
    expect(addAgentArgs({ ...base, dailyNear: 'abc' }).problems.join()).toMatch(/Daily cap is not a NEAR amount/);
    expect(addAgentArgs({ ...base, perTxNear: '2' }).problems.join()).toMatch(/can’t be bigger than the daily cap/);
  });
});

describe('agentSnippet', () => {
  it('names the vault and key and only calls request_spend', () => {
    const s = agentSnippet({ vaultId: 'alice.factory.ade.testnet', privateKey: 'ed25519:SECRET' });
    expect(s).toContain('AGENTGATE_VAULT=alice.factory.ade.testnet');
    expect(s).toContain('AGENTGATE_AGENT_KEY=ed25519:SECRET');
    expect(s).toContain("methodName: 'request_spend'");
  });
});

describe('mcpSnippet', () => {
  it('gives Claude Code and JSON config with the vault and key', () => {
    const s = mcpSnippet({ vaultId: 'alice.factory.ade.testnet', privateKey: 'ed25519:SECRET' });
    expect(s).toContain('claude mcp add agentgate -e AGENTGATE_VAULT=alice.factory.ade.testnet -e AGENTGATE_AGENT_KEY=ed25519:SECRET -- npx -y github:london160771/agentgate');
    const json = JSON.parse(s.slice(s.indexOf('{')));
    expect(json.mcpServers.agentgate.env).toEqual({ AGENTGATE_VAULT: 'alice.factory.ade.testnet', AGENTGATE_AGENT_KEY: 'ed25519:SECRET' });
  });
});

describe('createdFromOutcome (mock outcomes, unit test only)', () => {
  const enc = (v) => ({ status: { SuccessValue: Buffer.from(JSON.stringify(v)).toString('base64') } });
  it('reads the callback bool', () => {
    expect(createdFromOutcome(enc(true))).toBe(true);
    expect(createdFromOutcome(enc(false))).toBe(false);
    expect(createdFromOutcome({ status: { Failure: {} } })).toBe(null);
  });
});
