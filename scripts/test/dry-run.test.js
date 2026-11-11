// Every network script must run with --dry-run without errors and without
// touching the network or writing files (PRD 11, Phase 2 check).
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { EVIDENCE_DIR, ROOT } from '../lib/node.js';

const CONFIG = path.join(ROOT, 'config', 'seed.json');
const run = (cmd, args) => execFileSync(cmd, args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, NEAR_RPC: 'http://127.0.0.1:9' } });

const RUNS = [
  ['node', ['scripts/seed.js', '--dry-run']],
  ['node', ['scripts/gate0.js', '--dry-run']],
  ['node', ['scripts/lock-vault.js', '--dry-run']],
  ['node', ['scripts/attacks.js', '--dry-run']],
  ['node', ['scripts/attacks.js', '--dry-run', '--only=J4']],
  ['node', ['scripts/owner.js', 'status', '--dry-run']],
  ['node', ['scripts/owner.js', 'approve', '1', '--dry-run']],
  ['node', ['scripts/owner.js', 'reject', '1', '--dry-run']],
  ['node', ['scripts/owner.js', 'reject-all-held', '--dry-run']],
  ['node', ['scripts/owner.js', 'revoke', 'ed25519:abc', '--dry-run']],
  ['node', ['scripts/agent.js', '--dry-run']],
  ['node', ['scripts/agent.js', '--mode=llm', '--dry-run']],
  ['bash', ['scripts/deploy.sh', '--dry-run']],
  ['bash', ['scripts/deploy-factory.sh', '--dry-run']],
];

for (const [cmd, args] of RUNS) {
  test(`${cmd} ${args.join(' ')}`, () => {
    const configBefore = fs.readFileSync(CONFIG, 'utf8');
    const evidenceBefore = fs.existsSync(EVIDENCE_DIR) ? fs.readdirSync(EVIDENCE_DIR).sort() : [];
    const out = run(cmd, args);
    assert.match(out, /dry-run/);
    assert.equal(fs.readFileSync(CONFIG, 'utf8'), configBefore, 'config must not change');
    const evidenceAfter = fs.existsSync(EVIDENCE_DIR) ? fs.readdirSync(EVIDENCE_DIR).sort() : [];
    assert.deepEqual(evidenceAfter, evidenceBefore, 'no evidence files in dry-run');
  });
}

test('a real (non dry-run) run refuses while ownerAccountId is a placeholder', () => {
  const raw = JSON.parse(fs.readFileSync(CONFIG, 'utf8'));
  if (!raw.ownerAccountId.includes('<')) return; // only meaningful on the template
  assert.throws(() => run('node', ['scripts/seed.js']), /ownerAccountId is not set/);
});
