#!/usr/bin/env bash
# Rebuilds the vault wasm that the factory deploys for each user (res/agentgate_vault.wasm).
set -euo pipefail
cd "$(dirname "$0")/../contract"
cargo near build non-reproducible-wasm
cp target/near/agentgate_vault.wasm ../factory/res/agentgate_vault.wasm
sha256sum ../factory/res/agentgate_vault.wasm
