# PROJECT_STATE

> Progress log. Updated by the coding agent at the end of every phase. Newest entry at the top.
> If a ⛔ MANUAL STOP is active, its checklist sits right under this line.

## Current phase
**Phase 2: Scripts + shared classifier**: in progress

## Phase status
| Phase | Status | Commit | Checks |
|---|---|---|---|
| 1. Scaffold + contract | done | see log | `cargo test` 33/33 pass · fmt OK · clippy OK |
| 2. Scripts + classifier | in progress | | |
| ⛔ A. Gate 0 (Adesope) | waiting | | |
| 3. Web + Attack Lab | not started | | |
| 4. README + proof docs | not started | | |
| ⛔ B. Launch (Adesope) | waiting | | |

## Known facts
- Network: testnet only (HACKATHON.md Q-010, Q-008).
- The cloud sandbox can't reach NEAR RPC, the faucet or the explorer.
- In this cloud sandbox `rustup target add wasm32-unknown-unknown` **works**. `cargo install cargo-near` with default features fails (needs `libudev`); see Phase 1 notes.
- near-sdk 5.30.1 refuses a plain native `cargo clippy` (it emits a compile_error telling you to use cargo-near). Working lint commands: `cargo clippy --all-targets -- -D warnings` (native, includes tests) and `cargo clippy --target wasm32-unknown-unknown -- -D warnings`.

## Log

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
