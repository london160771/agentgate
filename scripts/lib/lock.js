// Vault lock (P1-b): pure helpers shared by scripts/lock-vault.js and the web app.
// "Locked" = the vault account has no full-access key left, so only the
// contract's own rules can move its NEAR. This can't be undone.

const isFull = (k) => k?.access_key?.permission === 'FullAccess';

/** Lock status from a view_access_key_list result ({ keys: [...] }). */
export function lockStatus(list) {
  const keys = list?.keys || [];
  const fullAccess = keys.filter(isFull).map((k) => k.public_key);
  const functionCall = keys.filter((k) => !isFull(k)).map((k) => ({ publicKey: k.public_key, permission: k.access_key.permission.FunctionCall }));
  return { locked: fullAccess.length === 0, fullAccess, functionCall };
}

/**
 * Checks before locking. Returns a list of problems (empty = safe to lock).
 * - the vault must have a different owner account, or no one could ever call owner methods again
 * - the api-buyer agent key must be there and limited to request_spend on the vault
 * - the key we sign with must be one of the full-access keys we delete
 */
export function lockProblems({ status, owner, cfg, signerPublicKey }) {
  const problems = [];
  if (status.locked) problems.push('the vault has no full-access key: it is already locked');
  if (!owner) problems.push('could not read get_owner from the vault');
  else if (owner === cfg.vaultAccountId) problems.push(`get_owner is the vault itself (${owner}): owner methods would be impossible after the lock`);
  else if (owner !== cfg.ownerAccountId) problems.push(`get_owner is ${owner}, but config/seed.json says ${cfg.ownerAccountId}`);
  const buyer = status.functionCall.find((k) => k.publicKey === cfg.demoKeys.apiBuyerPublicKey);
  if (!buyer) problems.push('the api-buyer agent key is not on the vault account');
  else if (buyer.permission?.receiver_id !== cfg.vaultAccountId || JSON.stringify(buyer.permission?.method_names) !== '["request_spend"]')
    problems.push(`the api-buyer key is not limited to request_spend on ${cfg.vaultAccountId}`);
  if (signerPublicKey && !status.locked && !status.fullAccess.includes(signerPublicKey))
    problems.push(`the key found on this machine (${signerPublicKey}) is not a full-access key of the vault`);
  return problems;
}

/** Order of DeleteKey actions: other full-access keys first, the signing key last. */
export function deleteOrder(fullAccess, signerPublicKey) {
  return [...fullAccess.filter((k) => k !== signerPublicKey), ...fullAccess.filter((k) => k === signerPublicKey)];
}
