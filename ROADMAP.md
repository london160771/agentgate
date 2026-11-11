# ROADMAP

Ideas that are **not** in the hackathon build. The hackathon build is the first slice of AgentGate: the **Agent Firewall**.

## P1 (only after the P0 demo is recorded and Adesope says "go P1")
- ~~**P1-a** Owner actions in the UI with NEAR Wallet Selector (approve / reject / revoke).~~ Built (MyNearWallet). More wallet modules (Meteor, HOT, Intear) can be added later.
- **P1-b** Vault lock: remove the vault's full-access key so no one, not even us, can bypass the rules. The README shows it on the explorer.
- **P1-c** Agent Passport experiment (3-hour time box): only agents running approved code inside a TEE (NEAR Shade Agents attestation) can be given a key.

## Later, small
- Real LLM agent by default, via NEAR AI Cloud (today `node scripts/agent.js --mode=llm` is written for any OpenAI-compatible endpoint but has not been run against one).
- Store the tx hash or block height per payment, so `/activity` can link each row to its own transaction (today it links the vault's explorer page).

## After the hackathon
- Mainnet, after a contract review. A small public "drain me" vault with the key posted.
- Per-recipient caps and rate limits.
- NEP-141 token budgets (USDC on NEAR).
- Pay through NEAR Intents and Chain Signatures, so agents can spend on other chains under the same rules.
- Swarm Guard: one shared budget for many agents, with each agent getting a sub-limit.
- Reputation and scam signals for recipients (with real data sources).
- SDK: `npm i agentgate` so any agent framework can plug in.
- Alerts (Telegram / email) when a payment is held.
