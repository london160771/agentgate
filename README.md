# AgentGate

**The AI can be fooled. The money can't.**

AgentGate is a NEAR vault for AI agents. Your agent gets a key that can only *ask* the vault to pay. The vault decides if money moves, and the NEAR protocol makes sure the key can't do anything else.

> Built at **NEAR HACKATHON** (1–14 Nov 2026) · Tracks: AI Security & Defense, Agent Economy · Network: NEAR testnet
> 🔗 Live demo: [agentgate-near.vercel.app](https://agentgate-near.vercel.app) · 🎥 Video: `TODO(Adesope): video URL` · 𝕏 Post: `TODO(Adesope): X post URL`
> Vault on testnet: [`vault.agentgate-ayo.testnet`](https://testnet.nearblocks.io/address/vault.agentgate-ayo.testnet) · [its access keys](https://testnet.nearblocks.io/address/vault.agentgate-ayo.testnet?tab=accesskeys)

---

## The problem: the agent's key is the money's key

**November 2024.** An AI agent called Freysa guarded a prize pool and had one rule: never send the money. After 482 tries, one player convinced it that its "approve transfer" function was for *receiving* money. Freysa sent the whole pool, about $47,000. ([source](https://www.theblock.co/post/328747))

**March 2025.** An attacker got into the dashboard of AIXBT, a popular AI agent, and queued two prompts. The agent sent 55.5 ETH, about $100,000, to the attacker. ([source](https://cointelegraph.com/news/hacker-breaches-ai-crypto-bot-aixbt-steals-55-eth))

Different attacks, same weak point. **Whoever controlled the agent's words also controlled the money.** The model was the last line of defence, and models can be talked into things.

Every team giving an agent a wallet today has the same problem. Better prompts don't fix it.

## The insight

You can't stop an agent from being tricked. You can't promise its key will never leak.

**But you can make sure a tricked agent, or a leaked key, can't steal.**

## How it works

```
OWNER funds vault ──► VAULT mints an agent key (NEAR Function Call Key)
                               │  can only call: request_spend
                               ▼
AGENT asks: request_spend(to, amount, reason)
                               ▼
VAULT decides ──► PAID     (approved recipient, inside caps)
              ──► HELD     (unknown recipient → owner approves or rejects)
              ──► BLOCKED  (over per-payment cap or daily cap)
                               ▼
OWNER can revoke the key in one transaction
```

**The guarantee:** money only leaves the vault to an approved recipient, never more than the per-payment cap, and never more than the daily cap in a day, **no matter who holds the agent key.**

Two parts of that aren't even our code. The NEAR protocol enforces them:
- The agent key **can't send NEAR directly.** Function Call Keys can't attach NEAR.
- The agent key **can't change the rules.** It can only call `request_spend`.

## The key is public. Try to drain the vault.

```
account (signer): vault.agentgate-ayo.testnet
public key:       ed25519:z28Hcnsj7hVXok3Dd4mNXepDkpYQdqiDYXf2qs7eR2S
private key:      ed25519:2GeRYxjszfKDQb1vqwnyTzj5gweumimG8SkRq6eVH1WsVtPHs4Y2n7WWXWosM2fNoFcj3NiweX2PhyXPcrez3D6A
```

This is the real agent key for our testnet vault (also in [`config/seed.json`](config/seed.json)). **This key is public on purpose. Try to drain the vault.** Its rules: max 0.5 NEAR per payment, 0.6 NEAR per day, only to the two approved provider accounts. Use it however you like:
- Send NEAR to yourself with it → NEAR refuses.
- Raise the caps with it → NEAR refuses.
- Pay yourself through the vault → the vault holds it for the owner.
- Drain it in small steps → the daily cap stops you.

## Try it in 60 seconds
**In the browser (no wallet, no signup):**
1. Open **[agentgate-near.vercel.app/judge](https://agentgate-near.vercel.app/judge)**.
2. Press **Run all attacks**. Each of the 7 attacks (J1–J7) signs a real testnet transaction with the public key above, in your browser.
3. Read each row: expected result, actual result, and the proof (explorer link, or NEAR's raw refusal).
4. Watch the meter: today's total never goes past the daily cap, however often you run J4.
5. Open the [vault's access keys](https://testnet.nearblocks.io/address/vault.agentgate-ayo.testnet?tab=accesskeys): the agent key is a `FunctionCall` key that can only call `request_spend` on the vault.

**From a terminal** (Node 22.22+, runs the same attack code as `/judge`):
```bash
git clone https://github.com/london160771/agentgate && cd agentgate
cd scripts && npm install && cd ..
node scripts/attacks.js              # all 7 attacks, writes evidence/attacks-<time>.json
node scripts/attacks.js --only=J5    # one attack
node scripts/attacks.js --dry-run    # print the plan, send nothing
```
The 7 attacks are defined once in [`scripts/lib/attacks.js`](scripts/lib/attacks.js).

**For the vault owner:** press **Owner sign in** in the navbar and sign in with MyNearWallet (testnet). If you are the vault owner, `/activity` shows **Approve** and **Reject** next to each held payment and `/agents` shows **Revoke this agent**. Each button opens the wallet so you confirm the transaction there; the app asks for no access key of its own. Anyone else who signs in sees no buttons, and the contract refuses non-owners anyway (`ERR_NOT_OWNER`). The same actions work from the terminal: `node scripts/owner.js status | approve <id> | reject <id> | revoke <publicKey>`.

## Why NEAR
On most chains one key controls everything, so agent-wallet tools need an off-chain policy server or a smart-account wrapper in front of it. NEAR accounts can hold many keys with different powers, built into the protocol. AgentGate turns that into agent allowances.

| NEAR feature | What AgentGate uses it for | Where |
|---|---|---|
| **Function Call Keys** (protocol-level key permissions) | The agent key can only call `request_spend` on the vault. A direct transfer or any other method is refused by NEAR before the contract runs (J5, J6). | [`add_agent`](contract/src/lib.rs#L63) |
| **Contract-minted keys** (`Promise::add_access_key_allowance`, `delete_key`) | The vault adds the agent key to its own account with a gas allowance, and deletes it in one owner call (J7). | [`add_access_key_allowance`](contract/src/lib.rs#L94) · [`revoke_agent`](contract/src/lib.rs#L123) |
| **Signer key lookup** (`env::signer_account_pk`) | Calls from an agent key come from the vault account itself, so the vault identifies the agent by the key that signed, then applies that agent's caps and recipients. | [`request_spend`](contract/src/lib.rs#L174) |
| **Non-payable methods** | Function Call Keys can't attach a deposit, so `request_spend` takes no deposit. The money only moves from the vault's own balance. | [`request_spend`](contract/src/lib.rs#L174) |
| **Typed RPC errors** | The scripts and `/judge` turn NEAR's refusals into `REFUSED_BY_NEAR: TRANSFER_NOT_ALLOWED / METHOD_NOT_ALLOWED / KEY_NOT_FOUND`. | [`scripts/lib/classify.js`](scripts/lib/classify.js) |

## Proof
**Tests** (offline, run in the cloud build on 2026-11-11):
- Contract: `cd contract && cargo test` → **33 passed**, including a 500-request random run that checks the guarantee after every request.
- Scripts: `cd scripts && node --test` → **53 passed**.
- Web: `cd web && npx vitest run` → **30 passed**.

**Gate 0** (can a contract-minted key really be limited by NEAR?), testnet, 2026-11-11, raw output in [`evidence/gate0.json`](evidence/gate0.json): **PASS 4/4**.

| Check | What | Expected | Actual | Proof |
|---|---|---|---|---|
| (a) | minted key calls request_spend | OK_PAID | **PAID** | [`2zNeXx6b…`](https://testnet.nearblocks.io/txns/2zNeXx6bcdbVrBcE2XqRwUJybLd7X338KnonCi58bfaH) |
| (b) | same key signs a direct Transfer | REFUSED_BY_NEAR: TRANSFER_NOT_ALLOWED | **REFUSED_BY_NEAR: TRANSFER_NOT_ALLOWED** | `AccessKeyRequiresFullAccessActionError` |
| (c) | same key calls update_rules | REFUSED_BY_NEAR: METHOD_NOT_ALLOWED | **REFUSED_BY_NEAR: METHOD_NOT_ALLOWED** | `AccessKeyMethodNameMismatchActionError` |
| (d) | revoked key calls request_spend | REFUSED_BY_NEAR: KEY_NOT_FOUND | **REFUSED_BY_NEAR: KEY_NOT_FOUND** | `AccessKeyDoesNotExistError` |

**Attack Suite**, testnet, 2026-11-11, raw output in [`evidence/attacks-2026-11-11T12-57-38Z.json`](evidence/attacks-2026-11-11T12-57-38Z.json): **7/7 as expected**. Money left the vault only for J1 and the first J4 payment, both to an approved recipient and inside the caps.

| # | Attack | Expected | Actual | Proof |
|---|---|---|---|---|
| J1 | Normal payment | PAID (or BLOCKED_OVER_DAILY_CAP if today’s cap is already used) | **PAID** | [`7LN6iXLw…`](https://testnet.nearblocks.io/txns/7LN6iXLwcjkz6yaZMofo57eBQ5QwjcmSQm22rH9HjnfB) |
| J2 | Prompt injection | HELD (or BLOCKED_HOLD_QUEUE_FULL) | **HELD** | [`GTq1YNdz…`](https://testnet.nearblocks.io/txns/GTq1YNdzRKHGxat6noi7sKRTVswGdPu1Z8gDjw4uK4Wt) |
| J3 | Too big | BLOCKED_OVER_TX_CAP | **BLOCKED_OVER_TX_CAP** | [`CNBTRCsY…`](https://testnet.nearblocks.io/txns/CNBTRCsYd5Q37EKWK9mmdDkjJaZXDRsfvoSNHtJTkv58) |
| J4 | Salami drain | Some or none PAID, the rest BLOCKED_OVER_DAILY_CAP; today’s total ≤ daily cap | **PAID ×1, BLOCKED_OVER_DAILY_CAP ×4** (today's total 0.53 NEAR ≤ daily cap 0.6 NEAR) | [`G8ynxUVj…`](https://testnet.nearblocks.io/txns/G8ynxUVjUmr3cxQcGFzceahmqkMjmSLDKwz8hNvJbgzc) [`AhnJk4WV…`](https://testnet.nearblocks.io/txns/AhnJk4WVoH9Za6Pwyogu9akj7B94krWe6B6HYM8qJZQ6) [`B2Eq6FAL…`](https://testnet.nearblocks.io/txns/B2Eq6FALYcFAMteUPcP6gxS1NQpCC4nkdvQG1zvd1WbH) [`47di48PB…`](https://testnet.nearblocks.io/txns/47di48PBp7Rm5GqN5e5hqnBDJ71YS6965NMXBHypKxYp) [`cgpMeod7…`](https://testnet.nearblocks.io/txns/cgpMeod7tQ5YZCPu2uZrUYM565sX7sbctiFvmB54A6z) |
| J5 | Leaked key: direct transfer | REFUSED_BY_NEAR: TRANSFER_NOT_ALLOWED | **REFUSED_BY_NEAR: TRANSFER_NOT_ALLOWED** | `AccessKeyRequiresFullAccessActionError` |
| J6 | Leaked key: change rules | REFUSED_BY_NEAR: METHOD_NOT_ALLOWED | **REFUSED_BY_NEAR: METHOD_NOT_ALLOWED** | `AccessKeyMethodNameMismatchActionError` |
| J7 | Revoked key | REFUSED_BY_NEAR: KEY_NOT_FOUND | **REFUSED_BY_NEAR: KEY_NOT_FOUND** | `AccessKeyDoesNotExistError` |

**Vault lock**, testnet, 2026-11-11 18:17 UTC, raw output in [`evidence/lock-2026-11-11T18-17-59Z.json`](evidence/lock-2026-11-11T18-17-59Z.json): **LOCKED**. One transaction ([`8mo1vVL7…`](https://testnet.nearblocks.io/txns/8mo1vVL7ZKyTHdGWSJVwjLviEMxsgKV13mJUP1M6WPzV)) deleted the vault's only full-access key (`ed25519:3zfLDHfU…`). Before: 2 keys (1 FullAccess, 1 FunctionCall). After: 1 key, the api-buyer `FunctionCall` key limited to `request_spend` on the vault. Nobody, including the owner, can now sign a transfer, redeploy the contract or add a key on the vault account directly. Money moves only through the contract's rules. Check it live on the [vault's access keys](https://testnet.nearblocks.io/address/vault.agentgate-ayo.testnet?tab=accesskeys).

How the demo vault was set up (funding, both agent keys minted, old-bot revoked): [`evidence/seed-2026-11-11T12-46-08Z.json`](evidence/seed-2026-11-11T12-46-08Z.json).

## What's real and what's not
Gate 0, the Attack Suite and the dashboard numbers are real NEAR testnet results. Mocks exist only inside unit tests. Full list: [REAL_VS_MOCKED.md](REAL_VS_MOCKED.md).

## Honest limits
- **Testnet only.** No contract audit yet. The vault is locked (no full-access key), so this contract can never be upgraded: a bug fix would need a new vault. Mainnet is on the [roadmap](ROADMAP.md).
- Someone with the leaked key can **burn its gas allowance** (0.25 NEAR). The agent then needs a new key.
- Someone with the leaked key can **use up the daily cap**, but only by paying approved recipients. The money can't reach them.
- The held queue can be filled with junk requests (max 20). New unknown-recipient requests are then blocked until the owner clears it.
- AgentGate doesn't stop prompt injection. It limits what an injected agent can do.

## Built at NEAR HACKATHON
All code in this repo was written during the hackathon window (1–14 Nov 2026). Tracks: AI Security & Defense, Agent Economy. AgentGate is the first slice, the Agent Firewall, of a bigger plan for AI-agent security. See [ROADMAP.md](ROADMAP.md).

MIT License.
