#!/usr/bin/env node
// Seeds the deployed vault (PRD 7):
//   1. owner funds the vault with vaultFundingNear
//   2. owner calls add_agent for api-buyer and old-bot (new keypairs; the vault mints the keys)
//   3. owner revokes old-bot
//   4. writes the two demo keys into config/seed.json (public on purpose)
// Usage: node scripts/seed.js [--dry-run] [--force]

import { KeyPair } from 'near-api-js';
import { agentRules, isPlaceholder } from './lib/config.js';
import { GAS_OWNER, callMethod, makeAccount, makeProvider, sendTransfer } from './lib/chain.js';
import { formatNear, nearToYocto, txLink } from './lib/format.js';
import { dryRunBanner, findCredentials, heading, loadConfig, parseArgs, stamp, writeEvidence, writeRawConfig } from './lib/node.js';

const { dryRun, flags } = parseArgs();
const { raw, cfg } = loadConfig({ stage: 'owner', dryRun });

const funding = nearToYocto(cfg.vaultFundingNear).toString();
const buyer = agentRules(cfg, 'apiBuyer');
const oldBot = agentRules(cfg, 'oldBot');
const addAgentArgs = (rules, publicKey) => ({
  public_key: publicKey,
  name: rules.name,
  per_tx_cap: rules.perTxCap,
  daily_cap: rules.dailyCap,
  allowed: rules.allowed,
  allowance: rules.allowance,
});

if (dryRun) {
  dryRunBanner('seed.js');
  heading('Plan');
  console.log(`owner:  ${cfg.ownerAccountId}`);
  console.log(`vault:  ${cfg.vaultAccountId}`);
  console.log(`1. ${cfg.ownerAccountId} → Transfer ${formatNear(funding)} to ${cfg.vaultAccountId}`);
  console.log(`2. generate a new ed25519 keypair for ${buyer.name}`);
  console.log(`3. ${cfg.ownerAccountId} → ${cfg.vaultAccountId}.add_agent(${JSON.stringify(addAgentArgs(buyer, '<new api-buyer public key>'))})`);
  console.log(`4. generate a new ed25519 keypair for ${oldBot.name}`);
  console.log(`5. ${cfg.ownerAccountId} → ${cfg.vaultAccountId}.add_agent(${JSON.stringify(addAgentArgs(oldBot, '<new old-bot public key>'))})`);
  console.log(`6. ${cfg.ownerAccountId} → ${cfg.vaultAccountId}.revoke_agent({"public_key":"<new old-bot public key>"})`);
  console.log('7. write demoKeys (both keypairs, public on purpose) into config/seed.json');
  console.log('8. write evidence/seed-<timestamp>.json (tx hashes, public keys only)');
  process.exit(0);
}

if (!isPlaceholder(raw.demoKeys?.apiBuyerPublicKey) && !flags.force) {
  console.error('config/seed.json already has demo keys. The vault is seeded. Use --force to seed new agents anyway.');
  process.exit(1);
}

const provider = makeProvider(process.env.NEAR_RPC);
const creds = findCredentials(cfg.ownerAccountId, cfg.network);
const owner = makeAccount(cfg.ownerAccountId, creds.privateKey, provider);
console.log(`Owner key: ${creds.publicKey} (from ${creds.file})`);

const evidence = { script: 'seed.js', at: new Date().toISOString(), network: cfg.network, vault: cfg.vaultAccountId, steps: [] };
const step = (name, txHash, extra = {}) => {
  evidence.steps.push({ name, txHash, explorer: txHash ? txLink(txHash) : undefined, ...extra });
  console.log(`✓ ${name}${txHash ? `  ${txLink(txHash)}` : ''}`);
};

heading('1. Fund the vault');
const fund = await sendTransfer(owner, cfg.vaultAccountId, funding);
step(`transfer ${formatNear(funding)} to ${cfg.vaultAccountId}`, fund.txHash);

heading('2. Mint api-buyer key');
const buyerKey = KeyPair.fromRandom('ed25519');
const buyerPub = buyerKey.getPublicKey().toString();
const addBuyer = await callMethod(owner, cfg.vaultAccountId, 'add_agent', addAgentArgs(buyer, buyerPub), { gas: GAS_OWNER });
step(`add_agent ${buyer.name} ${buyerPub}`, addBuyer.txHash);

heading('3. Mint old-bot key');
const oldKey = KeyPair.fromRandom('ed25519');
const oldPub = oldKey.getPublicKey().toString();
const addOld = await callMethod(owner, cfg.vaultAccountId, 'add_agent', addAgentArgs(oldBot, oldPub), { gas: GAS_OWNER });
step(`add_agent ${oldBot.name} ${oldPub}`, addOld.txHash);

heading('4. Revoke old-bot');
const revoke = await callMethod(owner, cfg.vaultAccountId, 'revoke_agent', { public_key: oldPub }, { gas: GAS_OWNER });
step(`revoke_agent ${oldBot.name}`, revoke.txHash);

heading('5. Check the vault access keys');
const keys = await owner.provider.viewAccessKeyList({ accountId: cfg.vaultAccountId, finalityQuery: { finality: 'final' } }).catch((e) => ({ error: e.message }));
evidence.vaultAccessKeys = keys;
console.log(JSON.stringify(keys, null, 2));

raw.demoKeys = {
  apiBuyerPublicKey: buyerPub,
  apiBuyerPrivateKey: buyerKey.toString(),
  oldBotPublicKey: oldPub,
  oldBotPrivateKey: oldKey.toString(),
};
writeRawConfig(raw);
console.log('\n✓ demo keys written to config/seed.json (public on purpose: api-buyer is limited by the vault, old-bot is revoked)');

const file = writeEvidence(`seed-${stamp()}`, evidence);
console.log(`✓ evidence: ${file}`);
