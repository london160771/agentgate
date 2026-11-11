# PROJECT_STATE

> Progress log. Updated by the coding agent at the end of every phase. Newest entry at the top.
> If a ⛔ MANUAL STOP is active, its checklist sits right under this line.

## ⛔ MANUAL STOP B: launch (Adesope)
P0 build is done (Phases 1–4). The agent does not deploy. Do these in order:
1. **Deploy the web to Vercel** (you, not the agent): vercel.com → Add New → Project → import `london160771/agentgate` → **Root Directory: `web`** → Framework: Vite (build `npm run build`, output `dist`) → Deploy. Leave "Include files outside the root directory in the Build Step" **on** (the default): the app imports `scripts/lib/` and `config/seed.json`. No env vars needed (`VITE_NEAR_RPC` is optional).
2. **Run `/judge` once live**: open `<vercel-url>/judge`, press **Run all attacks**, check every row says as expected (J1 may say `BLOCKED_OVER_DAILY_CAP` if today's cap is used; that also passes). Then check `/`, `/agents`, `/activity` load numbers.
3. **Record the video** (judge path: `/` → `/judge` Run all → vault access keys on the explorer → `/agents` public key).
4. **Post on X**: tag @NEARProtocol, #NEARHackathon, attach the video.
5. **Fill the TODO links** in `README.md` (search `TODO(Adesope)`: Vercel URL ×2, video URL, X post URL). Send them to the agent or edit them yourself.
6. **Create the mainnet payout account** for the prize.
6b. **P1-a live check (owner buttons)**: put your owner account into MyNearWallet testnet with `near account export-account agentgate-ayo.testnet using-web-wallet network-config testnet` (it opens or prints a testnet.mynearwallet.com import link; open it in your browser). Then on the site press **Owner sign in**, allow pop-ups, go to `/activity` and press **Reject** on held payment #3 (or do it on camera for the video). The wallet pop-up shows the tx; confirm it. The row should disappear and a tx link appear.
7. **Submit the form before 16:00 UTC on 14 Nov 2026.**

## Current phase
**⛔ Manual Stop B: launch (Adesope)**. Phases 1–4 are done; the checklist is above. Adesope said "go p1a" (2026-11-11 15:02 UTC): **P1-a done** (owner buttons). P1-b and P1-c not started.

## Phase status
| Phase | Status | Commit | Checks |
|---|---|---|---|
| 1. Scaffold + contract | done | 959fa7f | `cargo test` 33/33 pass · fmt OK · clippy OK · `cargo near build` OK (198,680 bytes) |
| 2. Scripts + classifier | done | 7bdf80c | `node --test` 46/46 pass · 12 dry-runs exit 0 |
| ⛔ A. Gate 0 (Adesope) | **done: PASS** | ef878ce + evidence commit | Gate 0 4/4 PASS · Attack Suite 7/7 as expected · `node --test` 48/48 |
| 3. Web + Attack Lab | done | 55ce9ee | `npm run build` OK · `vitest` 21/21 · no hardcoded seed numbers |
| 4. README + proof docs | done | 7617c37 | numbers checked against `config/seed.json` + `evidence/`; tests re-run 33 / 48 / 21 pass |
| ⛔ B. Launch (Adesope) | **active** | | checklist at the top |
| P1-a. Owner actions in UI | done | 549a60d | `vitest` 29/29 · build OK · wallet flow checked up to the MyNearWallet sign page |

## Known facts
- Network: testnet only (HACKATHON.md Q-010, Q-008).
- The cloud sandbox **can** read and send to NEAR testnet RPC (checked 2026-11-11 in Phase 3: `get_stats` from Node and the built web app in headless Chromium both returned live vault data). Account creation, deploys and owner actions still run on Adesope's machine because they need the owner key.
- In this cloud sandbox `rustup target add wasm32-unknown-unknown` **works**, and `cargo install cargo-near --locked --no-default-features` works (default features need `libudev`). `cargo near build non-reproducible-wasm` builds the contract here.
- near-api-js 7.5.2 (latest stable) needs **Node ≥ 22.22.2** (its `engines` field). The PRD says Node 20+; the scripts follow near-api-js, so use Node 22.22+.
- near-sdk 5.30.1 refuses a plain native `cargo clippy` (it emits a compile_error telling you to use cargo-near). Working lint commands: `cargo clippy --all-targets -- -D warnings` (native, includes tests) and `cargo clippy --target wasm32-unknown-unknown -- -D warnings`.

## Log

### P1-a: Owner actions in the web app (2026-11-11, after "go p1a")
**Built**
- NEAR Wallet Selector 10.1.4 with the MyNearWallet module (testnet). **Owner sign in** in the navbar; the app reads `get_owner` and shows `owner` / `not the owner` next to the signed-in account.
- Sign-in asks for **no function-call key**, so every owner action opens the wallet pop-up to be confirmed (approving a held payment moves real money; a key stored in the browser could do that silently).
- `/activity`: **Approve: pay X NEAR** and **Reject** on each held payment. `/agents`: **Revoke this agent** on active agents. Buttons only render for the owner; each shows the tx link or the error (contract panics such as `ERR_NOT_OWNER` are read from the outcome). The CLI commands stay next to each held item.
- `lib/owner.js` (pure: allowed methods `approve_held` / `reject_held` / `revoke_agent`, 0 deposit, `GAS_OWNER` from `scripts/lib/chain.js`, outcome failure/hash parsing), `lib/wallet.js` (selector setup, sign in/out, `sendOwnerAction`), `components/Wallet.jsx` (provider, navbar control, notice, `OwnerButton`). The wallet code is a separate lazy chunk, so the first page load is unchanged (main JS 499 kB; wallet chunk 579 kB).

**Dependencies added (web)**: `@near-wallet-selector/core@10.1.4`, `@near-wallet-selector/my-near-wallet@10.1.4` (named in PRD P1-a), `buffer@6.0.3` (the wallet modules use Node's `Buffer` global; set in `lib/wallet.js`). `npm audit`: 10 low-severity advisories, all `elliptic` via the `@near-js/*` 2.x packages the wallet selector depends on; no fix without a breaking wallet-selector change.

**Files**: `web/package.json`, `web/package-lock.json`, `web/src/main.jsx`, `web/src/components/{Layout,Wallet}.jsx`, `web/src/lib/{owner,wallet}.js`, `web/src/pages/{Activity,Agents}.jsx`, `web/src/test/owner.test.js`, `README.md`, `REAL_VS_MOCKED.md`, `ROADMAP.md`, `PROJECT_STATE.md`.

**Checks (real output)**
- `cd web && npx vitest run` → `Test Files 5 passed · Tests 29 passed` (8 new in `owner.test.js`, outcomes there are mocks).
- `cd web && npm run build` → OK.
- Headless Chromium against `vite preview` (no keys used): signed out → no owner buttons; **Owner sign in** opens `https://testnet.mynearwallet.com/login/` with no `contract_id` (no key requested). With a MyNearWallet session for `agentgate-ayo.testnet` placed in localStorage: navbar shows `owner`, `/activity` shows Approve + Reject for held #3, `/agents` shows Revoke on api-buyer only. Pressing Approve opened `https://testnet.mynearwallet.com/sign`; the 194-byte borsh tx contains signer `agentgate-ayo.testnet`, receiver `vault.agentgate-ayo.testnet`, `approve_held`, `payment_id`. Closing the pop-up shows "User closed the window". As `someone-else.testnet`: no buttons and a "not the owner" notice. No page errors.
- Not checked here: a real signed owner tx from the web (needs the owner key in a wallet). That is step 6b of Manual Stop B.

### Phase 4: README story + proof docs (2026-11-11)
**Built**
- `README.md` final per PRD 12: story (Freysa, AIXBT, linked sources), insight, how it works + guarantee, the api-buyer key block (signer account, public and private key, "This key is public on purpose. Try to drain the vault."), "Try it in 60 seconds" (browser `/judge` path copied from the real `/judge` page, then the CLI path), Why NEAR table pointing to real functions (`add_agent` L63, `add_access_key_allowance` L94, `revoke_agent` L123, `request_spend` L174 in `contract/src/lib.rs`; `scripts/lib/classify.js`), Proof (test counts, Gate 0 table and Attack Suite table generated from the evidence JSON, all tx links), What's real, Honest limits (allowance and hold-queue max read from `config/seed.json`; vault still has its full-access key), Built at NEAR HACKATHON.
- `REAL_VS_MOCKED.md` filled from `evidence/` (every "Real" row links a raw output or explorer page; `agent.js --mode=llm` marked as not run against a model).
- `ROADMAP.md`: P1-a/b/c named as in PRD 11; added "store tx hash per payment" (found in Phase 3).
- Only `TODO(Adesope)` placeholders left: Vercel URL (×2), video URL, X post URL.

**Checks (real output)**
- Numbers: caps 0.5 / 0.6, allowance 0.25, hold queue 20 are inserted from `config/seed.json`; every tx hash and result in the README tables is generated from `evidence/gate0.json` and `evidence/attacks-2026-11-11T12-57-38Z.json`.
- "Try it": `node scripts/attacks.js --dry-run` and `--dry-run --only=J5` exit 0 and print the 7 / 1 attack plans; the browser steps match `web/src/pages/Judge.jsx`.
- Vercel-like build: with `scripts/node_modules` removed, `cd web && npm run build` still passes and vitest 21/21 (the web only needs its own `node_modules`).
- Tests re-run: `cargo test` 33 passed · `node --test` 48/48 · `npx vitest run` 21/21.
- Secrets: `git log -p --all` has only two `ed25519:` private keys, the api-buyer and old-bot demo keys. No owner or vault key in the repo or its history.

**Next**: ⛔ Manual Stop B (checklist at the top).

### Phase 3: Web dashboard + Attack Lab (2026-11-11)
**Built** (PRD 9, `web/`, React 19 + Vite 8 + Bootstrap 5 + react-router 7 + near-api-js 7, no backend)
- Shared code: the web imports `scripts/lib/{classify,attacks,format,config,chain}.js` and `config/seed.json` at build time, so the browser and `scripts/attacks.js` run the same attack definitions and classifier. `resolve.dedupe: ['near-api-js']` keeps one copy of near-api-js (the classifier's `instanceof` checks need that).
- RPC: `VITE_NEAR_RPC` (optional, `web/.env.example`) then fastnear, then rpc.testnet.near.org. Views fall back across the list; signed attack calls use one provider (same reason as the Gate 0 fix).
- **Layout**: red "REAL · NEAR TESTNET" banner on every page, navbar, footer with the vault account. If `config/seed.json` isn't seeded, a warning lists what is missing.
- **`/` Overview**: tagline, the problem in two lines (Freysa / AIXBT with source links), vault balance and paid / held / blocked / total requests from `get_stats`, "Try to break it →" button to `/judge`, badge linking the vault's access-key tab on NearBlocks testnet.
- **`/agents` Agents & Rules**: the api-buyer private key in a card with "This key is public on purpose. Try to drain the vault."; one card per agent from `get_agents` with public key, per-tx and daily cap, approved recipients, paid-today vs daily-cap bar, active / revoked chip.
- **`/activity` Activity**: HELD queue on top (from `get_held`) with the copy-paste `node scripts/owner.js approve|reject <id>` command next to each item (owner actions stay CLI-only); payment log newest first (from `get_payments`) with status chips and reason codes. The contract doesn't store tx hashes, so the log links to the vault's page on the explorer instead of per-row txs.
- **`/judge` Attack Lab**: numbered 60-second judge path, "Run all attacks" + one button per J1–J7, results table (attack, expected, actual, pass, proof = tx link or raw RPC error), live "today's total vs daily cap" meter refreshed after each attack.
- Loading and error states on every chain read; an RPC failure shows the error, never placeholder numbers. Mobile: no horizontal overflow on /agents, /activity, /judge at iPhone 13 width (Playwright).
- `vercel.json` SPA rewrite. Note for Manual Stop B: the app imports `../scripts/lib` and `../config`, so on Vercel set Root Directory = `web` **and** keep "Include files outside the root directory" on (Vercel's default), or build from the repo root.

**Dependencies added (web only)**: `react`, `react-dom`, `react-router-dom`, `bootstrap`, `near-api-js`, `vite`, `@vitejs/plugin-react` (Vite's React plugin, needed for JSX), `vitest`. All in the CLAUDE.md allowed list except `@vitejs/plugin-react`, which is part of the Vite + React setup.

**Files**: `web/{package.json,package-lock.json,vite.config.js,index.html,vercel.json,.env.example}`, `web/src/main.jsx`, `web/src/lib/{near,links,useChain,judge}.js`, `web/src/components/{Layout,ui}.jsx`, `web/src/pages/{Overview,Agents,Activity,Judge}.jsx`, `web/src/test/{classify,format,judge,no-hardcoded-numbers}.test.js`, `PROJECT_STATE.md`.

**Checks (real output)**
- `cd web && npm run build` → OK: `dist/assets/index-*.js 493.68 kB (gzip 153.94 kB)`, CSS 230.06 kB. One warning: `Module "util" has been externalized` from `generate-function` (pulled in by near-api-js's typed-contract helper, which the app doesn't use). Harmless.
- `cd web && npx vitest run` → `Test Files 4 passed · Tests 21 passed`. classify + format (shared libs), attack runner against a **mock** RPC context (unit test only), and `no-hardcoded-numbers`: no cap / allowance / funding amount, owner account or demo private key written in `web/src`.
- Live smoke test (not required by Phase 3, done because the sandbox can reach testnet): `vite preview` + headless Chromium. All four pages loaded live vault data with no page errors.
- **One real testnet tx was sent during that smoke test**: "Run J3" on `/judge` with the public api-buyer key → payment #10, `BLOCKED_OVER_TX_CAP` (1 NEAR, nothing moved). The vault log now has 11 entries; this is not in `evidence/`.

### ⛔ Manual Stop A: Gate 0 on testnet (2026-11-11, Adesope's machine, WSL Ubuntu)
**Accounts**: owner `agentgate-ayo.testnet` (faucet, 10 NEAR); `vault.agentgate-ayo.testnet` (3 NEAR); `api-provider`, `data-provider`, `hacker` `.agentgate-ayo.testnet` (0.1 NEAR each). Keys in his legacy keychain only.
**Deploy**: `bash scripts/deploy.sh` → wasm 198,614 bytes (Rust 1.99.1, cargo-near 0.23.0), deploy + `new` tx `4X9PpRtdhLhU2HBD3pWcTunPoy5MJyPwFB5F6Z9pqw1H`, `get_owner` = `agentgate-ayo.testnet`.
**Seed** (`evidence/seed-2026-11-11T12-46-08Z.json`): fund 5 NEAR, `add_agent` api-buyer `ed25519:z28Hcnsj7hVXok3Dd4mNXepDkpYQdqiDYXf2qs7eR2S`, `add_agent` old-bot `ed25519:6rGG6RmtyrnCLgmhbR3ejpXyEMdscqKsHrRp1WDfzdeZ`, `revoke_agent` old-bot. The vault's access-key list shows the api-buyer key as `FunctionCall { receiver_id: vault.agentgate-ayo.testnet, method_names: [request_spend], allowance: 0.25 NEAR }`. (The seed-time list still showed old-bot because it was read at `final` finality a moment before the delete landed; Gate 0 confirms it is gone.)
**Gate 0 run 1**: (a) PASS; (b)(c)(d) were refused by NEAR but reported FAIL because near-api-js's FailoverRpcProvider re-sent each refused tx to a second RPC and wrapped the error (`FailoverRpcError: Exceeded 2 providers`). (b) with 1 NEAR was refused as `AccessKeyNotEnoughAllowanceActionError` (amount > 0.25 allowance is checked before permissions).
**Fixes** (ef878ce): single RPC provider; classifier unwraps `FailoverRpcError`; J5 transfer 1 → 0.01 NEAR (approved by Adesope; PRD 8 J5 row updated).
**Gate 0 run 2** (`evidence/gate0.json`): **PASS** 4/4.
| check | expected | actual | raw |
|---|---|---|---|
| (a) request_spend | OK_PAID | PAID | tx `2zNeXx6bcdbVrBcE2XqRwUJybLd7X338KnonCi58bfaH` |
| (b) direct Transfer 0.01 | TRANSFER_NOT_ALLOWED | TRANSFER_NOT_ALLOWED | `AccessKeyRequiresFullAccessActionError` |
| (c) update_rules | METHOD_NOT_ALLOWED | METHOD_NOT_ALLOWED | `AccessKeyMethodNameMismatchActionError` |
| (d) revoked key | KEY_NOT_FOUND | KEY_NOT_FOUND | `AccessKeyDoesNotExistError` |
Classifier needed no change: all three real error names were already mapped.
**Attack Suite** (`evidence/attacks-2026-11-11T12-57-38Z.json`): 7/7 as expected. J1 PAID · J2 HELD (payment #3, 5 NEAR to hacker) · J3 BLOCKED_OVER_TX_CAP · J4 PAID ×1, BLOCKED_OVER_DAILY_CAP ×4, today's total 0.53 ≤ 0.6 NEAR · J5/J6/J7 REFUSED_BY_NEAR (TRANSFER_NOT_ALLOWED / METHOD_NOT_ALLOWED / KEY_NOT_FOUND).
**Committed**: `config/seed.json` with the two demo keys (public on purpose; api-buyer is capped by the vault, old-bot is revoked) and the 3 evidence files. No owner or vault key in the repo.
**Test tweak**: config tests build their own template so they pass with the seeded config (48/48).

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
