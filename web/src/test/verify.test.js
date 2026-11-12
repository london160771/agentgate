// verifyChecks over MOCK RPC reads (shapes copied from real testnet answers). No network.
import { describe, expect, it } from 'vitest';
import { allPassed, verifyChecks } from '../lib/verify.js';

const VAULT = 'alice.agentgate.testnet';
const FACTORY = 'agentgate.testnet';
const fc = (pk, receiver = VAULT, methods = ['request_spend']) => ({
  public_key: pk,
  access_key: { nonce: 1, permission: { FunctionCall: { allowance: '1', receiver_id: receiver, method_names: methods } } },
});
const full = (pk) => ({ public_key: pk, access_key: { nonce: 1, permission: 'FullAccess' } });
const base = {
  vaultId: VAULT,
  keys: { keys: [fc('ed25519:agent1')] },
  account: { code_hash: 'HASH_A' },
  factoryId: FACTORY,
  factoryInfo: { code_hash: 'HASH_A' },
  factoryVaults: [VAULT],
  owner: 'alice.testnet',
};
const byId = (checks) => Object.fromEntries(checks.map((c) => [c.id, c.ok]));

describe('verifyChecks (mock reads)', () => {
  it('passes a locked factory vault with only request_spend keys and the factory code', () => {
    const c = verifyChecks(base);
    expect(byId(c)).toEqual({ 'no-full-access': true, 'agent-keys': true, 'code-hash': true, 'factory-record': true });
    expect(allPassed(c)).toBe(true);
  });
  it('fails on a full-access key', () => {
    const c = verifyChecks({ ...base, keys: { keys: [full('ed25519:owner'), fc('ed25519:agent1')] } });
    expect(byId(c)['no-full-access']).toBe(false);
    expect(allPassed(c)).toBe(false);
  });
  it('fails on a key that can call other methods or another contract', () => {
    expect(byId(verifyChecks({ ...base, keys: { keys: [fc('ed25519:k', VAULT, ['request_spend', 'add_agent'])] } }))['agent-keys']).toBe(false);
    expect(byId(verifyChecks({ ...base, keys: { keys: [fc('ed25519:k', 'other.testnet')] } }))['agent-keys']).toBe(false);
  });
  it('fails when the code hash differs from the factory', () => {
    expect(byId(verifyChecks({ ...base, account: { code_hash: 'HASH_B' } }))['code-hash']).toBe(false);
  });
  it('fails when the factory has no record of it', () => {
    expect(byId(verifyChecks({ ...base, factoryVaults: [] }))['factory-record']).toBe(false);
  });
  it('a vault deployed directly gets info, not a fail, for the code check', () => {
    const c = verifyChecks({ ...base, vaultId: 'vault.alice.testnet', keys: { keys: [fc('ed25519:k', 'vault.alice.testnet')] }, factoryInfo: null, factoryVaults: null });
    expect(byId(c)).toEqual({ 'no-full-access': true, 'agent-keys': true, 'code-hash': null });
    expect(allPassed(c)).toBe(true);
  });
});
