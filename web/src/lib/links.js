import { accountLink, txLink } from '../../../scripts/lib/format.js';

export { accountLink, txLink };

/** NearBlocks page listing an account's access keys (the minted agent key's permission). */
export const accessKeysLink = (accountId) => `${accountLink(accountId)}?tab=accesskeys`;

/** Payment timestamp (ns) → readable UTC time. */
export function nsToDate(ns) {
  return new Date(Number(BigInt(ns) / 1_000_000n)).toISOString().replace('T', ' ').replace(/\.\d+Z$/, ' UTC');
}
