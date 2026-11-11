#!/usr/bin/env bash
# Multi-user: creates the factory account (factoryAccountId in config/seed.json,
# e.g. agentgate.testnet, so vaults are <name>.agentgate.testnet) with the testnet
# faucet, then deploys the vault factory to it. Each user then creates their own
# vault from the website and pays for it. Adesope runs this once; agents never deploy.
#
# Needs: cargo-near and near-cli-rs. The factory's new key is saved to the legacy
# keychain (~/.near-credentials/testnet/). Its code storage is about 3.4 NEAR,
# covered by the faucet's starting balance.
# Usage: bash scripts/deploy-factory.sh [--dry-run]
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DRY_RUN=0
[[ "${1:-}" == "--dry-run" ]] && DRY_RUN=1

# Read accounts from config/seed.json (single source).
read -r NETWORK OWNER FACTORY < <(node --input-type=module -e "
  import { readRawConfig } from '$ROOT/scripts/lib/node.js';
  import { resolveConfig, validateConfig } from '$ROOT/scripts/lib/config.js';
  const raw = readRawConfig();
  const errors = validateConfig(raw, $DRY_RUN ? 'template' : 'owner');
  if (!raw.factoryAccountId) errors.push('factoryAccountId missing in config/seed.json');
  if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
  const c = resolveConfig(raw);
  console.log(c.network, c.ownerAccountId.replace(/ /g, '_'), c.factoryAccountId);
")

WASM="$ROOT/factory/target/near/agentgate_factory.wasm"
BUILD=(cargo near build non-reproducible-wasm)
CREATE=(near account create-account sponsor-by-faucet-service "$FACTORY"
  autogenerate-new-keypair save-to-legacy-keychain network-config "$NETWORK" create)
DEPLOY=(near contract deploy "$FACTORY" use-file "$WASM"
  with-init-call new json-args '{}'
  prepaid-gas '100.0 Tgas' attached-deposit '0 NEAR'
  network-config "$NETWORK" sign-with-legacy-keychain send)
CHECK=(near contract call-function as-read-only "$FACTORY" get_info json-args '{}' network-config "$NETWORK" now)

if [[ $DRY_RUN -eq 1 ]]; then
  echo "[dry-run] deploy-factory.sh: nothing is built, signed or sent."
  echo "1. (cd factory && ${BUILD[*]})"
  printf '2. '; printf '%q ' "${CREATE[@]}"; echo
  printf '3. '; printf '%q ' "${DEPLOY[@]}"; echo
  printf '4. '; printf '%q ' "${CHECK[@]}"; echo
  exit 0
fi

echo "== 1. Build the factory (it carries the vault code from factory/res/) =="
(cd "$ROOT/factory" && "${BUILD[@]}")
ls -l "$WASM"

if near account view-account-summary "$FACTORY" network-config "$NETWORK" now >/dev/null 2>&1; then
  echo "== 2. $FACTORY already exists, skipping create =="
else
  echo "== 2. Create $FACTORY with the testnet faucet =="
  "${CREATE[@]}"
fi

echo "== 3. Deploy the factory to $FACTORY and call new() =="
"${DEPLOY[@]}"

echo "== 4. Check =="
"${CHECK[@]}"
echo "Done. Open the site, connect your wallet, go to My vaults and press Create vault."
