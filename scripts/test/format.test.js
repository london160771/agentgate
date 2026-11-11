import assert from 'node:assert/strict';
import { test } from 'node:test';
import { formatNear, nearToYocto, shortKey, txLink, yoctoToNear } from '../lib/format.js';

test('nearToYocto converts exactly, no float error', () => {
  assert.equal(nearToYocto('1'), 10n ** 24n);
  assert.equal(nearToYocto('0.1'), 10n ** 23n);
  assert.equal(nearToYocto('0.5'), 5n * 10n ** 23n);
  assert.equal(nearToYocto('0.000000000000000000000001'), 1n);
  assert.equal(nearToYocto('5'), 5n * 10n ** 24n);
  assert.equal(nearToYocto(' 2.25 '), 225n * 10n ** 22n);
});

test('nearToYocto rejects bad input', () => {
  for (const bad of ['', 'abc', '-1', '1e3', '1.2.3', '0.0000000000000000000000001']) {
    assert.throws(() => nearToYocto(bad), /Invalid NEAR amount|Too many decimals/, bad);
  }
});

test('yoctoToNear trims zeros and round-trips', () => {
  assert.equal(yoctoToNear('600000000000000000000000'), '0.6');
  assert.equal(yoctoToNear(10n ** 24n), '1');
  assert.equal(yoctoToNear('0'), '0');
  assert.equal(yoctoToNear('1'), '0.000000000000000000000001');
  for (const n of ['0.01', '0.25', '5', '123.456']) assert.equal(yoctoToNear(nearToYocto(n)), n);
});

test('formatNear cuts to 4 decimals', () => {
  assert.equal(formatNear('123456789000000000000000'), '0.1234 NEAR');
  assert.equal(formatNear(nearToYocto('5')), '5 NEAR');
});

test('shortKey and txLink', () => {
  assert.equal(shortKey('ed25519:ABCDEFGHIJKLMNOPQRSTUVWXYZ'), 'ed25519:ABCDEF…UVWXYZ');
  assert.equal(shortKey('ed25519:short'), 'ed25519:short');
  assert.equal(txLink('Hash1'), 'https://testnet.nearblocks.io/txns/Hash1');
});
