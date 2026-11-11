import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { agentRules, isAccountId, resolveConfig, validateConfig } from '../lib/config.js';
import { ROOT, readRawConfig } from '../lib/node.js';

// The template as shipped (before Adesope set the owner), built from the real config.
const PLACEHOLDER_KEYS = { apiBuyerPublicKey: '<filled after seeding>', apiBuyerPrivateKey: '<filled after seeding>', oldBotPublicKey: '<filled after seeding>', oldBotPrivateKey: '<filled after seeding>' };
const template = () => ({ ...readRawConfig(), ownerAccountId: '<set by Adesope>', demoKeys: { ...PLACEHOLDER_KEYS } });
const withOwner = (owner = 'ade.testnet') => ({ ...template(), ownerAccountId: owner });

test('the committed config/seed.json is valid', () => {
  assert.deepEqual(validateConfig(template(), 'template'), []);
  const raw = readRawConfig();
  if (!raw.ownerAccountId.includes('<')) assert.deepEqual(validateConfig(raw, 'owner'), []);
  if (!raw.demoKeys.apiBuyerPublicKey.includes('<')) assert.deepEqual(validateConfig(raw, 'seeded'), []);
});

test('owner stage needs ownerAccountId', () => {
  const errors = validateConfig(template(), 'owner');
  assert.ok(errors.some((e) => e.includes('ownerAccountId is not set')));
  assert.deepEqual(validateConfig(withOwner(), 'owner'), []);
});

test('seeded stage needs the demo keys', () => {
  const errors = validateConfig(withOwner(), 'seeded');
  assert.equal(errors.filter((e) => e.startsWith('demoKeys.')).length, 4);
  const seeded = withOwner();
  seeded.demoKeys = { apiBuyerPublicKey: 'ed25519:a', apiBuyerPrivateKey: 'ed25519:b', oldBotPublicKey: 'ed25519:c', oldBotPrivateKey: 'ed25519:d' };
  assert.deepEqual(validateConfig(seeded, 'seeded'), []);
});

test('bad values are reported', () => {
  const c = withOwner('Bad Owner');
  c.network = 'mainnet';
  c.agents.apiBuyer.perTxCapNear = 'lots';
  c.agents.apiBuyer.allowed = ['apiProvider', 'hacker', 'nobody'];
  const errors = validateConfig(c, 'owner').join('\n');
  assert.match(errors, /network must be "testnet"/);
  assert.match(errors, /perTxCapNear/);
  assert.match(errors, /unknown recipient "nobody"/);
  assert.match(errors, /must not include hacker/);
  assert.match(errors, /not a valid account id/);
});

test('resolveConfig fills <owner> from ownerAccountId only', () => {
  const c = resolveConfig(withOwner('ade.testnet'));
  assert.equal(c.vaultAccountId, 'vault.ade.testnet');
  assert.deepEqual(c.recipients, {
    apiProvider: 'api-provider.ade.testnet',
    dataProvider: 'data-provider.ade.testnet',
    hacker: 'hacker.ade.testnet',
  });
  // template stays a template (dry-run)
  assert.equal(resolveConfig(template()).vaultAccountId, 'vault.<owner>.testnet');
});

test('agentRules reads caps from the config in yocto', () => {
  const raw = template();
  const r = agentRules(resolveConfig(withOwner()), 'apiBuyer');
  const yocto = (near) => (BigInt(Math.round(Number(near) * 1e6)) * 10n ** 18n).toString();
  assert.equal(r.perTxCap, yocto(raw.agents.apiBuyer.perTxCapNear));
  assert.equal(r.dailyCap, yocto(raw.agents.apiBuyer.dailyCapNear));
  assert.equal(r.allowance, yocto(raw.agents.apiBuyer.keyAllowanceNear));
  assert.deepEqual(r.allowed, ['api-provider.ade.testnet', 'data-provider.ade.testnet']);
  // old-bot has no own rules: it borrows api-buyer's and keeps its own name
  const old = agentRules(resolveConfig(withOwner()), 'oldBot');
  assert.equal(old.name, raw.agents.oldBot.name);
  assert.equal(old.perTxCap, r.perTxCap);
});

test('isAccountId', () => {
  assert.ok(isAccountId('vault.ade.testnet'));
  assert.ok(isAccountId('api-provider.ade.testnet'));
  assert.ok(!isAccountId('Vault.testnet'));
  assert.ok(!isAccountId('a'));
});

test('contract constants match holdQueueMax and logMax in config/seed.json', () => {
  const src = fs.readFileSync(path.join(ROOT, 'contract', 'src', 'lib.rs'), 'utf8');
  const constant = (name) => Number(src.match(new RegExp(`pub const ${name}: \\w+ = (\\d+);`))[1]);
  const raw = template();
  assert.equal(constant('HOLD_QUEUE_MAX'), raw.holdQueueMax);
  assert.equal(constant('LOG_MAX'), raw.logMax);
});
