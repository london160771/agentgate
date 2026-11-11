// Chain access for the web app. Reads try each public testnet RPC in turn
// (views change nothing, so retrying is safe). Attack Lab transactions use a
// single RPC so NEAR's real refusal is shown, never a wrapped retry error.
import seed from '../../../config/seed.json';
import { isPlaceholder, resolveConfig, validateConfig } from '../../../scripts/lib/config.js';
import { Account } from 'near-api-js';
import { TESTNET_RPCS, makeAttackCtx, makeProvider, view } from '../../../scripts/lib/chain.js';

export const cfg = resolveConfig(seed);
export const configProblems = validateConfig(seed, 'seeded');
export const isReady = configProblems.length === 0;
export const demoKeysFilled = !isPlaceholder(seed.demoKeys?.apiBuyerPrivateKey);

export const RPC_URLS = [...new Set([import.meta.env.VITE_NEAR_RPC, ...TESTNET_RPCS].filter(Boolean))];
let workingUrl = RPC_URLS[0];

/** Runs a read with each RPC until one answers. */
async function withFallback(what, read) {
  const errors = [];
  for (const url of [workingUrl, ...RPC_URLS.filter((u) => u !== workingUrl)]) {
    try {
      const result = await read(makeProvider(url));
      workingUrl = url;
      return result;
    } catch (e) {
      errors.push(`${url}: ${e?.message || e}`);
    }
  }
  throw new Error(`All RPCs failed for ${what}:\n${errors.join('\n')}`);
}

/** View call on the vault, trying each RPC until one answers. */
export const viewVault = (method, args = {}) => withFallback(method, (p) => view(p, cfg.vaultAccountId, method, args));

/** The vault account's access-key list (to show the minted key and the lock status). */
export const vaultAccessKeys = () => withFallback('access keys', (p) => new Account(cfg.vaultAccountId, p).getAccessKeyList());

/** Attack-runner context signing with the public demo keys (see scripts/lib/attacks.js). */
export function attackContext() {
  const ctx = makeAttackCtx(cfg, makeProvider(workingUrl));
  return { ...ctx, getAgent: (key) => viewVault('get_agent', { public_key: key === 'oldBot' ? cfg.demoKeys.oldBotPublicKey : cfg.demoKeys.apiBuyerPublicKey }) };
}

export const currentRpc = () => workingUrl;
