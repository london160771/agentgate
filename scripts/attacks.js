#!/usr/bin/env node
// Runs the Attack Suite J1–J7 (PRD 8) with the public demo keys and writes
// evidence/attacks-<timestamp>.json.
// Usage: node scripts/attacks.js [--dry-run] [--only=J2]

import { ATTACKS, describeStep, getAttack, runAttack } from './lib/attacks.js';
import { makeAttackCtx, makeProvider } from './lib/chain.js';
import { txLink } from './lib/format.js';
import { dryRunBanner, heading, loadConfig, parseArgs, stamp, writeEvidence } from './lib/node.js';

const { dryRun, flags } = parseArgs();
const { cfg } = loadConfig({ stage: 'seeded', dryRun });
const selected = flags.only ? [getAttack(flags.only)] : ATTACKS;

if (dryRun) {
  dryRunBanner('attacks.js');
  for (const a of selected) {
    heading(`${a.id} ${a.name}`);
    for (const s of a.steps(cfg)) console.log(`  ${describeStep(s)}`);
    console.log(`  expect: ${a.expected}`);
  }
  console.log('\nthen write evidence/attacks-<timestamp>.json');
  process.exit(0);
}

const provider = makeProvider(process.env.NEAR_RPC);
const ctx = makeAttackCtx(cfg, provider);
const rows = [];
for (const a of selected) {
  heading(`${a.id} ${a.name}`);
  const row = await runAttack(a, ctx);
  rows.push(row);
  for (const s of row.steps) {
    console.log(`  ${s.plan}\n    → ${s.label}${s.txHash ? `  ${txLink(s.txHash)}` : ''}${s.error ? `\n    raw: ${s.error.name}: ${s.error.message}` : ''}`);
  }
  if (row.note) console.log(`  ${row.note}`);
  console.log(`  ${row.pass ? 'AS EXPECTED' : 'NOT AS EXPECTED'} (expected ${row.expected})`);
}

heading('Summary');
console.table(rows.map((r) => ({ attack: `${r.id} ${r.name}`, expected: r.expected, actual: r.actual, ok: r.pass ? 'yes' : 'NO' })));
const file = writeEvidence(`attacks-${stamp()}`, {
  script: 'attacks.js',
  at: new Date().toISOString(),
  network: cfg.network,
  vault: cfg.vaultAccountId,
  allAsExpected: rows.every((r) => r.pass),
  rows,
});
console.log(`evidence: ${file}`);
process.exit(rows.every((r) => r.pass) ? 0 : 1);
