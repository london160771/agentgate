#!/usr/bin/env node
// P1-b vault lock: deletes every full-access key of the vault account in one
// transaction, signed with the vault key from your legacy keychain. After this,
// only the contract's rules can move the vault's NEAR. Nobody can redeploy the
// contract, add keys or send NEAR out directly. THIS CAN'T BE UNDONE.
// Owner methods (approve / reject / revoke / add_agent) keep working: they are
// called from the owner account, not from a vault key.
// Usage: node scripts/lock-vault.js [--dry-run] [--confirm]
//   without --confirm it only checks and prints what it would delete.

import { Account, PublicKey, actions } from 'near-api-js';
import { makeAccount, makeProvider, txHashOf, view } from './lib/chain.js';
import { txLink } from './lib/format.js';
import { deleteOrder, lockProblems, lockStatus } from './lib/lock.js';
import { dryRunBanner, findCredentials, heading, loadConfig, parseArgs, stamp, writeEvidence } from './lib/node.js';

const { flags, dryRun } = parseArgs();
const { cfg } = loadConfig({ stage: 'seeded', dryRun });

if (dryRun) {
  dryRunBanner('lock-vault.js');
  heading('Plan');
  console.log(`1. read the access keys of ${cfg.vaultAccountId} and get_owner`);
  console.log(`2. check: owner is ${cfg.ownerAccountId} (not the vault), api-buyer key is FunctionCall → ${cfg.vaultAccountId} [request_spend], the vault key on this machine is one of the full-access keys`);
  console.log(`3. only with --confirm: one transaction from ${cfg.vaultAccountId}, signed with its key from ~/.near-credentials/testnet/, with a DeleteKey action for every full-access key (the signing key last)`);
  console.log('4. read the access keys again: there must be no FullAccess key left');
  console.log('5. write evidence/lock-<timestamp>.json (key lists before and after, tx hash; public keys only)');
  process.exit(0);
}

const provider = makeProvider(process.env.NEAR_RPC);
const vault = cfg.vaultAccountId;
const readKeys = () => new Account(vault, provider).getAccessKeyList();

heading('Before');
const before = await readKeys();
const status = lockStatus(before);
const owner = await view(provider, vault, 'get_owner').catch(() => null);
console.log(`owner (get_owner): ${owner}`);
console.log(`full-access keys:  ${status.fullAccess.join(', ') || 'none'}`);
for (const k of status.functionCall) console.log(`function-call key: ${k.publicKey} → ${k.permission.receiver_id} [${k.permission.method_names.join(', ')}]`);

let creds = null;
if (!status.locked) {
  try {
    creds = findCredentials(vault, cfg.network);
  } catch (e) {
    console.error(`\n${e.message}`);
    process.exit(1);
  }
}
const problems = lockProblems({ status, owner, cfg, signerPublicKey: creds?.publicKey });
if (problems.length) {
  heading('Not locking');
  for (const p of problems) console.log(`- ${p}`);
  process.exit(status.locked ? 0 : 1);
}

const order = deleteOrder(status.fullAccess, creds.publicKey);
if (!flags.confirm) {
  heading('Checks passed. Nothing sent.');
  console.log(`Would delete ${order.length} full-access key(s): ${order.join(', ')}`);
  console.log('This is permanent. To lock the vault, run again with --confirm');
  process.exit(0);
}

heading('Locking');
const account = makeAccount(vault, creds.privateKey, provider);
const outcome = await account.signAndSendTransaction({ receiverId: vault, actions: order.map((pk) => actions.deleteKey(PublicKey.from(pk))) });
const txHash = txHashOf(outcome);
console.log(`tx ${txHash}\n   ${txLink(txHash)}`);

heading('After');
let after = await readKeys();
for (let i = 0; i < 5 && !lockStatus(after).locked; i++) {
  await new Promise((r) => setTimeout(r, 2000));
  after = await readKeys();
}
const done = lockStatus(after);
console.log(`full-access keys: ${done.fullAccess.join(', ') || 'none'}`);
for (const k of done.functionCall) console.log(`function-call key: ${k.publicKey} → ${k.permission.receiver_id} [${k.permission.method_names.join(', ')}]`);

const file = writeEvidence(`lock-${stamp()}`, {
  script: 'lock-vault.js',
  at: new Date().toISOString(),
  network: cfg.network,
  vault,
  owner,
  txHash,
  explorer: txLink(txHash),
  deleted: order,
  before,
  after,
  result: done.locked ? 'LOCKED' : 'NOT_LOCKED',
});
heading(done.locked ? 'Vault locked: no full-access key left' : 'NOT locked: a full-access key is still there');
console.log(`evidence: ${file}`);
process.exit(done.locked ? 0 : 1);
