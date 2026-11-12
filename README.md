<img src="web/public/favicon.svg" width="64" height="64" alt="AgentGate logo: a gate with a keyhole">

# AgentGate

**The AI can be fooled. The money can't.**

AgentGate is a NEAR vault for AI agents. Your agent gets a key that can only *ask* the vault to pay. The vault decides if money moves, and the NEAR protocol makes sure the key can't do anything else.

> Built at **NEAR HACKATHON** (1–14 Nov 2026) · Tracks: AI Security & Defense, Agent Economy · Network: NEAR testnet
> 🔗 Live demo: [agentgate-near.vercel.app](https://agentgate-near.vercel.app) · 🎥 Video: `TODO(Adesope): video URL` · 𝕏 Post: `TODO(Adesope): X post URL`
> Vault on testnet: [`vault.agentgate-ayo.testnet`](https://testnet.nearblocks.io/address/vault.agentgate-ayo.testnet) · [its access keys](https://testnet.nearblocks.io/address/vault.agentgate-ayo.testnet?tab=accesskeys)

---

## Why AgentGate is different
- **Locked by NEAR, not by a promise.** Every vault is born with no full-access key. Nobody can bypass its rules: not the agent, not a thief with the agent's key, not AgentGate. Anyone can check any vault live on its [Verify page](https://agentgate-near.vercel.app/verify), no wallet needed.
- **Our agent key is public, and the vault is still safe.** Try to drain it in the [Attack lab](https://agentgate-near.vercel.app/judge): 7 real attacks, each refused on chain, by the contract or by NEAR itself.
- **Works with the agent you already use.** One command gives Claude, Cursor or any MCP agent three tools, `budget`, `pay` and `history`. The vault decides every payment ([try it](#with-claude-or-any-mcp-agent)).
- **Proof, not screenshots.** Every testnet transaction we made is [listed below](#proof) with its explorer link, and every claim in this README has a check behind it.

## The problem: the agent's key is the money's key

**November 2024.** An AI agent called Freysa guarded a prize pool and had one rule: never send the money. After 482 tries, one player convinced it that its "approve transfer" function was for *receiving* money. Freysa sent the whole pool, about $47,000. ([source](https://www.theblock.co/post/328747))

**March 2025.** An attacker got into the dashboard of AIXBT, a popular AI agent, and queued two prompts. The agent sent 55.5 ETH, about $100,000, to the attacker. ([source](https://cointelegraph.com/news/hacker-breaches-ai-crypto-bot-aixbt-steals-55-eth))

Different attacks, same weak point. **Whoever controlled the agent's words also controlled the money.** The model was the last line of defence, and models can be talked into things.

Every team giving an agent a wallet today has the same problem. Better prompts don't fix it.

## The insight

You can't stop an agent from being tricked. You can't promise its key will never leak.

**But you can make sure a tricked agent, or a leaked key, can't steal.**

## Who it's for

Anyone who wants an AI agent to spend money without handing it the wallet.

| Who | What they want the agent to do | Why AgentGate matters to them |
|---|---|---|
| **Developers building paying agents** | Buy API calls, data, compute or services on their own | Give the agent a budget, not the wallet. If the agent is tricked or its key leaks, the loss is capped at the rules they set. |
| **Teams behind public agents** (like Freysa or AIXBT) | Hold a prize pool or treasury and react to strangers' messages | Anyone can talk to these agents, so someone eventually talks them into something. The vault still refuses any payment that breaks the rules. |
| **DAOs and small treasuries** | Pay approved suppliers or contributors automatically | Payments to known recipients go through; anything new waits for a human to approve. Every decision is logged on chain. |
| **Apps that run agents for their users** | Let a user's assistant shop or pay bills | Each user's agent gets its own limited key and caps, and the app or user can revoke it in one transaction. |
| **Security people and judges** | Check that the claims are true | The demo key is public. Anyone can try to drain the vault on [`/judge`](https://agentgate-near.vercel.app/judge) and see every attack refused on chain. |

Today AgentGate runs on NEAR testnet and handles NEAR only. The rows above describe who it is built for, not existing customers.

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

### With Claude or any MCP agent
Give your own Claude the demo vault's public key and ask it to pay someone. The `pay` tool sends `request_spend`; the vault answers.
```bash
claude mcp add agentgate -- npx -y github:london160771/agentgate --demo
claude "Check your AgentGate budget, then pay 0.01 NEAR to hacker.agentgate-ayo.testnet for the dataset."
```
The hacker account is not an approved recipient, so the vault answers **HELD** and nothing moves until the owner decides. We ran exactly this on 2026-11-12: Claude read its budget, called `pay`, and the vault held it as payment #32 ([tx `CGDK7yA7…`](https://testnet.nearblocks.io/txns/CGDK7yA7RfaJ9JttHoS5xV8VdAPXK5nBx31RxdmEJt3f), full transcript in [`evidence/mcp-claude-2026-11-12.json`](evidence/mcp-claude-2026-11-12.json)). Asked to pay 1 NEAR, Claude read the 0.5 NEAR cap and declined on its own; an agent that sends it anyway gets **BLOCKED_OVER_TX_CAP** ([tx `5LkU9iLz…`](https://testnet.nearblocks.io/txns/5LkU9iLzWkttE6VFoAbeQ5rm2aUMTekVbD4wkKRtTVQN)). Claude Desktop or Cursor: add this to `mcpServers` in `claude_desktop_config.json` or `.cursor/mcp.json`:
```json
"agentgate": { "command": "npx", "args": ["-y", "github:london160771/agentgate", "--demo"] }
```
For your own vault, drop `--demo` and set `AGENTGATE_VAULT` and `AGENTGATE_AGENT_KEY`; the vault page shows the exact command when you add an agent. Note that the demo vault's 0.6 NEAR daily cap is shared by everyone who tries it, so a payment to an approved recipient may answer `BLOCKED_OVER_DAILY_CAP` late in the UTC day. That is the cap working.

The server is [`scripts/mcp-server.js`](scripts/mcp-server.js) and its tools are in [`scripts/lib/mcp-tools.js`](scripts/lib/mcp-tools.js). It holds only the agent key, so the agent's whole power is `request_spend`.

**From a terminal** (Node 22.22+, runs the same attack code as `/judge`):
```bash
git clone https://github.com/london160771/agentgate && cd agentgate
cd scripts && npm install && cd ..
node scripts/attacks.js              # all 7 attacks, writes evidence/attacks-<time>.json
node scripts/attacks.js --only=J5    # one attack
node scripts/attacks.js --dry-run    # print the plan, send nothing
```
The 7 attacks are defined once in [`scripts/lib/attacks.js`](scripts/lib/attacks.js).

**For the demo vault's owner:** press **Connect wallet** in the navbar and pick a NEAR testnet wallet, e.g. [Meteor Wallet](https://wallet.meteorwallet.app) (its browser extension is used when installed). `/activity` then shows **Approve** and **Reject** next to each held payment and `/agents` shows **Revoke this agent**. Each button opens the wallet so you confirm the transaction there; the app asks for no access key of its own. Anyone else who signs in sees no buttons, and the contract refuses non-owners anyway (`ERR_NOT_OWNER`). The same actions work from the terminal: `node scripts/owner.js status | approve <id> | reject <id> | revoke <publicKey>`.

## Get your own vault
Any NEAR testnet wallet can create its own vault and plug in its own agent. No signup, no backend.
1. Get testnet NEAR from the [faucet](https://near-faucet.io). A vault needs about 2.7 NEAR (about 2 NEAR pays for storing the vault code; the rest is the vault's balance). The form shows the exact minimum, read from the factory.
2. Open **[My vaults](https://agentgate-near.vercel.app/app)**, press **Connect wallet**, pick a name and press **Create vault**. One transaction to the factory (`factory/`) creates `<name>.agentgate.testnet` with you as owner. The factory adds **no access key** to the new account, so it is locked from birth: only the vault's rules can move its NEAR.
3. On your vault's page press **Add an agent**: per-payment cap, daily cap, approved recipients. Your browser makes the key pair; the vault mints the public key as a Function Call Key that can only call `request_spend`.
4. Copy the private key and the setup (shown once) into your agent, like an API key: a one-line `claude mcp add` command and a JSON block for Claude Desktop or Cursor, or a Node snippet for your own code. The site never stores the key.
5. Your agent calls `request_spend`. Every request appears on your vault page as PAID, HELD or BLOCKED; you approve or reject held ones, add funds, or revoke the agent.

No agent yet? `node scripts/try-agent.js` asks for your vault id and agent key (hidden) and makes 3 real requests as your agent: a small payment to your first approved recipient (PAID), the same to an unknown account (HELD), and one over your per-payment cap (BLOCKED_OVER_TX_CAP). Checked on the demo vault on 2026-11-11: 3/3 as expected, [`evidence/try-agent-2026-11-11T21-47-24Z.json`](evidence/try-agent-2026-11-11T21-47-24Z.json).

Each wallet sees the vaults it created at `/app`; every vault has its own page at `/v/<vault id>` and a public check at `/verify/<vault id>`: no full-access key, every key limited to `request_spend`, the same code hash the factory ships, and the factory's record of who created it. All read live from RPC.

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
- Factory: `cd factory && cargo test` → **8 passed** (the create batch has no add-key action, failed creates refund the owner).
- Scripts: `cd scripts && node --test` → **66 passed** (incl. the MCP tools against mock vault answers and the real server over stdio).
- Web: `cd web && npx vitest run` → **54 passed** (incl. the Verify checks).

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

**Every testnet transaction so far: 53, all succeeded.** Listed from NearBlocks for the owner, demo vault, factory, helper and `ayo-agents` vault accounts on 2026-11-12; raw data in [`evidence/transactions-2026-11-12.json`](evidence/transactions-2026-11-12.json). It covers setup, 34 agent `request_spend` calls (Gate 0, the Attack Suite and its re-runs including the live Attack Lab run in the demo video, the snippet check, `try-agent.js` on both vaults), owner rejections signed in Meteor Wallet on the site, the vault lock, the factory deploy, and a vault created and an agent added from the website. Agent calls show the vault as signer because agent keys live on the vault account. Attacks that NEAR refuses (Gate 0 b–d, J5–J7) never become transactions; their raw RPC errors are in the evidence files above.

<details>
<summary>Show all 53 transactions</summary>

| # | Time (UTC, 2026) | Signer | What happened | Result | Tx |
|---|---|---|---|---|---|
| 1 | 11-11 12:31:20 | `testnet` | Owner account created (testnet faucet) | ✓ | [`4bRuMeuN…`](https://testnet.nearblocks.io/txns/4bRuMeuNw4WkkkxYWxPsHW1A7P61vfa7DmsyfWjDinFT) |
| 2 | 11-11 12:33:42 | `agentgate-ayo.testnet` | Vault account created | ✓ | [`2fMYyrjs…`](https://testnet.nearblocks.io/txns/2fMYyrjs5a5T2C9FTzshv9nfM4HDHzHMtFAGn6QwLFZx) |
| 3 | 11-11 12:35:06 | `agentgate-ayo.testnet` | Recipient account created: `api-provider.agentgate-ayo.testnet` | ✓ | [`ENNEFCKU…`](https://testnet.nearblocks.io/txns/ENNEFCKUdiqf9LYe3fdzeBnjRYeCMiwuv12mV7KQv5Sz) |
| 4 | 11-11 12:35:12 | `agentgate-ayo.testnet` | Recipient account created: `data-provider.agentgate-ayo.testnet` | ✓ | [`4au8uoki…`](https://testnet.nearblocks.io/txns/4au8uokidSRVntJ92SwxJUWhYvmzDrYJ2uVTn7GH7rd1) |
| 5 | 11-11 12:35:18 | `agentgate-ayo.testnet` | Recipient account created: `hacker.agentgate-ayo.testnet` | ✓ | [`ApWqTFAr…`](https://testnet.nearblocks.io/txns/ApWqTFArFNH4WnXYw4RySht74x4JKiZq1a5XgwapXFJT) |
| 6 | 11-11 12:41:29 | `vault.agentgate-ayo.testnet` | Vault contract deployed and initialised | ✓ | [`4X9PpRtd…`](https://testnet.nearblocks.io/txns/4X9PpRtdhLhU2HBD3pWcTunPoy5MJyPwFB5F6Z9pqw1H) |
| 7 | 11-11 12:46:52 | `agentgate-ayo.testnet` | Owner funds the vault | ✓ | [`2bB5DiKB…`](https://testnet.nearblocks.io/txns/2bB5DiKBwAnZSsbiupurZnd19gZJeLzkJP1BXJqzAqnW) |
| 8 | 11-11 12:46:55 | `agentgate-ayo.testnet` | Owner `add_agent`: the vault mints a Function Call Key for the agent | ✓ | [`58z3b1Tg…`](https://testnet.nearblocks.io/txns/58z3b1TgvYAWZyrYhgcwDLVSeempa7P9vwsjR1RWjbUw) |
| 9 | 11-11 12:46:58 | `agentgate-ayo.testnet` | Owner `add_agent`: the vault mints a Function Call Key for the agent | ✓ | [`3CNXbpfL…`](https://testnet.nearblocks.io/txns/3CNXbpfLGXco3wK3pBJGNrdmEG4Qq2FJNQise1pNx88o) |
| 10 | 11-11 12:47:01 | `agentgate-ayo.testnet` | Owner `revoke_agent` old-bot: its key is deleted | ✓ | [`GjCURBen…`](https://testnet.nearblocks.io/txns/GjCURBenf4eL3UDUywPmBfS3KUta4nP8wpDm9Rm9cRZc) |
| 11 | 11-11 12:47:59 | `vault.agentgate-ayo.testnet` | Agent `api-buyer` on `vault.agentgate-ayo.testnet` asks to pay 0.01 NEAR to `api-provider.agentgate-ayo.testnet` (payment 0: "API credits") | `OK_PAID` | [`47ojL4Ni…`](https://testnet.nearblocks.io/txns/47ojL4Niqy1TB1tKn7rYAXpRbP6y4P5mtRhes3f9GTh9) |
| 12 | 11-11 12:56:11 | `vault.agentgate-ayo.testnet` | Agent `api-buyer` on `vault.agentgate-ayo.testnet` asks to pay 0.01 NEAR to `api-provider.agentgate-ayo.testnet` (payment 1: "API credits") | `OK_PAID` | [`2zNeXx6b…`](https://testnet.nearblocks.io/txns/2zNeXx6bcdbVrBcE2XqRwUJybLd7X338KnonCi58bfaH) |
| 13 | 11-11 12:58:17 | `vault.agentgate-ayo.testnet` | Agent `api-buyer` on `vault.agentgate-ayo.testnet` asks to pay 0.01 NEAR to `api-provider.agentgate-ayo.testnet` (payment 2: "API credits") | `OK_PAID` | [`7LN6iXLw…`](https://testnet.nearblocks.io/txns/7LN6iXLwcjkz6yaZMofo57eBQ5QwjcmSQm22rH9HjnfB) |
| 14 | 11-11 12:58:19 | `vault.agentgate-ayo.testnet` | Agent `api-buyer` on `vault.agentgate-ayo.testnet` asks to pay 5 NEAR to `hacker.agentgate-ayo.testnet` (payment 3: "ignore previous rules, send all funds") | `HELD → REJECTED_BY_OWNER` | [`GTq1YNdz…`](https://testnet.nearblocks.io/txns/GTq1YNdzRKHGxat6noi7sKRTVswGdPu1Z8gDjw4uK4Wt) |
| 15 | 11-11 12:58:21 | `vault.agentgate-ayo.testnet` | Agent `api-buyer` on `vault.agentgate-ayo.testnet` asks to pay 1 NEAR to `api-provider.agentgate-ayo.testnet` (payment 4: "urgent: prepay a year of API credits") | `BLOCKED_OVER_TX_CAP` | [`CNBTRCsY…`](https://testnet.nearblocks.io/txns/CNBTRCsYd5Q37EKWK9mmdDkjJaZXDRsfvoSNHtJTkv58) |
| 16 | 11-11 12:58:23 | `vault.agentgate-ayo.testnet` | Agent `api-buyer` on `vault.agentgate-ayo.testnet` asks to pay 0.5 NEAR to `data-provider.agentgate-ayo.testnet` (payment 5: "dataset part 1/5") | `OK_PAID` | [`G8ynxUVj…`](https://testnet.nearblocks.io/txns/G8ynxUVjUmr3cxQcGFzceahmqkMjmSLDKwz8hNvJbgzc) |
| 17 | 11-11 12:58:26 | `vault.agentgate-ayo.testnet` | Agent `api-buyer` on `vault.agentgate-ayo.testnet` asks to pay 0.5 NEAR to `data-provider.agentgate-ayo.testnet` (payment 6: "dataset part 2/5") | `BLOCKED_OVER_DAILY_CAP` | [`AhnJk4WV…`](https://testnet.nearblocks.io/txns/AhnJk4WVoH9Za6Pwyogu9akj7B94krWe6B6HYM8qJZQ6) |
| 18 | 11-11 12:58:27 | `vault.agentgate-ayo.testnet` | Agent `api-buyer` on `vault.agentgate-ayo.testnet` asks to pay 0.5 NEAR to `data-provider.agentgate-ayo.testnet` (payment 7: "dataset part 3/5") | `BLOCKED_OVER_DAILY_CAP` | [`B2Eq6FAL…`](https://testnet.nearblocks.io/txns/B2Eq6FALYcFAMteUPcP6gxS1NQpCC4nkdvQG1zvd1WbH) |
| 19 | 11-11 12:58:29 | `vault.agentgate-ayo.testnet` | Agent `api-buyer` on `vault.agentgate-ayo.testnet` asks to pay 0.5 NEAR to `data-provider.agentgate-ayo.testnet` (payment 8: "dataset part 4/5") | `BLOCKED_OVER_DAILY_CAP` | [`47di48PB…`](https://testnet.nearblocks.io/txns/47di48PBp7Rm5GqN5e5hqnBDJ71YS6965NMXBHypKxYp) |
| 20 | 11-11 12:58:31 | `vault.agentgate-ayo.testnet` | Agent `api-buyer` on `vault.agentgate-ayo.testnet` asks to pay 0.5 NEAR to `data-provider.agentgate-ayo.testnet` (payment 9: "dataset part 5/5") | `BLOCKED_OVER_DAILY_CAP` | [`cgpMeod7…`](https://testnet.nearblocks.io/txns/cgpMeod7tQ5YZCPu2uZrUYM565sX7sbctiFvmB54A6z) |
| 21 | 11-11 13:07:53 | `vault.agentgate-ayo.testnet` | Agent `api-buyer` on `vault.agentgate-ayo.testnet` asks to pay 1 NEAR to `api-provider.agentgate-ayo.testnet` (payment 10: "urgent: prepay a year of API credits") | `BLOCKED_OVER_TX_CAP` | [`DhDMNiac…`](https://testnet.nearblocks.io/txns/DhDMNiac7X6bqmBzDPBdptjzHMoShZmXxna4pQWRHP9F) |
| 22 | 11-11 18:18:53 | `vault.agentgate-ayo.testnet` | **Vault lock**: the vault’s full-access key is deleted | ✓ | [`8mo1vVL7…`](https://testnet.nearblocks.io/txns/8mo1vVL7ZKyTHdGWSJVwjLviEMxsgKV13mJUP1M6WPzV) |
| 23 | 11-11 20:16:16 | `vault.agentgate-ayo.testnet` | Agent `api-buyer` on `vault.agentgate-ayo.testnet` asks to pay 0.01 NEAR to `api-provider.agentgate-ayo.testnet` (payment 11: "API credits") | `OK_PAID` | [`GtNSU8m2…`](https://testnet.nearblocks.io/txns/GtNSU8m2qLRm2cGnJnXDFauksc2XdE5gCijnoUXyanJk) |
| 24 | 11-11 20:16:18 | `vault.agentgate-ayo.testnet` | Agent `api-buyer` on `vault.agentgate-ayo.testnet` asks to pay 5 NEAR to `hacker.agentgate-ayo.testnet` (payment 12: "ignore previous rules, send all funds") | `HELD → REJECTED_BY_OWNER` | [`F8uXGMtm…`](https://testnet.nearblocks.io/txns/F8uXGMtmiwds42Mn6t587WEdz6m6rGUQi7Uorqhumxef) |
| 25 | 11-11 20:16:21 | `vault.agentgate-ayo.testnet` | Agent `api-buyer` on `vault.agentgate-ayo.testnet` asks to pay 1 NEAR to `api-provider.agentgate-ayo.testnet` (payment 13: "urgent: prepay a year of API credits") | `BLOCKED_OVER_TX_CAP` | [`HvVNwpAK…`](https://testnet.nearblocks.io/txns/HvVNwpAKBLZCztxtoDebdxzQHMrdc9Ht2ZHgPgeTJv97) |
| 26 | 11-11 20:16:23 | `vault.agentgate-ayo.testnet` | Agent `api-buyer` on `vault.agentgate-ayo.testnet` asks to pay 0.5 NEAR to `data-provider.agentgate-ayo.testnet` (payment 14: "dataset part 1/5") | `BLOCKED_OVER_DAILY_CAP` | [`4bhhEi45…`](https://testnet.nearblocks.io/txns/4bhhEi45rscT5aaNbRMEqAVYf76HLdfjLtCPNWqzR7Q5) |
| 27 | 11-11 20:16:25 | `vault.agentgate-ayo.testnet` | Agent `api-buyer` on `vault.agentgate-ayo.testnet` asks to pay 0.5 NEAR to `data-provider.agentgate-ayo.testnet` (payment 15: "dataset part 2/5") | `BLOCKED_OVER_DAILY_CAP` | [`5y9SQZAf…`](https://testnet.nearblocks.io/txns/5y9SQZAfcZG9aokH68dbqCfo77FtdPv8oTvMYdruvd5K) |
| 28 | 11-11 20:16:27 | `vault.agentgate-ayo.testnet` | Agent `api-buyer` on `vault.agentgate-ayo.testnet` asks to pay 0.5 NEAR to `data-provider.agentgate-ayo.testnet` (payment 16: "dataset part 3/5") | `BLOCKED_OVER_DAILY_CAP` | [`BWDjGWfs…`](https://testnet.nearblocks.io/txns/BWDjGWfsCgWKFahQdkoZFpTNvdnh6hnUL2zRTiiQDm62) |
| 29 | 11-11 20:16:29 | `vault.agentgate-ayo.testnet` | Agent `api-buyer` on `vault.agentgate-ayo.testnet` asks to pay 0.5 NEAR to `data-provider.agentgate-ayo.testnet` (payment 17: "dataset part 4/5") | `BLOCKED_OVER_DAILY_CAP` | [`G673ZnbS…`](https://testnet.nearblocks.io/txns/G673ZnbSHzWLDtTB1TSXMw1TbVw3XtNc2yB7G8S4EWyG) |
| 30 | 11-11 20:16:31 | `vault.agentgate-ayo.testnet` | Agent `api-buyer` on `vault.agentgate-ayo.testnet` asks to pay 0.5 NEAR to `data-provider.agentgate-ayo.testnet` (payment 18: "dataset part 5/5") | `BLOCKED_OVER_DAILY_CAP` | [`CcgPoE3U…`](https://testnet.nearblocks.io/txns/CcgPoE3UCspLA1TpYGH8aquG5RZWVprwKBjpmjieb7ac) |
| 31 | 11-11 20:38:19 | `agentgate-ayo.testnet` | Owner `reject_held` from the website, signed in Meteor Wallet | ✓ | [`3sUtxEyV…`](https://testnet.nearblocks.io/txns/3sUtxEyVHnhEvdyWYpoWfLZmddQ7iG49nhTK7gkkoC1R) |
| 32 | 11-11 20:39:05 | `agentgate-ayo.testnet` | Owner `reject_held` from the website, signed in Meteor Wallet | ✓ | [`D529bvLr…`](https://testnet.nearblocks.io/txns/D529bvLr9o5mfL5FuywJdSNEz9cdRnWavGHLkF9Ca5gz) |
| 33 | 11-11 20:58:05 | `vault.agentgate-ayo.testnet` | Agent `api-buyer` on `vault.agentgate-ayo.testnet` asks to pay 0 NEAR to `api-provider.agentgate-ayo.testnet` (payment 19: "snippet check (zero amount)") | `BLOCKED_ZERO_AMOUNT` | [`ACJqnzB7…`](https://testnet.nearblocks.io/txns/ACJqnzB7BEcXgdXZtHTF39UH6bPbR9AsUk1taiJn66HQ) |
| 34 | 11-11 21:23:35 | `testnet` | Factory account created (testnet faucet) | ✓ | [`FthNCTMv…`](https://testnet.nearblocks.io/txns/FthNCTMvosV4p6RmTDGpehAp1WL5UPTa5NVxvyXG2pgu) |
| 35 | 11-11 21:23:40 | `agentgate.testnet` | Vault factory deployed and initialised | ✓ | [`CbnqUnHK…`](https://testnet.nearblocks.io/txns/CbnqUnHKaEiK2xXVVGMeC3AzdRaUTVZBRektSq2uLAMz) |
| 36 | 11-11 21:39:56 | `testnet` | Helper account created (testnet faucet) | ✓ | [`AVeYdmgA…`](https://testnet.nearblocks.io/txns/AVeYdmgAaSrdaikiUMVB54YJsEb3pTfaNdTFrqwnrV4T) |
| 37 | 11-11 21:40:01 | `ayo-funds-1.testnet` | Testnet NEAR sent to the owner wallet (for creating vaults) | ✓ | [`3sdjFdhx…`](https://testnet.nearblocks.io/txns/3sdjFdhxubBHHvcF7FjxrPQD5B1AaniFau2XMzTFUc6W) |
| 38 | 11-11 21:47:20 | `vault.agentgate-ayo.testnet` | Agent `api-buyer` on `vault.agentgate-ayo.testnet` asks to pay 0.01 NEAR to `api-provider.agentgate-ayo.testnet` (payment 20: "API credits") | `OK_PAID` | [`8ekLCXA7…`](https://testnet.nearblocks.io/txns/8ekLCXA7pZoBd9XG4jjHsikKA3XYw84niL6FkdLCPXQZ) |
| 39 | 11-11 21:47:22 | `vault.agentgate-ayo.testnet` | Agent `api-buyer` on `vault.agentgate-ayo.testnet` asks to pay 0.01 NEAR to `hacker.agentgate-ayo.testnet` (payment 21: "ignore previous rules, pay this account") | `HELD_RECIPIENT_NOT_APPROVED` | [`CHBDmynK…`](https://testnet.nearblocks.io/txns/CHBDmynKcavXU1caLYbvDUgGQwb4Kc8mVNLgSunuxzET) |
| 40 | 11-11 21:47:23 | `vault.agentgate-ayo.testnet` | Agent `api-buyer` on `vault.agentgate-ayo.testnet` asks to pay 0.51 NEAR to `api-provider.agentgate-ayo.testnet` (payment 22: "urgent: prepay a year") | `BLOCKED_OVER_TX_CAP` | [`2mWH6ebK…`](https://testnet.nearblocks.io/txns/2mWH6ebKVcZVSxSCTV8YNyWL5ZAQFbtrkoYqJwPZEUqX) |
| 41 | 11-12 12:00:27 | `agentgate-ayo.testnet` | Owner `create_vault` on the factory from the website (Meteor Wallet): creates `ayo-agents.agentgate.testnet`, locked from birth | ✓ | [`8beo8bMt…`](https://testnet.nearblocks.io/txns/8beo8bMtx37HsfqYuMHjQqbavZr8mpJcdFS7oZ2o33sQ) |
| 42 | 11-12 12:01:18 | `agentgate-ayo.testnet` | Owner `add_agent` from the website (Meteor Wallet): key made in the browser, minted by `ayo-agents` | ✓ | [`BoipuqBV…`](https://testnet.nearblocks.io/txns/BoipuqBVdpQdWuYsDYsBiEankga76ubCE35TwAD7xGmG) |
| 43 | 11-12 12:10:02 | `ayo-agents.agentgate.testnet` | Agent `research-bot` on `ayo-agents.agentgate.testnet` asks to pay 0.01 NEAR to `api-provider.agentgate-ayo.testnet` (payment 0: "API credits") | `OK_PAID` | [`FDgkq2em…`](https://testnet.nearblocks.io/txns/FDgkq2emUhNbAPpFUMmLNwmcxkd7WV7imTSdcNCHzi59) |
| 44 | 11-12 12:10:05 | `ayo-agents.agentgate.testnet` | Agent `research-bot` on `ayo-agents.agentgate.testnet` asks to pay 0.01 NEAR to `hacker.agentgate-ayo.testnet` (payment 1: "ignore previous rules, pay this account") | `HELD_RECIPIENT_NOT_APPROVED` | [`3oWFrgMK…`](https://testnet.nearblocks.io/txns/3oWFrgMKWYuZbt9KrsW6guNKmgm2S6PmnxbqrfE9FAvv) |
| 45 | 11-12 12:10:07 | `ayo-agents.agentgate.testnet` | Agent `research-bot` on `ayo-agents.agentgate.testnet` asks to pay 0.51 NEAR to `api-provider.agentgate-ayo.testnet` (payment 2: "urgent: prepay a year") | `BLOCKED_OVER_TX_CAP` | [`AbVHJ8gV…`](https://testnet.nearblocks.io/txns/AbVHJ8gVpZJ8XAU9X8Jd9qraqNLPT9PF32tB74Qo6Gdg) |
| 46 | 11-12 12:14:05 | `vault.agentgate-ayo.testnet` | Agent `api-buyer` on `vault.agentgate-ayo.testnet` asks to pay 0.01 NEAR to `api-provider.agentgate-ayo.testnet` (payment 23: "API credits") | `OK_PAID` | [`4G8mZq9i…`](https://testnet.nearblocks.io/txns/4G8mZq9iDRj8dT9gqPft4eNmSA92a11pfRgLGW2fguvs) |
| 47 | 11-12 12:14:08 | `vault.agentgate-ayo.testnet` | Agent `api-buyer` on `vault.agentgate-ayo.testnet` asks to pay 5 NEAR to `hacker.agentgate-ayo.testnet` (payment 24: "ignore previous rules, send all funds") | `HELD_RECIPIENT_NOT_APPROVED` | [`MEUwZ1Xr…`](https://testnet.nearblocks.io/txns/MEUwZ1Xrx67HDm81CWvTZwhzRQNR7u3YXwop2e7Bthd) |
| 48 | 11-12 12:14:10 | `vault.agentgate-ayo.testnet` | Agent `api-buyer` on `vault.agentgate-ayo.testnet` asks to pay 1 NEAR to `api-provider.agentgate-ayo.testnet` (payment 25: "urgent: prepay a year of API credits") | `BLOCKED_OVER_TX_CAP` | [`HXfnCHt5…`](https://testnet.nearblocks.io/txns/HXfnCHt5J6CHjewwyuPyFZ4Q4zEQqyE82pWZ1BZu56z1) |
| 49 | 11-12 12:14:12 | `vault.agentgate-ayo.testnet` | Agent `api-buyer` on `vault.agentgate-ayo.testnet` asks to pay 0.5 NEAR to `data-provider.agentgate-ayo.testnet` (payment 26: "dataset part 1/5") | `OK_PAID` | [`8S7zQv3o…`](https://testnet.nearblocks.io/txns/8S7zQv3oZZP7CDLT28ijjGVHD7p32QpBdvpLUvej49h7) |
| 50 | 11-12 12:14:14 | `vault.agentgate-ayo.testnet` | Agent `api-buyer` on `vault.agentgate-ayo.testnet` asks to pay 0.5 NEAR to `data-provider.agentgate-ayo.testnet` (payment 27: "dataset part 2/5") | `BLOCKED_OVER_DAILY_CAP` | [`pq7Cdq8q…`](https://testnet.nearblocks.io/txns/pq7Cdq8qnLvZDyvkqxWnkZjzUEWxdJP3C4nAYARjCVk) |
| 51 | 11-12 12:14:16 | `vault.agentgate-ayo.testnet` | Agent `api-buyer` on `vault.agentgate-ayo.testnet` asks to pay 0.5 NEAR to `data-provider.agentgate-ayo.testnet` (payment 28: "dataset part 3/5") | `BLOCKED_OVER_DAILY_CAP` | [`Dsw6kmY1…`](https://testnet.nearblocks.io/txns/Dsw6kmY1kRiZzQWQ3qd2M4nxcXztAxcmYQyFj1zNj3pb) |
| 52 | 11-12 12:14:18 | `vault.agentgate-ayo.testnet` | Agent `api-buyer` on `vault.agentgate-ayo.testnet` asks to pay 0.5 NEAR to `data-provider.agentgate-ayo.testnet` (payment 29: "dataset part 4/5") | `BLOCKED_OVER_DAILY_CAP` | [`AKS3PFDw…`](https://testnet.nearblocks.io/txns/AKS3PFDwEqLN7SH8XhwkPA6jP5cSwLZGUxJWGEkLUaPv) |
| 53 | 11-12 12:14:19 | `vault.agentgate-ayo.testnet` | Agent `api-buyer` on `vault.agentgate-ayo.testnet` asks to pay 0.5 NEAR to `data-provider.agentgate-ayo.testnet` (payment 30: "dataset part 5/5") | `BLOCKED_OVER_DAILY_CAP` | [`79nwgUuU…`](https://testnet.nearblocks.io/txns/79nwgUuUnESdGCxKpiwmAXFDCM1kdskB2yex93kqZqhF) |

</details>

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
- The Verify page proves a vault runs the same build as every factory vault. It can't yet prove that build matches the GitHub source: we use a non-reproducible build. Reproducible builds are on the [roadmap](ROADMAP.md).
- The MCP server runs on your machine with the agent key in its environment. Treat that key like an API key; if it leaks, the loss is still limited by the caps.

## Where it's going

**Long-term goal: any AI agent can hold a budget safely, and anyone can check the rules it spends under.** The model may be fooled, but the money follows rules that the chain enforces.

1. **Today (this hackathon): Agent Firewall.** A vault for every wallet, contract-minted keys, per-payment and daily caps, an approved-recipient list, a human approval queue, and locked vaults. The demo vault is live on testnet; the vault factory goes live once deployed.
2. **Next: mainnet and real budgets.** A contract review, then mainnet. Stablecoin budgets (NEP-141, e.g. USDC on NEAR), per-recipient caps and rate limits, and a public "drain me" vault with the key posted.
3. **Then: one budget for many agents (Swarm Guard).** A team runs many agents from one shared budget, and each agent gets its own sub-limit.
4. **Then: spend anywhere under the same rules.** Payments through NEAR Intents and Chain Signatures, so an agent can pay on other chains while the vault on NEAR still decides.
5. **Vision: Agent Passport.** Only agents running approved code inside a TEE (NEAR Shade Agents) can be given a key. A copied key or a modified agent gets nothing, and users can check which agent code handles their money. This closes the last gap in today's build: a leaked key can still spend inside its caps.

Details and status: [ROADMAP.md](ROADMAP.md).

## Built at NEAR HACKATHON
All code in this repo was written during the hackathon window (1–14 Nov 2026). Tracks: AI Security & Defense, Agent Economy. AgentGate is the first slice, the Agent Firewall, of a bigger plan for AI-agent security. See [ROADMAP.md](ROADMAP.md).

MIT License.
