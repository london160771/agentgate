#!/usr/bin/env node
// Owner actions from the CLI (the MVP has no owner login in the UI).
// Usage:
//   node scripts/owner.js status
//   node scripts/owner.js approve <paymentId>
//   node scripts/owner.js reject <paymentId>
//   node scripts/owner.js reject-all-held
//   node scripts/owner.js revoke <publicKey>
// Add --dry-run to print the planned calls without sending.

import { GAS_OWNER, callMethod, makeAccount, makeProvider, view } from './lib/chain.js';
import { formatNear, shortKey, txLink } from './lib/format.js';
import { dryRunBanner, findCredentials, heading, loadConfig, parseArgs, stamp, writeEvidence } from './lib/node.js';

const USAGE = 'Usage: node scripts/owner.js <status | approve <id> | reject <id> | reject-all-held | revoke <publicKey>> [--dry-run]';
const { dryRun, positional } = parseArgs();
const [command, arg] = positional;
const { cfg } = loadConfig({ stage: 'owner', dryRun });
const vault = cfg.vaultAccountId;

const needsArg = { approve: 'payment id', reject: 'payment id', revoke: 'public key' };
if (!['status', 'approve', 'reject', 'reject-all-held', 'revoke'].includes(command)) {
  console.error(USAGE);
  process.exit(2);
}
if (needsArg[command] && !arg) {
  console.error(`${command} needs a ${needsArg[command]}.\n${USAGE}`);
  process.exit(2);
}
const paymentId = () => {
  if (!/^\d+$/.test(arg)) throw new Error(`payment id must be a number, got "${arg}"`);
  return Number(arg);
};

if (dryRun) {
  dryRunBanner(`owner.js ${command}`);
  const plan = {
    status: [`view ${vault}.get_stats()`, `view ${vault}.get_agents()`, `view ${vault}.get_held()`],
    approve: [`${cfg.ownerAccountId} → ${vault}.approve_held({"payment_id":${arg}})`],
    reject: [`${cfg.ownerAccountId} → ${vault}.reject_held({"payment_id":${arg}})`],
    'reject-all-held': [`view ${vault}.get_held()`, `${cfg.ownerAccountId} → ${vault}.reject_held({"payment_id":<id>}) for each held payment`],
    revoke: [`${cfg.ownerAccountId} → ${vault}.revoke_agent({"public_key":"${arg}"})`],
  }[command];
  plan.forEach((p, i) => console.log(`${i + 1}. ${p}`));
  process.exit(0);
}

const provider = makeProvider(process.env.NEAR_RPC);

async function status() {
  const [stats, agents, held] = await Promise.all([
    view(provider, vault, 'get_stats'),
    view(provider, vault, 'get_agents'),
    view(provider, vault, 'get_held'),
  ]);
  heading(`Vault ${vault}`);
  console.log(`balance ${formatNear(stats.vault_balance)} · paid ${stats.paid} · held ${stats.held} (${stats.held_pending} waiting) · blocked ${stats.blocked} · approved ${stats.approved} · rejected ${stats.rejected}`);
  console.log(`total paid ${formatNear(stats.total_paid)} · total approved ${formatNear(stats.total_approved)}`);
  heading('Agents');
  for (const a of agents) {
    console.log(`${a.active ? 'active ' : 'REVOKED'} ${a.name} ${shortKey(a.public_key)} · per tx ${formatNear(a.per_tx_cap)} · today ${formatNear(a.paid_today)} / ${formatNear(a.daily_cap)} · allowed ${a.allowed.join(', ')}`);
  }
  heading(`Held (${held.length})`);
  for (const p of held) {
    console.log(`#${p.id} ${p.agent_name} → ${p.to} ${formatNear(p.amount)} "${p.reason}"`);
    console.log(`   node scripts/owner.js approve ${p.id}   |   node scripts/owner.js reject ${p.id}`);
  }
}

async function send(method, args) {
  const creds = findCredentials(cfg.ownerAccountId, cfg.network);
  const owner = makeAccount(cfg.ownerAccountId, creds.privateKey, provider);
  const { result, txHash } = await callMethod(owner, vault, method, args, { gas: GAS_OWNER });
  console.log(`✓ ${method}(${JSON.stringify(args)})  ${txLink(txHash)}`);
  return { method, args, txHash, result };
}

const actions = [];
if (command === 'status') await status();
if (command === 'approve') actions.push(await send('approve_held', { payment_id: paymentId() }));
if (command === 'reject') actions.push(await send('reject_held', { payment_id: paymentId() }));
if (command === 'revoke') actions.push(await send('revoke_agent', { public_key: arg }));
if (command === 'reject-all-held') {
  const held = await view(provider, vault, 'get_held');
  console.log(`${held.length} held payment(s)`);
  for (const p of held) actions.push(await send('reject_held', { payment_id: p.id }));
}
if (actions.length) {
  const file = writeEvidence(`owner-${stamp()}`, { script: 'owner.js', command, at: new Date().toISOString(), vault, actions });
  console.log(`evidence: ${file}`);
}
