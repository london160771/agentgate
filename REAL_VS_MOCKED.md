# REAL vs MOCKED

Filled from `evidence/` on 2026-11-11. Every "Real" row points to a raw output or an on-chain page.

| Part | Status | Proof |
|---|---|---|
| Vault contract | **Real**, deployed on NEAR testnet at `vault.agentgate-ayo.testnet` | [explorer](https://testnet.nearblocks.io/address/vault.agentgate-ayo.testnet) · deploy tx [`4X9PpRtd…`](https://testnet.nearblocks.io/txns/4X9PpRtdhLhU2HBD3pWcTunPoy5MJyPwFB5F6Z9pqw1H) |
| Agent keys minted by the contract (Function Call Keys) | **Real**: the vault's key list shows the api-buyer key as `FunctionCall`, receiver = the vault, method = `request_spend`, allowance 0.25 NEAR | `vaultAccessKeys` in [`evidence/gate0.json`](evidence/gate0.json) · [access keys on explorer](https://testnet.nearblocks.io/address/vault.agentgate-ayo.testnet?tab=accesskeys) |
| PAID / HELD / BLOCKED decisions | **Real**, made on-chain by the contract | tx hashes in [`evidence/attacks-2026-11-11T12-57-38Z.json`](evidence/attacks-2026-11-11T12-57-38Z.json) |
| NEAR refusing a direct transfer, other methods, and a revoked key | **Real**, refused by the NEAR protocol | raw RPC errors (`AccessKeyRequiresFullAccessActionError`, `AccessKeyMethodNameMismatchActionError`, `AccessKeyDoesNotExistError`) in [`evidence/gate0.json`](evidence/gate0.json) |
| Revoking a key | **Real**: `revoke_agent` deleted the old-bot key | revoke tx in [`evidence/seed-2026-11-11T12-46-08Z.json`](evidence/seed-2026-11-11T12-46-08Z.json), then J7 refused |
| Payments | Real **testnet** NEAR (no money value) | tx hashes above |
| Dashboard numbers | **Real**, read live from the vault over public testnet RPC. If RPC fails the page shows the error, never fallback numbers | `web/src/lib/near.js` |
| `/judge` Attack Lab | **Real** testnet transactions, signed in the browser with the public demo keys; same attack code as `scripts/attacks.js` | `scripts/lib/attacks.js` |
| Demo agent "tricked" step | `node scripts/agent.js --mode=scripted`: **scripted**, and labelled `[scripted]` in its output. `node scripts/agent.js --mode=llm`: calls a real model through any OpenAI-compatible endpoint set in `.env`; written and dry-run only, not run against a model yet | `scripts/agent.js` |
| Unit-test mocks | **Mocks**, only inside test files: a mock vault in `scripts/test/attacks.test.js`, a mock RPC context in `web/src/test/judge.test.js`, near-sdk's testing env in `contract/src/tests.rs` | test files |
| Owner actions (approve / reject / revoke) | **Real**: CLI (`scripts/owner.js`) and, since P1-a, web buttons signed through NEAR Wallet Selector + MyNearWallet. The web flow was checked up to the wallet's sign page (the request carries the owner as signer, the vault as receiver and the right method); a confirmed web-signed tx is still to be done by Adesope | `scripts/owner.js` · `web/src/lib/wallet.js` |
| Mainnet | **Not used** | — |
| Vault lock (removing the vault's full-access key) | **Real**: run on testnet 2026-11-11 18:17 UTC; the vault now has no full-access key, only the api-buyer `FunctionCall` key | [`evidence/lock-2026-11-11T18-17-59Z.json`](evidence/lock-2026-11-11T18-17-59Z.json) · tx [`8mo1vVL7…`](https://testnet.nearblocks.io/txns/8mo1vVL7ZKyTHdGWSJVwjLviEMxsgKV13mJUP1M6WPzV) |
| TEE / Shade Agent passport | **Not built** (roadmap, P1) | — |
