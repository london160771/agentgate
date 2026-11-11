// NEAR Wallet Selector (testnet), for owner actions only. Users pick a wallet;
// Meteor uses its browser extension when installed, otherwise a pop-up.
// (MyNearWallet was used first; it stopped accepting new app connections in Nov 2026.)
// No function-call key is requested at sign-in, so every owner action opens the
// wallet to be confirmed: approving a held payment moves real money.
import { Buffer } from 'buffer';
import { actionCreators, setupWalletSelector } from '@near-wallet-selector/core';
import { setupMeteorWallet } from '@near-wallet-selector/meteor-wallet';
import { cfg, RPC_URLS } from './near.js';
import { ownerAction } from './owner.js';

// The wallet modules use Node's Buffer as a global.
globalThis.Buffer ??= Buffer;

export const WALLET_ID = 'meteor-wallet';
let selectorPromise;

export function getSelector() {
  selectorPromise ??= setupWalletSelector({
    network: cfg.network,
    // Only wallets checked to open a NEAR testnet sign-in from this site. HERE Wallet
    // (crypto polyfill error) and Intear (no testnet sign-in opened) were tried and left out.
    modules: [setupMeteorWallet()],
    fallbackRpcUrls: RPC_URLS,
  });
  return selectorPromise;
}

export const activeAccountId = (state) => state.accounts.find((a) => a.active)?.accountId ?? null;

/** The wallets the user can pick from, for the picker in the navbar. */
export async function walletChoices() {
  const { modules } = (await getSelector()).store.getState();
  return modules.map((m) => ({ id: m.id, name: m.metadata.name, icon: m.metadata.iconUrl, description: m.metadata.description || '' }));
}

export async function signIn(walletId = WALLET_ID) {
  const wallet = await (await getSelector()).wallet(walletId);
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
