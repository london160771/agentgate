// Unit tests for the vault-lock helpers (P1-b). Key lists below are shaped like
// the real view_access_key_list in evidence/gate0.json; they are test data, not chain reads.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { deleteOrder, lockProblems, lockStatus } from '../lib/lock.js';

const VAULT = 'vault.ade.testnet';
const cfg = { vaultAccountId: VAULT, ownerAccountId: 'ade.testnet', demoKeys: { apiBuyerPublicKey: 'ed25519:buyer' } };
const fc = (pk, receiver = VAULT, methods = ['request_spend']) => ({
  public_key: pk,
  access_key: { nonce: 1, permission: { FunctionCall: { allowance: '1', receiver_id: receiver, method_names: methods } } },
});
const full = (pk) => ({ public_key: pk, access_key: { nonce: 1, permission: 'FullAccess' } });
const unlocked = { keys: [fc('ed25519:buyer'), full('ed25519:vaultkey')] };
const locked = { keys: [fc('ed25519:buyer')] };

test('lockStatus splits full-access and function-call keys', () => {
  assert.deepEqual(lockStatus(unlocked).fullAccess, ['ed25519:vaultkey']);
  assert.equal(lockStatus(unlocked).locked, false);
  assert.equal(lockStatus(locked).locked, true);
  assert.equal(lockStatus(locked).functionCall[0].permission.method_names[0], 'request_spend');
  assert.equal(lockStatus(undefined).locked, true);
});

test('lockProblems: a healthy vault can be locked', () => {
  assert.deepEqual(lockProblems({ status: lockStatus(unlocked), owner: 'ade.testnet', cfg, signerPublicKey: 'ed25519:vaultkey' }), []);
});

test('lockProblems refuses unsafe or pointless locks', () => {
  const p = (over) => lockProblems({ status: lockStatus(unlocked), owner: 'ade.testnet', cfg, signerPublicKey: 'ed25519:vaultkey', ...over }).join('\n');
  assert.match(p({ status: lockStatus(locked) }), /already locked/);
  assert.match(p({ owner: VAULT }), /owner methods would be impossible/);
  assert.match(p({ owner: 'eve.testnet' }), /config\/seed.json says ade.testnet/);
  assert.match(p({ owner: null }), /could not read get_owner/);
  assert.match(p({ signerPublicKey: 'ed25519:other' }), /not a full-access key/);
  assert.match(p({ status: lockStatus({ keys: [full('ed25519:vaultkey')] }) }), /api-buyer agent key is not on the vault/);
  assert.match(p({ status: lockStatus({ keys: [fc('ed25519:buyer', VAULT, ['request_spend', 'update_rules']), full('ed25519:vaultkey')] }) }), /not limited to request_spend/);
});

test('deleteOrder puts the signing key last', () => {
  assert.deepEqual(deleteOrder(['ed25519:me', 'ed25519:a', 'ed25519:b'], 'ed25519:me'), ['ed25519:a', 'ed25519:b', 'ed25519:me']);
});
