# PRD: AgentGate (NEAR Hackathon MVP)

> **This file is the single source of truth.** If code and PRD disagree, the PRD wins. If the PRD is wrong, stop and ask Adesope. Don't guess.
> Hackathon: NEAR HACKATHON · Track: **AI Security & Defense** (also **Agent Economy**) · Deadline **14 Nov 2026, 23:59 UTC** · Internal cutoff **14 Nov, 16:00 UTC**
> Network: **NEAR testnet only**

---

## 1. Product in one paragraph
AgentGate is a NEAR vault for AI agents. The owner funds a vault contract and the vault **mints its own agent keys**. Each key is a NEAR Function Call Key that can only call `request_spend` on the vault. The agent asks to pay and the contract decides: **PAID** (inside the rules), **HELD** (unknown recipient, waits for the owner) or **BLOCKED** (over a cap). The NEAR protocol itself stops the agent key from sending NEAR directly or calling any other method. The owner can revoke a key in one transaction.

**Tagline:** The AI can be fooled. The money can't.
**Second line:** Give your agent a key you could post on X.

## 2. Core guarantee (invariant)
> Money only leaves the vault to an approved recipient (or to a held recipient the owner approved), and for each agent, `paid_today <= daily_cap` and every single payment `<= per_tx_cap`, **no matter who holds the agent key.**

