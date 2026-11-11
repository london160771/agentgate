#!/usr/bin/env bash
# Builds the vault contract and deploys it to vaultAccountId from config/seed.json,
# calling new(owner) in the same transaction. Adesope runs this; agents never deploy.
#
# Needs: cargo-near, near-cli-rs, and the vault account's full-access key in the
# legacy keychain (~/.near-credentials/testnet/), see scripts/setup-accounts.md.
# Usage: bash scripts/deploy.sh [--dry-run]
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DRY_RUN=0
[[ "${1:-}" == "--dry-run" ]] && DRY_RUN=1

# Read accounts from config/seed.json (single source).
read -r NETWORK OWNER VAULT < <(node --input-type=module -e "
  import { readRawConfig } from '$ROOT/scripts/lib/node.js';
  import { resolveConfig, validateConfig } from '$ROOT/scripts/lib/config.js';
  const raw = readRawConfig();
  const errors = validateConfig(raw, $DRY_RUN ? 'template' : 'owner');
  if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
  const c = resolveConfig(raw);
  console.log(c.network, c.ownerAccountId.replace(/ /g, '_'), c.vaultAccountId);
")

WASM="$ROOT/contract/target/near/agentgate_vault.wasm"
BUILD=(cargo near build non-reproducible-wasm)
DEPLOY=(near contract deploy "$VAULT" use-file "$WASM"
  with-init-call new json-args "{\"owner\":\"$OWNER\"}"
  prepaid-gas '100.0 Tgas' attached-deposit '0 NEAR'
  network-config "$NETWORK" sign-with-legacy-keychain send)

if [[ $DRY_RUN -eq 1 ]]; then
  echo "[dry-run] deploy.sh: nothing is built, signed or sent."
  echo "1. (cd contract && ${BUILD[*]})"
  printf '2. '; printf '%q ' "${DEPLOY[@]}"; echo
  echo "3. near contract call-function as-read-only $VAULT get_owner json-args {} network-config $NETWORK now"
  exit 0
fi

echo "== 1. Build =="
(cd "$ROOT/contract" && "${BUILD[@]}")
ls -l "$WASM"

echo "== 2. Deploy to $VAULT and call new(owner=$OWNER) =="
"${DEPLOY[@]}"

echo "== 3. Check =="
near contract call-function as-read-only "$VAULT" get_owner json-args '{}' network-config "$NETWORK" now
echo "Done. Next: node scripts/seed.js"
