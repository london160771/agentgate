// Node-only helpers: read config, find the owner's key on this machine, parse
// CLI flags, write evidence files. Never prints or writes private keys of the
// owner or the vault.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertConfig, resolveConfig } from './config.js';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const CONFIG_PATH = path.join(ROOT, 'config', 'seed.json');
export const EVIDENCE_DIR = path.join(ROOT, 'evidence');

export function readRawConfig(file = CONFIG_PATH) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

/** Reads, validates (unless dry-run) and resolves config/seed.json. */
export function loadConfig({ stage = 'owner', dryRun = false, file = CONFIG_PATH } = {}) {
  const raw = readRawConfig(file);
  if (dryRun) assertConfig(raw, 'template');
  else assertConfig(raw, stage);
  return { raw, cfg: resolveConfig(raw) };
}

/** Writes the demo keys back into config/seed.json (keeps 2-space formatting). */
export function writeRawConfig(raw, file = CONFIG_PATH) {
  fs.writeFileSync(file, JSON.stringify(raw, null, 2) + '\n');
}

/** Simple flag parser: --dry-run, --force, --mode=llm, positional args. */
export function parseArgs(argv = process.argv.slice(2)) {
  const flags = {};
  const positional = [];
  for (const a of argv) {
    if (a.startsWith('--')) {
      const [k, v] = a.slice(2).split('=');
      flags[k] = v === undefined ? true : v;
    } else positional.push(a);
  }
  return { flags, positional, dryRun: Boolean(flags['dry-run']) };
}

/**
 * Finds a full-access key for accountId saved by near-cli-rs
 * ("save to legacy keychain") or the old near-cli. Looks in:
 *   ~/.near-credentials/<network>/<accountId>.json
 *   ~/.near-credentials/<network>/<accountId>/<publicKey>.json
 * NEAR_CREDENTIALS_DIR overrides ~/.near-credentials.
 */
export function findCredentials(accountId, network = 'testnet') {
  const base = process.env.NEAR_CREDENTIALS_DIR || path.join(os.homedir(), '.near-credentials');
  const dir = path.join(base, network);
  const candidates = [path.join(dir, `${accountId}.json`)];
  const sub = path.join(dir, accountId);
  if (fs.existsSync(sub) && fs.statSync(sub).isDirectory()) {
    for (const f of fs.readdirSync(sub)) if (f.endsWith('.json')) candidates.push(path.join(sub, f));
  }
  for (const file of candidates) {
    if (!fs.existsSync(file)) continue;
    const json = JSON.parse(fs.readFileSync(file, 'utf8'));
    const privateKey = json.private_key || json.secret_key;
    if (privateKey) return { privateKey, publicKey: json.public_key, file };
  }
  throw new Error(
    `No key for ${accountId} in ${dir}.\n` +
      `Save it with near-cli-rs: near account import-account using-seed-phrase ... network-config ${network}\n` +
      `and pick "save to legacy keychain" (see scripts/setup-accounts.md).`,
  );
}

/** Writes evidence/<name>.json and returns the path. Never called in dry-run. */
export function writeEvidence(name, data) {
  fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
  const file = path.join(EVIDENCE_DIR, `${name}.json`);
  const json = JSON.stringify(data, (_k, v) => (typeof v === 'bigint' ? v.toString() : v), 2);
  fs.writeFileSync(file, json + '\n');
  return file;
}

/** "2026-11-12T10-30-00Z", safe for file names. */
export function stamp(date = new Date()) {
  return date.toISOString().replace(/\.\d+Z$/, 'Z').replace(/:/g, '-');
}

export { serializeError as rawError } from './classify.js';

export function heading(text) {
  console.log(`\n=== ${text} ===`);
}

export function dryRunBanner(script) {
  console.log(`[dry-run] ${script}: nothing is signed or sent, no network calls, no files written.`);
}
