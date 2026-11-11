# AgentGate

**The AI can be fooled. The money can't.**

AgentGate is a NEAR vault for AI agents. Your agent gets a key that can only *ask* the vault to pay. The vault decides if money moves, and the NEAR protocol makes sure the key can't do anything else.

> Built at **NEAR HACKATHON** (1–14 Nov 2026) · Tracks: AI Security & Defense, Agent Economy · Network: NEAR testnet
> 🔗 Live demo: `TODO(Adesope): Vercel URL` · 🎥 Video: `TODO(Adesope): X post URL`

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
TODO(Phase 4): api-buyer private key from config/seed.json
```

This is the real agent key for our testnet vault. **It's public on purpose.** Use it however you like:
- Send NEAR to yourself with it → NEAR refuses.
- Raise the caps with it → NEAR refuses.
- Pay yourself through the vault → the vault holds it for the owner.
- Drain it in small steps → the daily cap stops you.

## Try it in 60 seconds
`TODO(Phase 4): exact judge path for /judge, then the CLI path (node scripts/attacks.js)`

## Why NEAR
On most chains one key controls everything, so agent-wallet tools need an off-chain policy server or a smart-account wrapper in front of it. NEAR accounts can hold many keys with different powers, built into the protocol. AgentGate turns that into agent allowances.

`TODO(Phase 4): sponsor-to-file table (Function Call Keys, contract-minted keys, signer key lookup → real functions)`

## Proof
`TODO(Phase 4): test counts, evidence files, Attack Suite results table from evidence/`

See [REAL_VS_MOCKED.md](REAL_VS_MOCKED.md).

## Honest limits
- **Testnet only.** No contract audit yet. Mainnet is on the [roadmap](ROADMAP.md).
- Someone with the leaked key can **burn its gas allowance** (0.25 NEAR). The agent then needs a new key.
- Someone with the leaked key can **use up the daily cap**, but only by paying approved recipients. The money can't reach them.
- The held queue can be filled with junk requests (max 20). The owner clears it.
- AgentGate doesn't stop prompt injection. It limits what an injected agent can do.

## Built at NEAR HACKATHON
All code in this repo was written during the hackathon window (1–14 Nov 2026). AgentGate is the first slice, the Agent Firewall, of a bigger plan for AI-agent security. See [ROADMAP.md](ROADMAP.md).

MIT License.
