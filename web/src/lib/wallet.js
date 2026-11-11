// NEAR Wallet Selector with MyNearWallet (testnet), for owner actions only.
// No function-call key is requested at sign-in, so every owner action opens the
// wallet to be confirmed: approving a held payment moves real money.
import { Buffer } from 'buffer';
import { actionCreators, setupWalletSelector } from '@near-wallet-selector/core';
import { setupMyNearWallet } from '@near-wallet-selector/my-near-wallet';
import { cfg, RPC_URLS } from './near.js';
import { ownerAction } from './owner.js';

// The wallet modules use Node's Buffer as a global.
globalThis.Buffer ??= Buffer;

export const WALLET_ID = 'my-near-wallet';
let selectorPromise;

export function getSelector() {
  selectorPromise ??= setupWalletSelector({
    network: cfg.network,
    modules: [setupMyNearWallet()],
    fallbackRpcUrls: RPC_URLS,
  });
  return selectorPromise;
}

export const activeAccountId = (state) => state.accounts.find((a) => a.active)?.accountId ?? null;

export async function signIn() {
  const wallet = await (await getSelector()).wallet(WALLET_ID);
  return wallet.signIn({});
}

export async function signOut() {
  const selector = await getSelector();
  if (selector.isSignedIn()) await (await selector.wallet()).signOut();
}

/** Signs one owner call in the wallet popup. Resolves with the FinalExecutionOutcome. */
export async function sendOwnerAction(signerId, method, args) {
  const wallet = await (await getSelector()).wallet();
  return wallet.signAndSendTransaction({
    signerId,
    receiverId: cfg.vaultAccountId,
    actions: [ownerAction(actionCreators.functionCall, method, args)],
  });
}
