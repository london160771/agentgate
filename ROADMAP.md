# ROADMAP

Ideas that are **not** in the hackathon build. The hackathon build is the first slice of AgentGate: the **Agent Firewall**.

## P1 (only after the P0 demo is recorded and Adesope says "go P1")
- Owner actions in the UI with NEAR Wallet Selector (approve / reject / revoke).
- Vault lock: remove the vault's full-access key so no one, not even us, can bypass the rules.
- Agent Passport: only agents running approved code inside a TEE (NEAR Shade Agents attestation) can be given a key.
- Real LLM agent by default, via NEAR AI Cloud.

## After the hackathon
- Mainnet, after a contract review. A small public "drain me" vault with the key posted.
- Per-recipient caps and rate limits.
- NEP-141 token budgets (USDC on NEAR).
- Pay through NEAR Intents and Chain Signatures, so agents can spend on other chains under the same rules.
- Swarm Guard: one shared budget for many agents, with each agent getting a sub-limit.
- Reputation and scam signals for recipients (with real data sources).
- SDK: `npm i agentgate` so any agent framework can plug in.
- Alerts (Telegram / email) when a payment is held.
