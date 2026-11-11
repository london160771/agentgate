# PROJECT_STATE

> Progress log. Updated by the coding agent at the end of every phase. Newest entry at the top.
> If a ⛔ MANUAL STOP is active, its checklist sits right under this line.

## ⛔ MANUAL STOP A: Gate 0 on Adesope's machine (active)
Phases 1 and 2 are done and pushed. The cloud sandbox can't reach NEAR, so these steps run on your machine, from the repo root:

1. Install near-cli-rs and cargo-near, the wasm target and Node 22.22+ (exact commands in `scripts/setup-accounts.md`, step 0). Then `cd scripts && npm install && cd ..`.
2. Follow `scripts/setup-accounts.md`: faucet owner + 4 sub-accounts (vault with 3 NEAR, api-provider / data-provider / hacker with 0.1 NEAR each), all keys saved to the legacy keychain.
3. Fill `ownerAccountId` in `config/seed.json` (only that field). Check: `node scripts/seed.js --dry-run` shows your real account ids.
4. `bash scripts/deploy.sh`
5. `node scripts/seed.js` (writes the two demo keys into `config/seed.json` and `evidence/seed-*.json`)
6. `node scripts/gate0.js` → paste the whole output back in the chat, and commit/push `config/seed.json` + `evidence/` (or paste `evidence/gate0.json`).
7. `node scripts/attacks.js` → paste the whole output back (and `evidence/attacks-*.json`).

Before committing, check `git diff --cached`: only `config/seed.json` (demo keys) and `evidence/` should change. Never add anything from `~/.near-credentials`.

After you paste the results: if Gate 0 passes, the classifier gets matched to the real error names, the evidence is saved and Phase 3 starts. If Gate 0 fails, the agent stops and reports; no redesign.

