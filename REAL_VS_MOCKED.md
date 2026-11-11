# REAL vs MOCKED

> Filled in Phase 4 from `evidence/`. Until then, this shows the plan. Nothing here is claimed as done.

| Part | Status | Proof |
|---|---|---|
| Vault contract on NEAR testnet | Planned: real | Explorer link to the vault account (TODO after deploy) |
| Agent keys minted by the contract (Function Call Keys) | Planned: real | `evidence/gate0.json` + explorer access-key list |
| PAID / HELD / BLOCKED decisions | Planned: real on-chain | tx hashes in `evidence/attacks-*.json` |
| NEAR refusing direct transfer / other methods / revoked key | Planned: real (protocol) | raw RPC errors in `evidence/gate0.json` |
| Payments | Real **testnet** NEAR (no money value) | tx hashes |
| Demo agent "tricked" step | `scripted` mode = scripted (labelled). `llm` mode = real model, if an API key is set | `scripts/agent.js` output |
| Dashboard numbers | Real, read live from chain. No fake fallback data | `/` and `/activity` |
| Unit-test mocks | Mocks, only inside test files | `contract/` tests, `web` vitest |
| Mainnet | **Not used** | — |
| TEE / Shade Agent passport | **Not built** (roadmap) | — |
