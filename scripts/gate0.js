#!/usr/bin/env node
// Gate 0: proves the premise on testnet (PRD 7).
//   (a) the minted api-buyer key calls request_spend      → OK_PAID
//   (b) the same key signs a direct Transfer               → NEAR refuses (TRANSFER_NOT_ALLOWED)
//   (c) the same key calls update_rules                    → NEAR refuses (METHOD_NOT_ALLOWED)
//   (d) the revoked old-bot key calls request_spend        → NEAR refuses (KEY_NOT_FOUND)
// Also records the vault's access-key list (the minted key's real permission).
// Writes evidence/gate0.json with the raw errors so the classifier can be checked.
// Usage: node scripts/gate0.js [--dry-run]

import { Account } from 'near-api-js';
import { describeStep, getAttack, runAttack } from './lib/attacks.js';
import { makeAttackCtx, makeProvider } from './lib/chain.js';
import { txLink } from './lib/format.js';
import { dryRunBanner, heading, loadConfig, parseArgs, writeEvidence } from './lib/node.js';

const { dryRun } = parseArgs();
const { cfg } = loadConfig({ stage: 'seeded', dryRun });

// Gate 0 reuses the attack definitions. (a) is J1 but must be OK_PAID exactly.
const CHECKS = [
  { id: 'a', title: 'minted key calls request_spend', attack: 'J1', expect: 'OK_PAID', ok: (s) => s.code === 'OK_PAID' },
  { id: 'b', title: 'same key signs a direct Transfer', attack: 'J5', expect: 'REFUSED_BY_NEAR: TRANSFER_NOT_ALLOWED' },
  { id: 'c', title: 'same key calls update_rules', attack: 'J6', expect: 'REFUSED_BY_NEAR: METHOD_NOT_ALLOWED' },
  { id: 'd', title: 'revoked key calls request_spend', attack: 'J7', expect: 'REFUSED_BY_NEAR: KEY_NOT_FOUND' },
];

if (dryRun) {
  dryRunBanner('gate0.js');
  heading('Plan');
  for (const c of CHECKS) {
    const steps = getAttack(c.attack).steps(cfg).map(describeStep);
    console.log(`(${c.id}) ${c.title}\n    ${steps.join('\n    ')}\n    expect: ${c.expect}`);
  }
  console.log(`(info) view access keys of ${cfg.vaultAccountId}: api-buyer key must be FunctionCall → ${cfg.vaultAccountId} [request_spend]; old-bot key must be gone`);
  console.log('then write evidence/gate0.json');
  process.exit(0);
}

const provider = makeProvider(process.env.NEAR_RPC);
const ctx = makeAttackCtx(cfg, provider);
const evidence = { script: 'gate0.js', at: new Date().toISOString(), network: cfg.network, vault: cfg.vaultAccountId, checks: [] };

for (const c of CHECKS) {
  heading(`(${c.id}) ${c.title}`);
  const row = await runAttack(getAttack(c.attack), ctx);
  const s = row.steps[0];
  const pass = c.ok ? c.ok(s) : s.ok;
  evidence.checks.push({ id: c.id, title: c.title, expect: c.expect, actual: s.label, pass, txHash: s.txHash, step: s });
  console.log(`${pass ? 'PASS' : 'FAIL'}  expected ${c.expect}, got ${s.label}`);
  if (s.txHash) console.log(`      ${txLink(s.txHash)}`);
  if (s.error) console.log(`      raw error: ${s.error.name}: ${s.error.message}`);
}

heading('(info) vault access keys');
try {
  const list = await new Account(cfg.vaultAccountId, provider).getAccessKeyList();
  evidence.vaultAccessKeys = list;
  const find = (pk) => list.keys.find((k) => k.public_key === pk);
  const buyer = find(cfg.demoKeys.apiBuyerPublicKey);
  const perm = buyer?.access_key?.permission;
  console.log(`api-buyer key: ${JSON.stringify(perm ?? 'NOT FOUND')}`);
  console.log(`old-bot key:   ${find(cfg.demoKeys.oldBotPublicKey) ? 'STILL PRESENT' : 'not on the account (revoked)'}`);
} catch (e) {
  evidence.vaultAccessKeys = { error: e.message };
  console.log(`could not read access keys: ${e.message}`);
}

const passed = evidence.checks.every((c) => c.pass);
evidence.result = passed ? 'PASS' : 'FAIL';
const file = writeEvidence('gate0', evidence);
heading(`Gate 0: ${evidence.result}`);
console.log(`evidence: ${file}`);
process.exit(passed ? 0 : 1);
