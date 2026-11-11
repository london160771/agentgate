# CLAUDE.md: rules for coding agents on AgentGate

Read this file, then **PRD.md** (the source of truth), then **PROJECT_STATE.md** (where we are), before changing anything.

## How to work
1. Find the current phase in PROJECT_STATE.md. Never rebuild a phase marked done. Check the repo first: git log, files, tests. The repo is the truth, not memory.
2. Build only what the PRD says for that phase. If something isn't in the PRD, it goes in ROADMAP.md, not in the code.
3. Run the phase's checks. Fix failures inside the PRD's scope.
4. Update PROJECT_STATE.md: what was built, files changed, checks run with real results (counts, outputs), problems, next phase.
5. Commit with a clear message (`phase-N: <what>`) and push to `main`.
6. Go straight to the next phase. **Don't stop to ask for approval between phases.**

## When to stop (only these)
- A ⛔ MANUAL STOP in the PRD is reached. Write the checklist at the top of PROJECT_STATE.md, push, and end with a short message saying exactly what Adesope must do.
- A check fails and the only fix would break the PRD (new feature, different design, different tool). Stop, explain, propose options.
- A secret or `.env` value is needed.
- P1 work: never start it unless Adesope says "go P1".

## Hard rules
- **Never deploy.** No testnet deploys and no Vercel deploys. Adesope runs deploy scripts himself. Writing deploy scripts is fine.
- **Never commit secrets.** The only keys allowed in the repo are the two demo agent Function Call Keys in `config/seed.json` (api-buyer, old-bot), and only after `seed.js` creates them. Owner and vault full-access keys never touch the repo. Check `git diff --cached` before every commit.
- **No fake data.** No mocked numbers in the UI or README. Unit-test mocks stay in test files and are named as mocks.
- **No claims without proof.** Write test counts only after they pass. "Works" means a check was run.
- **One source for numbers:** `config/seed.json` and `evidence/`. Don't hardcode caps or amounts elsewhere.
- **Don't change the contract's check order or reason codes** (PRD 6.3) without Adesope.
- **No Tailwind.** Use Bootstrap 5.
- **No new dependencies** beyond near-sdk, near-api-js, React, Vite, Bootstrap, react-router, vitest and dotenv, unless needed to meet the PRD. Note any you add in PROJECT_STATE.
- Keep code simple and readable. Small files, clear names, comments where NEAR behaviour is surprising.

## Environment facts (cloud)
- The cloud sandbox **cannot reach NEAR RPC, the faucet or the explorer**. Anything that needs the network is written and dry-run here, then run by Adesope (Manual Stops).
- crates.io and npm work. The wasm target may not install (`rustup target add` may be blocked). If so, unit tests still run on the native target. Record "wasm build: run locally" and move on.

## Commands
```bash
# contract
cd contract && cargo fmt --check && cargo clippy -- -D warnings && cargo test
cargo near build non-reproducible-wasm     # local machine
# scripts
cd scripts && npm install && node --test
node scripts/<name>.js --dry-run
# web
cd web && npm install && npm run build && npx vitest run
```

## NEAR gotchas
- Function Call Keys can't attach a deposit. That's why `request_spend` and owner methods are not payable.
- `request_spend` must check `env::predecessor_account_id() == env::current_account_id()`. Agent keys live on the vault account itself, so their calls come from the vault account.
- Identify the agent with `env::signer_account_pk()`.
- Use near-sdk 5.x Promise helpers for keys (`add_access_key_allowance`, `delete_key`). Check the exact signatures in the installed near-sdk docs, as names changed between versions.
- Rule failures inside `request_spend` must **return** a result, not panic. A panic rolls back the log entry.
- Newer Rust can emit wasm features older nodes reject. Build with `cargo near build`, not a raw `cargo build --target wasm32`.
- Day index = `block_timestamp / 86_400_000_000_000` (UTC days).

## Report format (end of every phase)
Files changed · checks run + results · commit hash · what's next (or the manual checklist).