### Gate 0 progress (Adesope's machine, WSL Ubuntu)
- Done: tools installed, `npm test` 46/46 on his machine; accounts created (owner `agentgate-ayo.testnet`, vault, api-provider, data-provider, hacker); `deploy.sh` OK (wasm 198,614 bytes, `get_owner` = `agentgate-ayo.testnet`); `seed.js` OK (api-buyer key `ed25519:z28Hcnsj7hVXok3Dd4mNXepDkpYQdqiDYXf2qs7eR2S` = FunctionCall → vault, `[request_spend]`, 0.25 NEAR allowance; old-bot revoked).
- Gate 0 run 1: (a) PASS (OK_PAID). (b)(c)(d) were refused by NEAR exactly as designed (raw: `AccessKeyNotEnoughAllowanceActionError`, `AccessKeyMethodNameMismatchActionError`, `AccessKeyDoesNotExistError`), but reported FAIL because near-api-js's FailoverRpcProvider re-sent each refused tx to the second RPC and wrapped the real error in `FailoverRpcError: Exceeded 2 providers`. Old-bot key confirmed gone from the vault.
- Fixes: scripts use a single RPC provider; the classifier unwraps `FailoverRpcError`; J5 / Gate 0 (b) transfer is 0.01 NEAR (was 1 NEAR, more than the key's 0.25 allowance, so NEAR refused it on allowance before reaching the permission check). PRD section 8 J5 row updated to match; Adesope approved 0.01 NEAR (2026-11-11).

## Current phase
**⛔ Manual Stop A: Gate 0** (waiting for Adesope). Next after it: Phase 3, web dashboard + Attack Lab.

## Phase status
| Phase | Status | Commit | Checks |
|---|---|---|---|
| 1. Scaffold + contract | done | 959fa7f | `cargo test` 33/33 pass · fmt OK · clippy OK · `cargo near build` OK (198,680 bytes) |
| 2. Scripts + classifier | done | see log | `node --test` 46/46 pass · 12 dry-runs exit 0 |
| ⛔ A. Gate 0 (Adesope) | **active** | | |
| 3. Web + Attack Lab | not started | | |
| 4. README + proof docs | not started | | |
| ⛔ B. Launch (Adesope) | waiting | | |

## Known facts
- Network: testnet only (HACKATHON.md Q-010, Q-008).
- The cloud sandbox can't reach NEAR RPC, the faucet or the explorer.
- In this cloud sandbox `rustup target add wasm32-unknown-unknown` **works**, and `cargo install cargo-near --locked --no-default-features` works (default features need `libudev`). `cargo near build non-reproducible-wasm` builds the contract here.
- near-api-js 7.5.2 (latest stable) needs **Node ≥ 22.22.2** (its `engines` field). The PRD says Node 20+; the scripts follow near-api-js, so use Node 22.22+.
- near-sdk 5.30.1 refuses a plain native `cargo clippy` (it emits a compile_error telling you to use cargo-near). Working lint commands: `cargo clippy --all-targets -- -D warnings` (native, includes tests) and `cargo clippy --target wasm32-unknown-unknown -- -D warnings`.

## Log

### Phase 2: Scripts + shared classifier (2026-11-11)
**Built** (all of PRD 7 + 8, `scripts/`, Node ESM)
- `lib/classify.js` (shared with web): SpendResult → PAID / HELD / BLOCKED + code; RPC errors → `REFUSED_BY_NEAR: METHOD_NOT_ALLOWED | TRANSFER_NOT_ALLOWED | KEY_NOT_FOUND`; anything else → `ERROR` with the raw message. Matches the real near-api-js 7.5.2 error classes (`AccessKeyMethodNameMismatchActionError`, `AccessKeyRequiresFullAccessActionError`, `AccessKeyDepositWithFunctionCallActionError`, `AccessKeyNotFoundActionError`, `AccessKeyDoesNotExistError`), plus their messages and raw RPC kinds so it still works when the web bundle minifies class names. To be re-checked against the real errors in `evidence/gate0.json`.
- `lib/attacks.js` (shared with web): J1–J7 definitions (amounts from PRD 8), per-attack pass rules, and a runner that takes a chain context, so the same code runs in Node and in the browser. J4 also reads `get_agent` and checks today's total ≤ daily cap.
- `lib/format.js` (shared): exact NEAR ↔ yocto with BigInt, display formatting, NearBlocks testnet links.
- `lib/config.js` (shared): validates `config/seed.json` (template / owner / seeded stages) and resolves `vault.<owner>.testnet` etc. from `ownerAccountId`, so Adesope fills one field. Caps and allowance come only from the config.
- `lib/chain.js`: near-api-js 7 wiring (failover RPC: `NEAR_RPC` → fastnear → rpc.testnet.near.org), signed calls return `{ result, txHash }`, attack context for the two public demo keys (both sign as the vault account).
- `lib/node.js`: config loading, owner key lookup in `~/.near-credentials/testnet/` (near-cli-rs legacy keychain, both file layouts; `NEAR_CREDENTIALS_DIR` override), evidence writer, flags. Never prints owner/vault private keys.
- Scripts: `deploy.sh`, `seed.js` (funds vault, mints api-buyer + old-bot keys via `add_agent`, revokes old-bot, writes demo keys, refuses to re-seed without `--force`), `gate0.js` (checks a–d + vault access-key list → `evidence/gate0.json`, exit 1 on FAIL), `attacks.js` (`--only=J4` supported → `evidence/attacks-<ts>.json`), `owner.js` (status / approve / reject / reject-all-held / revoke), `agent.js` (`scripted` story labelled `[scripted]`; `llm` mode via any OpenAI-compatible endpoint with one `pay` tool, using `fetch`, no extra SDK).
- `scripts/setup-accounts.md` (docs only), `.env.example` (LLM vars + optional `NEAR_RPC`).
- Dependencies added: `near-api-js@7.5.2`, `dotenv@17.4.2` (both allowed by CLAUDE.md). No others.

**Files**: `scripts/package.json`, `scripts/package-lock.json`, `scripts/lib/{classify,attacks,format,config,chain,node}.js`, `scripts/{seed,gate0,attacks,owner,agent}.js`, `scripts/deploy.sh`, `scripts/setup-accounts.md`, `scripts/test/{classify,attacks,format,config,chain,dry-run}.test.js`, `.env.example`, `PROJECT_STATE.md`.

**Checks (real output)**
- `cd scripts && node --test` → `# tests 46 · # pass 46 · # fail 0`.
  - classify (9): statuses/codes, unexpected result → ERROR, each REFUSED_BY_NEAR code from the real near-api-js error classes (unit-test instances, not live errors), minified names / raw RPC JSON, contract panic → ERROR with raw text, serializeError.
  - attacks (8): J1–J7 against a **mock** vault (named as a mock, test file only): all refused as expected, J4 = `PAID ×1, BLOCKED_OVER_DAILY_CAP ×4` with total 0.51 ≤ 0.6; J1 with cap used, J2 with full queue; a broken mock vault fails J2–J4; a succeeding transfer/call is reported, network errors become ERROR.
  - format (5), config (8, incl. contract `LOG_MAX`/`HOLD_QUEUE_MAX` == `logMax`/`holdQueueMax`), chain wiring offline (3).
  - dry-run (13): every network script with `--dry-run` exits 0, prints a plan, writes no evidence and doesn't change the config; a real run refuses while `ownerAccountId` is a placeholder.
- Dry-run outputs (template config, so accounts show `<owner>` placeholders):

```
$ node scripts/seed.js --dry-run
1. <set by Adesope> → Transfer 5 NEAR to vault.<owner>.testnet
2. generate a new ed25519 keypair for api-buyer
3. <set by Adesope> → vault.<owner>.testnet.add_agent({"public_key":"<new api-buyer public key>","name":"api-buyer","per_tx_cap":"500000000000000000000000","daily_cap":"600000000000000000000000","allowed":["api-provider.<owner>.testnet","data-provider.<owner>.testnet"],"allowance":"250000000000000000000000"})
4. generate a new ed25519 keypair for old-bot
5. <set by Adesope> → vault.<owner>.testnet.add_agent({... "name":"old-bot", same rules ...})
6. <set by Adesope> → vault.<owner>.testnet.revoke_agent({"public_key":"<new old-bot public key>"})
7. write demoKeys (both keypairs, public on purpose) into config/seed.json
8. write evidence/seed-<timestamp>.json (tx hashes, public keys only)

$ node scripts/gate0.js --dry-run
(a) api-buyer key: request_spend(api-provider.<owner>.testnet, 0.01 NEAR, "API credits")   expect: OK_PAID
(b) api-buyer key: Transfer 1 NEAR from the vault to hacker.<owner>.testnet                 expect: REFUSED_BY_NEAR: TRANSFER_NOT_ALLOWED
(c) api-buyer key: update_rules({... caps 1000 NEAR, allowed [hacker] ...})                 expect: REFUSED_BY_NEAR: METHOD_NOT_ALLOWED
(d) old-bot key: request_spend(api-provider.<owner>.testnet, 0.01 NEAR, "old bot wakes up")  expect: REFUSED_BY_NEAR: KEY_NOT_FOUND
(info) view access keys of the vault; then write evidence/gate0.json

$ node scripts/attacks.js --dry-run
J1 request_spend(api-provider, 0.01)        expect PAID (or BLOCKED_OVER_DAILY_CAP if today's cap is already used)
J2 request_spend(hacker, 5)                 expect HELD (or BLOCKED_HOLD_QUEUE_FULL)
J3 request_spend(api-provider, 1)           expect BLOCKED_OVER_TX_CAP
J4 5 × request_spend(data-provider, 0.5)    expect some/none PAID, rest BLOCKED_OVER_DAILY_CAP; today's total ≤ daily cap
J5 Transfer 1 NEAR vault → hacker           expect REFUSED_BY_NEAR: TRANSFER_NOT_ALLOWED
J6 update_rules(...)                        expect REFUSED_BY_NEAR: METHOD_NOT_ALLOWED
J7 old-bot request_spend(api-provider, 0.01) expect REFUSED_BY_NEAR: KEY_NOT_FOUND

$ node scripts/owner.js status --dry-run      → view get_stats, get_agents, get_held
$ node scripts/owner.js reject-all-held --dry-run → view get_held, then reject_held for each
$ node scripts/agent.js --dry-run            → [scripted] pay API 0.01 → injected instruction → [scripted] pay hacker 5, expect HELD
$ node scripts/agent.js --mode=llm --dry-run → prints endpoint/model/key status (not the key) and the pay tool schema
$ bash scripts/deploy.sh --dry-run
1. (cd contract && cargo near build non-reproducible-wasm)
2. near contract deploy vault.<owner>.testnet use-file .../contract/target/near/agentgate_vault.wasm with-init-call new json-args {"owner":"<set_by_Adesope>"} prepaid-gas '100.0 Tgas' attached-deposit '0 NEAR' network-config testnet sign-with-legacy-keychain send
3. near contract call-function as-read-only vault.<owner>.testnet get_owner json-args {} network-config testnet now
```
(Outputs shortened for J-lines; full text comes from the commands above. All 12 dry-run commands exited 0.)
- Contract wasm (finishing the Phase 1 item): `cargo install cargo-near --locked --no-default-features` → `Installed package cargo-near v0.23.0`. `cargo near build non-reproducible-wasm` → `Contract successfully built!`, `agentgate_vault.wasm` 198,680 bytes, sha256 `95b4a2ba5a9272704cc191c661d37d141974601219f4d2b1a623a669e667f4bc` (cloud build, Rust 1.97). `deploy.sh` rebuilds on your machine anyway. At ~1 NEAR per 100 KB the code needs ~2 NEAR of storage, so the vault is created with 3 NEAR.

**Problems / notes**
- Nothing ran against testnet (sandbox has no NEAR RPC). The REFUSED_BY_NEAR mapping is built from near-api-js's own error classes and must be confirmed by Gate 0.
- If the testnet node ever rejects the wasm (newer-Rust wasm features), build with the reproducible Docker build of cargo-near on your machine; we have not seen this, it is only the known NEAR gotcha.

**Next**: ⛔ Manual Stop A (checklist at the top).

### Phase 1: Repo scaffold + contract core (2026-11-11)
**Built**
- Repo layout: `contract/`, `config/seed.json` (template, exactly PRD 5), `evidence/` (README only), MIT `LICENSE`, `.gitignore` (target/, node_modules/, .env, credentials, web/dist).
- Contract `agentgate-vault` (Rust, near-sdk 5.30.1), all of PRD 6:
  - State: owner, agents (`IterableMap<PublicKey, Agent>`), payments ring buffer (`LookupMap<slot, Payment>`, slot = id % 100), held (`IterableMap<u64, Payment>`), next_id, status counters.
  - Methods: `new`, `add_agent` (vault adds a Function Call Key to itself: receiver = vault, method = `request_spend`, allowance from args), `update_rules`, `revoke_agent` (active=false + `delete_key`), `request_spend`, `approve_held` (skips caps, checks balance, does not touch `paid_today`), `reject_held`, views `get_owner/get_agents/get_agent/get_payments/get_held/get_stats`.
  - `request_spend` runs checks 1–9 in the PRD 6.3 order; checks 1–2 panic (`ERR_NOT_VAULT_KEY`, `ERR_UNKNOWN_AGENT_KEY`), checks 3–8 return a result and log it. Reason codes, `retryable` and `next_action` exactly as the PRD table. Every recorded call logs `{"standard":"agentgate","event":"spend","data":{...}}` (approve/reject log `"approve"` / `"reject"`).
  - `storage_reserve` = storage used × byte cost + 0.5 NEAR.
  - Known behaviour documented in code (not fixed): transfer to a non-existent named account refunds the vault but `paid_today` stays counted.
- Choices inside the PRD's room (documented here so the web/scripts match):
  - JSON statuses are upper case: `PAID | HELD | BLOCKED | APPROVED | REJECTED`. Approve/reject set `code` to `APPROVED_BY_OWNER` / `REJECTED_BY_OWNER` (no new `request_spend` codes).
  - `get_payments(from_index?, limit?)`: oldest kept entry first; index 0 = oldest of the last 100.
  - `get_agent(s)` shows `paid_today = 0` when the stored day is not today (the stored value resets on the next spend).
  - `get_stats` returns `paid, held, blocked, approved, rejected` (all-time counts), `held_pending`, `total_paid`, `total_approved`, `vault_balance`, `total_requests`.
  - `LOG_MAX = 100` and `HOLD_QUEUE_MAX = 20` are contract constants; a script test checks they equal `logMax` / `holdQueueMax` in `config/seed.json`.
  - Extra guards: max 10 recipients, allowance must be > 0, `revoke_agent` on an already revoked agent panics `ERR_ALREADY_REVOKED`, reason cut to 140 chars (char-safe).

**Files**: `.gitignore`, `LICENSE`, `config/seed.json`, `evidence/README.md`, `contract/Cargo.toml`, `contract/Cargo.lock`, `contract/src/lib.rs`, `contract/src/types.rs`, `contract/src/tests.rs`, `PROJECT_STATE.md`.

**Checks (real output)**
- `cargo fmt --check` → OK (no output).
- `cargo clippy --all-targets -- -D warnings` → `Finished`, 0 warnings. `cargo clippy --target wasm32-unknown-unknown -- -D warnings` → `Finished`, 0 warnings. (Plain `cargo clippy -- -D warnings` is refused by near-sdk 5.30's native guard, see Known facts.)
- `cargo test` → `test result: ok. 33 passed; 0 failed`.
  - Owner-only (5): add_agent, update_rules, revoke, approve_held, reject_held reject non-owners.
  - add_agent (4): stores agent + mints FC key (receipt checked: receiver = vault, methods = [request_spend], allowance), duplicate fails, >10 recipients fails, update_rules works.
  - Check order + codes (10): ERR_NOT_VAULT_KEY, ERR_UNKNOWN_AGENT_KEY, OK_PAID (transfer receipt checked), BLOCKED_AGENT_INACTIVE before others, BLOCKED_ZERO_AMOUNT before recipient, unknown recipient + over cap = HELD, BLOCKED_OVER_TX_CAP, tx cap before daily cap, BLOCKED_OVER_DAILY_CAP (exact 0.6 boundary), BLOCKED_INSUFFICIENT_FUNDS with storage reserve.
  - Held (6): held uses no budget, approve pays + status APPROVED (skips caps), approve checks balance, reject removes, reject unknown fails, 21st held → BLOCKED_HOLD_QUEUE_FULL.
  - Daily reset, revoke deletes key + blocks, revoke twice fails, ring buffer keeps last 100, reason cut to 140, JSON event logged, stats counts (7).
  - Invariant property test: seeded xorshift, 500 random requests (random amounts 0–0.799 NEAR, 4 recipients incl. hacker and a random account, day jumps, owner clearing the held queue). Asserted: per day total PAID ≤ daily cap, every PAID ≤ per-tx cap, every PAID recipient in `allowed`; the run must produce OK_PAID, HELD, OVER_TX_CAP and OVER_DAILY_CAP.
- wasm: `rustup target add wasm32-unknown-unknown` → installed. `cargo build --target wasm32-unknown-unknown --release` → compiles (460,409 bytes, unoptimized; compile check only, **not** for deploy). `cargo near build`: `cargo install cargo-near --locked` failed here (`hidapi` needs `libudev`); retrying with `--no-default-features`, result goes in the Phase 2 entry.

**Problems**: none open in the contract.

**Next**: Phase 2 (scripts + shared classifier).
