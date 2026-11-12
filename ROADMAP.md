# ROADMAP

Ideas that are **not** in the hackathon build. The hackathon build is the first slice of AgentGate: the **Agent Firewall**.

## P1 (only after the P0 demo is recorded and Adesope says "go P1")
- ~~**P1-a** Owner actions in the UI with NEAR Wallet Selector (approve / reject / revoke).~~ Built (MyNearWallet). More wallet modules (Meteor, HOT, Intear) can be added later.
- **P1-b** Vault lock: remove the vault's full-access key so no one, not even us, can bypass the rules. Script built (`scripts/lock-vault.js`); the lock itself is run by Adesope.

## Multi-user (built after the P0 demo, at Adesope's request)
- ~~One vault per wallet: factory, My vaults, per-vault dashboard, add agent from the browser.~~ Built; factory deploy run by Adesope.
- Later: edit an agent's rules from the dashboard (`update_rules` exists in the contract), a vault list that also finds vaults made outside the factory, more wallets in the picker.

## Vision: Agent Passport (was P1-c)
Only agents running approved code inside a TEE (NEAR Shade Agents attestation, e.g. on Phala Cloud) can be given a key. A copied key or a modified agent gets nothing, and users can check which agent code handles their money. This closes the last gap of the hackathon build: today a leaked key can still spend inside its caps.

## Built for the submission (12 Nov, at Adesope's request)
- ~~MCP connector: `npx -y github:london160771/agentgate` gives any MCP agent `budget` / `pay` / `history` tools.~~ Built.
- ~~Verify page `/verify/<vault>`: lock, key permissions, code hash vs factory, factory record.~~ Built.
- Later: publish the MCP server to npm as `agentgate-mcp` (needs Adesope's npm account).
- Later: reproducible contract builds (`cargo near build reproducible-wasm`) so the Verify page can match the code hash to the GitHub source.

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
