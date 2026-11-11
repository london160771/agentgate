// Owner actions (P1-a). Pure helpers, no wallet code, so they can be unit tested.
import { GAS_OWNER } from '../../../scripts/lib/chain.js';

/** The only vault methods the web app lets the owner call. */
export const OWNER_METHODS = ['approve_held', 'reject_held', 'revoke_agent', 'add_agent'];

/** One FunctionCall action, no deposit (owner methods are not payable). `fc` = actionCreators.functionCall. */
export function ownerAction(fc, method, args) {
  if (!OWNER_METHODS.includes(method)) throw new Error(`not an owner action: ${method}`);
  return fc(method, args, GAS_OWNER, 0n);
}

/** True only when a signed-in account is the vault's owner (from get_owner). */
export const isOwner = (accountId, owner) => Boolean(accountId && owner && accountId === owner);

/** The tx hash of a FinalExecutionOutcome, or ''. */
export const outcomeHash = (outcome) => outcome?.transaction?.hash || outcome?.transaction_outcome?.id || '';

/**
 * A failed receipt still comes back as an outcome. Returns the failure text
 * (e.g. the contract's ERR_NOT_OWNER panic), or null when every step succeeded.
 */
export function outcomeFailure(outcome) {
  const fail = (status) => status && typeof status === 'object' && 'Failure' in status ? status.Failure : null;
  const found = [fail(outcome?.status), ...(outcome?.receipts_outcome || []).map((r) => fail(r?.outcome?.status))].find(Boolean);
  if (!found) return null;
  const exec = found.ActionError?.kind?.FunctionCallError?.ExecutionError;
  return exec || JSON.stringify(found);
}
