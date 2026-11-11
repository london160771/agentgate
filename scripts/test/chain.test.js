// Offline checks that lib/chain.js wires near-api-js 7 correctly (no network calls).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { KeyPair } from 'near-api-js';
import { makeAccount, makeAttackCtx, makeProvider, txHashOf } from '../lib/chain.js';
import { resolveConfig } from '../lib/config.js';
import { readRawConfig } from '../lib/node.js';

test('makeAccount signs as the vault with a function-call key pair', async () => {
  const kp = KeyPair.fromRandom('ed25519');
  const account = makeAccount('vault.ade.testnet', kp.toString(), makeProvider('http://127.0.0.1:9'));
  assert.equal(account.accountId, 'vault.ade.testnet');
  assert.equal(typeof account.callFunctionRaw, 'function');
  assert.equal(typeof account.transfer, 'function');
  assert.equal((await account.getSigner().getPublicKey()).toString(), kp.getPublicKey().toString());
});

test('makeAttackCtx exposes the runner interface', () => {
  const raw = readRawConfig();
  raw.ownerAccountId = 'ade.testnet';
  const a = KeyPair.fromRandom('ed25519');
  const b = KeyPair.fromRandom('ed25519');
  raw.demoKeys = { apiBuyerPublicKey: a.getPublicKey().toString(), apiBuyerPrivateKey: a.toString(), oldBotPublicKey: b.getPublicKey().toString(), oldBotPrivateKey: b.toString() };
  const ctx = makeAttackCtx(resolveConfig(raw), makeProvider('http://127.0.0.1:9'));
  for (const fn of ['spend', 'transfer', 'call', 'getAgent']) assert.equal(typeof ctx[fn], 'function');
});

test('txHashOf reads the hash from an RPC outcome', () => {
  assert.equal(txHashOf({ transaction: { hash: 'H1' } }), 'H1');
  assert.equal(txHashOf({ transaction_outcome: { id: 'H2' } }), 'H2');
  assert.equal(txHashOf(undefined), undefined);
});
