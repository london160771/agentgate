// "Verify this vault": checks anyone can run against live chain data, no wallet needed.
// Pure function over what the RPC returned, so it can be unit tested with mock reads.
//   ok: true = passed, false = failed, null = not applicable (shown as info).
import { lockStatus } from '../../../scripts/lib/lock.js';

/**
 * keys:          view_access_key_list of the vault ({ keys: [...] })
 * account:       view_account of the vault ({ code_hash, ... })
 * factoryId:     the factory account (config factoryAccountId)
 * factoryInfo:   factory get_info() ({ code_hash, ... }) or null if unreadable
 * factoryVaults: factory get_vaults(owner) or null
 * owner:         vault get_owner()
 */
export function verifyChecks({ vaultId, keys, account, factoryId, factoryInfo, factoryVaults, owner }) {
  const lock = lockStatus(keys);
  const fromFactory = vaultId.endsWith(`.${factoryId}`);
  const checks = [];

  checks.push({
    id: 'no-full-access',
    ok: lock.locked,
    title: lock.locked ? 'No full-access key' : `${lock.fullAccess.length} full-access key${lock.fullAccess.length === 1 ? '' : 's'} on the vault`,
    detail: lock.locked
      ? 'No one holds a key that can send NEAR directly or replace the code. That includes the owner and AgentGate. NEAR only moves through the contract’s rules, and each move is logged.'
      : 'Whoever holds a full-access key can move everything and replace the code. The rules are not enforced until that key is removed.',
  });

  const strays = lock.functionCall.filter(
    (k) => k.permission?.receiver_id !== vaultId || JSON.stringify(k.permission?.method_names) !== '["request_spend"]',
  );
  checks.push({
    id: 'agent-keys',
    ok: strays.length === 0,
    title:
      strays.length === 0
        ? `${lock.functionCall.length} agent key${lock.functionCall.length === 1 ? '' : 's'}, each limited to request_spend`
        : `${strays.length} key${strays.length === 1 ? '' : 's'} can call more than request_spend`,
    detail:
      strays.length === 0
        ? 'NEAR itself refuses anything else signed with these keys: a plain transfer, another method, or a call to another contract.'
        : `Check these keys: ${strays.map((k) => k.publicKey).join(', ')}`,
  });

  if (fromFactory) {
    const same = Boolean(factoryInfo?.code_hash) && account?.code_hash === factoryInfo.code_hash;
    checks.push({
      id: 'code-hash',
      ok: factoryInfo ? same : null,
      title: same ? 'Runs the same code the factory gives every vault' : factoryInfo ? 'Code differs from the factory’s vault code' : 'Could not read the factory',
      detail: `Vault code hash ${account?.code_hash || '?'}; factory ${factoryId} ships ${factoryInfo?.code_hash || '?'}.`,
    });
    const listed = Array.isArray(factoryVaults) && factoryVaults.includes(vaultId);
    checks.push({
      id: 'factory-record',
      ok: factoryVaults ? listed : null,
      title: listed ? `Created by the factory for ${owner}` : `Not in the factory’s list for ${owner || 'its owner'}`,
      detail: `${factoryId} records every vault it creates: get_vaults("${owner}").`,
    });
  } else {
    checks.push({
      id: 'code-hash',
      ok: null,
      title: 'Deployed directly, not by the factory',
      detail: `This vault was deployed with scripts/deploy.sh from its own build, so its code hash (${account?.code_hash || '?'}) differs from the factory’s. Same source, separate build.`,
    });
  }
  return checks;
}

/** Overall verdict: every applicable check passed. */
export const allPassed = (checks) => checks.every((c) => c.ok !== false) && checks.some((c) => c.ok === true);