Protocol-level parts (we don't write code for these, we prove them):
- An agent key cannot attach NEAR, so it cannot transfer NEAR directly.
- An agent key can only call `request_spend` on the vault account.

## 3. Goals and non-goals
**Goals**
- G1: A Rust vault contract that enforces the invariant, fully unit-tested.
- G2: The contract mints and deletes its own Function Call Keys.
- G3: Scripts that deploy, seed, run Gate 0, run the attack suite and run the demo agent.
- G4: A web dashboard and a `/judge` Attack Lab with no backend and no signup.
- G5: A README story that a judge or AI screener can follow, "do X, see Y".

**Non-goals (do not build)**
Mainnet deploy, reputation scores, scam databases, cross-chain / Chain Signatures, NEAR Intents, fungible tokens (NEP-141), multi-agent swarms, owner wallet login in the UI (P1 only), a backend server, a database, mobile app, Tailwind.

## 4. Users
- **Developer running a paying agent:** wants a budget without giving away the wallet.
- **Owner:** sets the rules, approves or rejects held payments, revokes keys. In the MVP this is done from CLI scripts.
- **Judge:** opens `/judge`, clicks one button, sees each attack refused with proof. No signup, no wallet.

## 5. Accounts and seed (single source: `config/seed.json`)
All numbers below come from `config/seed.json`. Scripts, web and README must read or copy from this file. Never hardcode them anywhere else.

```json
{
  "network": "testnet",
  "ownerAccountId": "<set by Adesope>",
  "vaultAccountId": "vault.<owner>.testnet",
  "recipients": {
    "apiProvider": "api-provider.<owner>.testnet",
    "dataProvider": "data-provider.<owner>.testnet",
    "hacker": "hacker.<owner>.testnet"
  },
  "agents": {
    "apiBuyer": {
      "name": "api-buyer",
      "perTxCapNear": "0.5",
      "dailyCapNear": "0.6",
      "allowed": ["apiProvider", "dataProvider"],
      "keyAllowanceNear": "0.25"
    },
    "oldBot": { "name": "old-bot", "revoked": true }
  },
  "demoKeys": {
    "apiBuyerPublicKey": "<filled after seeding>",
    "apiBuyerPrivateKey": "<filled after seeding — PUBLIC ON PURPOSE>",
    "oldBotPublicKey": "<filled after seeding>",
    "oldBotPrivateKey": "<filled after seeding — PUBLIC ON PURPOSE, key is revoked>"
  },
  "vaultFundingNear": "5",
  "holdQueueMax": 20,
  "logMax": 100
}
```

- All recipient accounts are Adesope's own sub-accounts, so money never leaves his circle. This includes `hacker`.
- Only the two **demo agent Function Call Keys** may ever be committed. Owner and vault full-access keys are **never** committed.

## 6. Contract spec (Rust, `contract/`)
**Toolchain:** Rust stable, `near-sdk` 5.x (latest 5.x on crates.io), built with `cargo near build`. Unit tests use near-sdk's `unit-testing` feature with `testing_env!`.

### 6.1 State
```
owner: AccountId
agents: map PublicKey -> Agent
payments: ring buffer of the last `logMax` (100) Payment records
held: map payment_id -> Payment (max `holdQueueMax` = 20 pending)
next_id: u64
```
```
Agent {
  name: String,
  public_key: PublicKey,
  per_tx_cap: NearToken,
  daily_cap: NearToken,
  allowed: Vec<AccountId>,      // small list, max 10
  day_index: u64,               // block_timestamp_ns / 86_400_000_000_000
  paid_today: NearToken,
  active: bool,
  created_at: u64,
}
Payment {
  id: u64,
  agent_key: PublicKey,
  agent_name: String,
  to: AccountId,
  amount: NearToken,
  reason: String,               // max 140 chars, cut if longer
  status: Paid | Held | Blocked | Approved | Rejected,
  code: String,                 // reason code, see 6.3
  at: u64,                      // block timestamp ns
}
```

### 6.2 Methods
| Method | Who can call | Behaviour |
|---|---|---|
| `new(owner)` | deployer, once | Sets the owner |
| `add_agent(public_key, name, per_tx_cap, daily_cap, allowed, allowance)` | owner only | Saves the agent, then `Promise::new(current_account).add_access_key_allowance(public_key, allowance, current_account, "request_spend")`. Fails if the key already exists |
| `update_rules(public_key, per_tx_cap, daily_cap, allowed)` | owner only | Changes the rules. Agent keys can't reach this (protocol) |
| `revoke_agent(public_key)` | owner only | `active = false`, then `Promise::new(current_account).delete_key(public_key)` |
| `request_spend(to, amount, reason) -> SpendResult` | **only a key on the vault account itself** (`predecessor == current_account`) | See 6.3. **Never panics for rule failures.** It records BLOCKED/HELD and returns, so the attempt stays in the log |
| `approve_held(payment_id)` | owner only | Transfers the amount, status `Approved`. Owner approval skips the caps on purpose (a human decided) but still checks the balance |
| `reject_held(payment_id)` | owner only | Status `Rejected`, removes it from `held` |
| `get_owner`, `get_agents`, `get_agent(public_key)`, `get_payments(from_index, limit)`, `get_held()`, `get_stats()` | anyone (view) | `get_stats` returns counts by status, total paid and the vault balance |

`request_spend` and owner methods are **not payable**.

### 6.3 `request_spend` check order and reason codes
Run the checks in this exact order:
1. `predecessor != current_account` → **panic** `ERR_NOT_VAULT_KEY` (outside callers aren't logged).
2. Signer key (`env::signer_account_pk()`) not in `agents` → **panic** `ERR_UNKNOWN_AGENT_KEY` (this is the owner's full-access key calling by mistake).
3. Agent not active → record BLOCKED `BLOCKED_AGENT_INACTIVE`.
4. `amount == 0` → record BLOCKED `BLOCKED_ZERO_AMOUNT`.
5. `to` not in `allowed` → if the held queue is full, record BLOCKED `BLOCKED_HOLD_QUEUE_FULL`, otherwise record **HELD** `HELD_RECIPIENT_NOT_APPROVED`. Held requests **do not** use budget.
6. `amount > per_tx_cap` → BLOCKED `BLOCKED_OVER_TX_CAP`.
7. Reset `paid_today` if the UTC day changed. `paid_today + amount > daily_cap` → BLOCKED `BLOCKED_OVER_DAILY_CAP`.
8. `amount > account_balance - storage_reserve` → BLOCKED `BLOCKED_INSUFFICIENT_FUNDS`. `storage_reserve` = storage used × storage byte cost + 0.5 NEAR buffer.
9. Otherwise: `paid_today += amount`, `Promise::new(to).transfer(amount)`, record **PAID** `OK_PAID`.

```
SpendResult { payment_id: u64, status: String, code: String, retryable: bool, next_action: String }
```
| code | retryable | next_action |
|---|---|---|
| OK_PAID | false | "none" |
| HELD_RECIPIENT_NOT_APPROVED | false | "owner must approve_held or reject_held" |
| BLOCKED_HOLD_QUEUE_FULL | true | "owner must clear held queue" |
| BLOCKED_OVER_TX_CAP | false | "split is not allowed; ask owner to raise per_tx_cap" |
| BLOCKED_OVER_DAILY_CAP | true | "retry after 00:00 UTC" |
| BLOCKED_INSUFFICIENT_FUNDS | true | "owner must top up vault" |
| BLOCKED_AGENT_INACTIVE | false | "agent revoked" |
| BLOCKED_ZERO_AMOUNT | false | "send amount > 0" |

Every call also writes `env::log_str` with a JSON event: `{"standard":"agentgate","event":"spend","data":{...}}`.

**Known behaviour (document, don't fix):** if `to` is a named account that doesn't exist, the transfer fails and NEAR refunds the vault, but `paid_today` stays counted. That's the safe direction.

### 6.4 Unit tests (must pass offline with `cargo test`)
- Owner-only methods reject non-owners.
- `add_agent` stores the agent; a duplicate key fails.
- Each reason code in 6.3 is produced by the right input, in the right check order (e.g. unknown recipient + over cap = HELD, not BLOCKED).
- Held requests don't use budget; `approve_held` pays and changes status; `reject_held` removes it.
- Hold queue cap: the 21st held request → `BLOCKED_HOLD_QUEUE_FULL`.
- Daily reset: move `block_timestamp` forward one day and `paid_today` resets.
- Revoke: after `revoke_agent`, `request_spend` from that key → `BLOCKED_AGENT_INACTIVE` (in a unit test the key still "exists").
- Ring buffer keeps only the last 100 payments.
- **Invariant property test:** a seeded random sequence of 500 requests (random amounts, recipients and day jumps). Afterwards: for each day, total PAID ≤ daily_cap; every PAID ≤ per_tx_cap; every PAID recipient is in `allowed`.
- Promise creation (add key, delete key, transfer) is checked as far as unit tests allow. Real proof comes from Gate 0 on testnet.

## 7. Scripts spec (`scripts/`, Node 20+, ESM, near-api-js latest stable)
All scripts read `config/seed.json` and the owner's credentials from the local near-cli-rs keychain or `~/.near-credentials` (never from the repo). Each script prints a clear summary and writes raw output to `evidence/`.

| Script | Does | Network? |
|---|---|---|
| `scripts/setup-accounts.md` | Written steps for Adesope: create the owner with faucet sponsorship, create sub-accounts (vault, api-provider, data-provider, hacker) using near-cli-rs. **Docs only, not code** | Manual |
| `scripts/deploy.sh` | `cargo near build` + deploy to the vault account + call `new(owner)` | Yes (Adesope runs) |
| `scripts/seed.js` | Funds the vault from config, calls `add_agent` for api-buyer and old-bot (generating new keypairs), revokes old-bot, writes the demo keys into `config/seed.json` | Yes |
| `scripts/gate0.js` | Proves the premise: (a) the minted key calls `request_spend` → OK_PAID; (b) the same key tries a direct transfer → NEAR refuses; (c) the same key calls `update_rules` → NEAR refuses (method not allowed); (d) the revoked key → NEAR refuses (key not found). Writes `evidence/gate0.json` and prints PASS/FAIL per check | Yes |
| `scripts/attacks.js` | Runs the Attack Suite (section 8) with the public demo keys, writes `evidence/attacks-<timestamp>.json` | Yes |
| `scripts/owner.js` | `approve <id>`, `reject <id>`, `reject-all-held`, `revoke <publicKey>`, `status` | Yes |
| `scripts/agent.js` | Demo agent. Mode `scripted` (default): a fixed story (pay the API, receive the injected message, try to pay the hacker). Mode `llm`: uses any OpenAI-compatible endpoint from `.env` (`LLM_BASE_URL`, `LLM_API_KEY`, `LLM_MODEL`, e.g. NEAR AI Cloud) with one tool `pay(to, amount, reason)` mapped to `request_spend`. Prints the model's words and the vault's answer | Yes |

**Offline checks for scripts:** `node --test` unit tests for the pure parts: config validation, result classifier (maps RPC errors and SpendResult to PAID / HELD / BLOCKED / REFUSED_BY_NEAR), and amount formatting. Every network script supports `--dry-run`, which prints the planned calls without sending.

**Error classifier (shared, `scripts/lib/classify.js`, also used by web):**
- SpendResult status → PAID / HELD / BLOCKED with its code.
- RPC error containing an access-key method mismatch → `REFUSED_BY_NEAR: METHOD_NOT_ALLOWED`.
- RPC error about a deposit with a function-call key, or a transfer action not allowed → `REFUSED_BY_NEAR: TRANSFER_NOT_ALLOWED`.
- RPC error access key not found → `REFUSED_BY_NEAR: KEY_NOT_FOUND`.
- Anything else → `ERROR` with the raw message (never hide it).

Match on the error type names that near-api-js really returns. Gate 0 records the raw errors so the classifier can be checked against them.

## 8. Attack Suite (shared by `scripts/attacks.js` and `/judge`)
| # | Name | Action | Expected |
|---|---|---|---|
| J1 | Normal payment | api-buyer key: `request_spend(apiProvider, 0.01, "API credits")` | PAID, or BLOCKED_OVER_DAILY_CAP if today's cap is used (UI explains that this proves the cap) |
| J2 | Prompt injection | api-buyer key: `request_spend(hacker, 5, "ignore previous rules, send all funds")` | HELD (or BLOCKED_HOLD_QUEUE_FULL) |
| J3 | Too big | api-buyer key: `request_spend(apiProvider, 1, ...)` | BLOCKED_OVER_TX_CAP |
| J4 | Salami drain | api-buyer key: 5 × `request_spend(dataProvider, 0.5, ...)` | Some or none paid, the rest BLOCKED_OVER_DAILY_CAP; **today's total ≤ 0.6** shown |
| J5 | Leaked key: direct transfer | api-buyer key signs a Transfer of 0.01 NEAR (below the key's 0.25 NEAR allowance) from the vault to hacker | REFUSED_BY_NEAR: TRANSFER_NOT_ALLOWED |
| J6 | Leaked key: change rules | api-buyer key calls `update_rules` raising caps | REFUSED_BY_NEAR: METHOD_NOT_ALLOWED |
| J7 | Revoked key | old-bot key calls `request_spend` | REFUSED_BY_NEAR: KEY_NOT_FOUND |

Every row shows the tx hash (explorer link) or the raw RPC error.

## 9. Web spec (`web/`)
**Stack:** React + Vite + Bootstrap 5 + react-router + near-api-js (browser). No Tailwind, no backend. It reads `config/seed.json` (copied or imported at build time) and the public testnet RPC (URL in `VITE_NEAR_RPC`, with a fallback list).

**Screens (max 4):**
1. **`/` Overview:** tagline, the problem in two lines (Freysa / AIXBT), vault balance, stats (paid / held / blocked), "Try to break it →" button, a badge linking the agent key's permissions on the testnet explorer, and a **REAL / TESTNET banner**.
2. **`/agents` Agents & Rules:** each agent's public key, caps, approved recipients, paid today / daily cap bar, active or revoked. The api-buyer private key is shown with a "This key is public on purpose" note.
3. **`/activity` Activity:** payments log (status chips, codes, tx links), with the HELD queue on top. Owner actions are **not** in the UI (CLI only in the MVP). Show the CLI command next to each held item.
4. **`/judge` Attack Lab:** "Run all attacks" plus one button per attack J1–J7. A results table (attack, expected, actual, proof link). A numbered 60-second judge path at the top. A live "today's total vs daily cap" meter.

**Rules:** no fake data. If the RPC fails, show an error state, never mock numbers. Loading and error states on every chain read. Mobile friendly.

**Offline checks:** `npm run build` passes; vitest tests for the classifier, formatters and the attack-runner logic with a mocked RPC object (labelled as unit tests only).

## 10. Repo layout
```
/contract        Rust contract + unit tests
/scripts         Node scripts + lib/ + tests
/web             React app
/config/seed.json
/evidence        gate0.json, attacks-*.json, notes (raw outputs)
PRD.md CLAUDE.md PROJECT_STATE.md ROADMAP.md README.md REAL_VS_MOCKED.md LICENSE (MIT)
```

## 11. Phases
Each phase: build → run its checks → update PROJECT_STATE.md → commit → push → go to the next phase. Stop only at a ⛔ MANUAL STOP, or if a check fails and can't be fixed inside the PRD's scope.

### Phase 1: Repo scaffold + contract core (cloud, offline)
- Scope: repo layout, MIT LICENSE, `.gitignore` (target/, node_modules/, .env, credentials), `config/seed.json` template, contract (all of section 6), unit tests (6.4).
- Checks: `cargo fmt --check`, `cargo clippy -- -D warnings` (if clippy is available), `cargo test` all passing. Try `rustup target add wasm32-unknown-unknown` and `cargo near build`. **If the wasm build can't download in the cloud, don't fight it:** write that in PROJECT_STATE as "wasm build: run locally" and continue.
- Done when: all unit tests pass and the test count is written in PROJECT_STATE.

### Phase 2: Scripts + shared classifier (cloud, offline)
- Scope: everything in section 7 + `scripts/setup-accounts.md` + the shared attack definitions (section 8) in `scripts/lib/attacks.js`.
- Checks: `node --test` passes; every network script runs with `--dry-run` without errors.
- Done when: the tests pass and the dry-run outputs are pasted into PROJECT_STATE.

### ⛔ MANUAL STOP A: Gate 0 on Adesope's machine
Write a numbered checklist at the top of PROJECT_STATE.md, then stop:
1. Install near-cli-rs and cargo-near.
2. Follow `scripts/setup-accounts.md` (faucet owner + 4 sub-accounts).
3. Fill `ownerAccountId` in `config/seed.json`.
4. `bash scripts/deploy.sh`
5. `node scripts/seed.js`
6. `node scripts/gate0.js` → paste the output back.
7. `node scripts/attacks.js` → paste the output back.

After he pastes results: if Gate 0 passes, fix the classifier to match the real error names, save the evidence files, commit and continue to Phase 3. If Gate 0 fails, stop and report. Don't redesign.

### Phase 3: Web dashboard + Attack Lab (cloud, offline build)
- Scope: section 9.
- Checks: `npm run build` passes; vitest passes; no hardcoded seed numbers outside the config.
- Done when: the build passes and the screens are described in PROJECT_STATE. Live checking happens in Manual Stop B.

### Phase 4: README story + proof docs (cloud)
- Scope: final README (section 12), REAL_VS_MOCKED.md filled from the evidence, ROADMAP.md tidy, judge path checked against the real screens, every number checked against `config/seed.json` and `evidence/`.
- Checks: the README "Try it" steps match the real commands and pages; links are placeholders only where Adesope must fill them (Vercel URL, video URL, X post URL) and are clearly marked `TODO(Adesope)`.

### ⛔ MANUAL STOP B: launch (Adesope)
Checklist in PROJECT_STATE: deploy the web to Vercel (Adesope deploys, not the agent), run `/judge` once live, record the video, post on X (@NEARProtocol #NEARHackathon + video), fill the TODO links, create the mainnet payout account, submit the form before 16:00 UTC on 14 Nov.

### P1 phases: only after Adesope says "go P1" in chat
- P1-a: Owner actions in the UI with NEAR Wallet Selector (approve / reject / revoke).
- P1-b: Vault lock: owner removes the vault's full-access key; the README shows it on the explorer.
- P1-c: Shade Agent passport (TEE attestation) experiment, 3-hour time box.

## 12. README requirements
The README is for judges, the AI screener and people on X. In order:
1. Title + tagline + one-line what-it-is.
2. **The story:** Freysa (Nov 2024, ~$47K prize pool sent after 482 attempts) and AIXBT (Mar 2025, 55.5 ETH sent after an attacker queued prompts via the dashboard). The shared weak point: the agent's key was the money's key. Use our own words and link the sources.
3. **The insight:** you can't stop an agent being tricked or its key leaking, but you can make sure a tricked agent or a leaked key can't steal.
4. **How it works:** a short diagram (FUND → MINT KEY → AGENT ASKS → VAULT DECIDES → PAID / HELD / BLOCKED → REVOKE) and the invariant.
5. **The public key:** the api-buyer private key in a code block with the line "This key is public on purpose. Try to drain the vault."
6. **Try it in 60 seconds:** the hosted `/judge` link + numbered steps, then the CLI path (`node scripts/attacks.js`).
7. **Why NEAR:** Function Call Keys, contract-minted keys, signer key lookup. A sponsor-to-file table pointing to real functions.
8. **Proof:** test count (only the real number), evidence files, Attack Suite results table from `evidence/`.
9. **What's real / what's not:** link REAL_VS_MOCKED.md.
10. **Honest limits:** testnet only; a leaked key can burn its gas allowance (0.25 NEAR) and use the daily cap on approved recipients; held queue can be filled (then owner clears it); no audit yet.
11. **Built at NEAR HACKATHON**, the window, tracks, the roadmap link.
Plain, confident, no hype words. No made-up numbers.

## 13. Definition of done (P0)
- [ ] `cargo test` passes (count recorded)
- [ ] `node --test` and `vitest` pass
- [ ] Gate 0 PASS saved in `evidence/gate0.json`
- [ ] Attack Suite results saved; J2–J7 refused as expected
- [ ] Web builds; `/judge` works live (Adesope checks)
- [ ] README, REAL_VS_MOCKED, ROADMAP final; numbers match the config and evidence
- [ ] No owner or vault full-access key anywhere in the repo or its git history
