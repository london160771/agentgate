// Talks to NEAR testnet with near-api-js. No Node-only imports, so the web app
// can use the same code. Private keys come from the caller (config demo keys
// or the owner's local keychain), never from here.

import { Account, FailoverRpcProvider, JsonRpcProvider, KeyPair, KeyPairSigner, getTransactionLastResult } from 'near-api-js';

/** Public testnet RPCs, tried in order. NEAR_RPC / VITE_NEAR_RPC goes first when set. */
export const TESTNET_RPCS = ['https://test.rpc.fastnear.com', 'https://rpc.testnet.near.org'];

export const GAS_SPEND = 30_000_000_000_000n; // 30 TGas: request_spend logs one event and maybe one transfer
export const GAS_OWNER = 50_000_000_000_000n; // 50 TGas: owner calls (add key, delete key, transfer)

export function makeProvider(preferredUrl) {
  const urls = [preferredUrl, ...TESTNET_RPCS].filter(Boolean);
  const unique = [...new Set(urls)];
  return new FailoverRpcProvider(unique.map((url) => new JsonRpcProvider({ url })));
}

/** An Account that signs with one key. privateKey: "ed25519:..." */
export function makeAccount(accountId, privateKey, provider) {
  const signer = new KeyPairSigner(KeyPair.fromString(privateKey));
  return new Account(accountId, provider, signer);
}

export function txHashOf(outcome) {
  return outcome?.transaction?.hash || outcome?.transaction_outcome?.id;
}

/** Signed function call. Returns { result, txHash }. Throws near-api-js errors. */
export async function callMethod(account, contractId, method, args, { gas = GAS_OWNER, deposit = 0n } = {}) {
  const outcome = await account.callFunctionRaw({ contractId, methodName: method, args, gas, deposit });
  return { result: getTransactionLastResult(outcome), txHash: txHashOf(outcome), outcome };
}

/** Plain NEAR transfer. Returns { txHash }. */
export async function sendTransfer(account, receiverId, amountYocto) {
  const outcome = await account.transfer({ receiverId, amount: BigInt(amountYocto) });
  return { txHash: txHashOf(outcome), outcome };
}

/** View call on the vault. */
export function view(provider, contractId, method, args = {}) {
  return provider.callFunction({ contractId, method, args });
}

/**
 * Attack-runner context (see lib/attacks.js) for the public demo keys.
 * Both keys sign as the vault account: that's where the vault minted them.
 */
export function makeAttackCtx(cfg, provider) {
  const accounts = {
    apiBuyer: makeAccount(cfg.vaultAccountId, cfg.demoKeys.apiBuyerPrivateKey, provider),
    oldBot: makeAccount(cfg.vaultAccountId, cfg.demoKeys.oldBotPrivateKey, provider),
  };
  const publicKeys = { apiBuyer: cfg.demoKeys.apiBuyerPublicKey, oldBot: cfg.demoKeys.oldBotPublicKey };
  return {
    cfg,
    spend: ({ key, to, amountYocto, reason }) =>
      callMethod(accounts[key], cfg.vaultAccountId, 'request_spend', { to, amount: amountYocto, reason }, { gas: GAS_SPEND }),
    transfer: ({ key, to, amountYocto }) => sendTransfer(accounts[key], to, amountYocto),
    call: ({ key, method, args }) => callMethod(accounts[key], cfg.vaultAccountId, method, args, { gas: GAS_SPEND }),
    getAgent: (key) => view(provider, cfg.vaultAccountId, 'get_agent', { public_key: publicKeys[key] }),
  };
}
