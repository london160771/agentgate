// Multi-user helpers: vault names, add-agent arguments, the agent setup snippet.
// Pure functions (no wallet, no network) so they can be unit tested.
import { nearToYocto } from '../../../scripts/lib/format.js';
import { isAccountId } from '../../../scripts/lib/config.js';

/** Gas for create_vault: creates the account, deploys about 200 KB of code and runs `new`. */
export const GAS_CREATE_VAULT = 200_000_000_000_000n;
/** Max approved recipients per agent (MAX_ALLOWED in the vault contract). */
export const MAX_RECIPIENTS = 10;

/** Same rules as `valid_name` in factory/src/lib.rs. */
export function validVaultName(name) {
  return (
    typeof name === 'string' &&
    name.length >= 2 &&
    name.length <= 32 &&
    /^[a-z0-9]([a-z0-9]|[-_](?=[a-z0-9]))*$/.test(name)
  );
}

export const vaultIdFor = (name, factoryId) => `${name}.${factoryId}`;

/** The create_vault FunctionCall. `fc` = actionCreators.functionCall. */
export function createVaultAction(fc, name, depositYocto) {
  if (!validVaultName(name)) throw new Error('Vault name: 2–32 characters, lowercase letters, digits, - or _');
  return fc('create_vault', { name }, GAS_CREATE_VAULT, BigInt(depositYocto));
}

/** Splits a textarea of account ids (commas, spaces or new lines). Returns { list, problems }. */
export function parseRecipients(text) {
  const list = [...new Set(String(text || '').split(/[\s,]+/).map((s) => s.trim().toLowerCase()).filter(Boolean))];
  const problems = [];
  if (list.length === 0) problems.push('Add at least one approved recipient.');
  if (list.length > MAX_RECIPIENTS) problems.push(`At most ${MAX_RECIPIENTS} approved recipients.`);
  for (const id of list) if (!isAccountId(id)) problems.push(`"${id}" is not a NEAR account id.`);
  return { list, problems };
}

/** Checks the add-agent form and returns { args, problems }. Amounts are in NEAR (strings). */
export function addAgentArgs({ publicKey, name, perTxNear, dailyNear, recipients, allowanceNear }) {
  const problems = [];
  const amount = (label, v) => {
    try {
      const y = nearToYocto(v);
      if (y <= 0n) problems.push(`${label} must be more than 0.`);
      return y;
    } catch {
      problems.push(`${label} is not a NEAR amount.`);
      return 0n;
    }
  };
  const cleanName = String(name || '').trim();
  if (!cleanName) problems.push('Give the agent a name.');
  if (cleanName.length > 40) problems.push('Agent name: at most 40 characters.');
  const perTx = amount('Per-payment cap', perTxNear);
  const daily = amount('Daily cap', dailyNear);
  const allowance = amount('Gas allowance', allowanceNear);
  if (perTx > 0n && daily > 0n && perTx > daily) problems.push('The per-payment cap can’t be bigger than the daily cap.');
  const r = parseRecipients(recipients);
  problems.push(...r.problems);
  return {
    problems,
    args: {
      public_key: publicKey,
      name: cleanName,
      per_tx_cap: perTx.toString(),
      daily_cap: daily.toString(),
      allowed: r.list,
      allowance: allowance.toString(),
    },
  };
}

/**
 * What the user gives their agent. The private key only lives in this text; the
 * site never stores it.
 */
export function agentSnippet({ vaultId, privateKey, network = 'testnet' }) {
  return `# AgentGate agent key (${network}). Keep it secret like an API key.
AGENTGATE_VAULT=${vaultId}
AGENTGATE_AGENT_KEY=${privateKey}

# Node (near-api-js 7). The key can only call request_spend on this vault.
import { Account, JsonRpcProvider, KeyPair, KeyPairSigner } from 'near-api-js';
const provider = new JsonRpcProvider({ url: 'https://rpc.${network}.near.org' });
const signer = new KeyPairSigner(KeyPair.fromString(process.env.AGENTGATE_AGENT_KEY));
const agent = new Account(process.env.AGENTGATE_VAULT, provider, signer);
const result = await agent.callFunction({
  contractId: process.env.AGENTGATE_VAULT,
  methodName: 'request_spend',
  args: { to: 'api-provider.${network}', amount: '100000000000000000000000', reason: 'API credits' }, // 0.1 NEAR in yocto
  gas: 30_000_000_000_000n,
});
console.log(result); // { status: 'PAID' | 'HELD' | 'BLOCKED', code, payment_id, ... }`;
}

/** npx spec for the AgentGate MCP server (root package.json of the repo). */
export const MCP_PACKAGE = 'github:london160771/agentgate';

/** Setup for MCP agents (Claude Code, Claude Desktop, Cursor): budget / pay / history tools. */
export function mcpSnippet({ vaultId, privateKey }) {
  const config = {
    mcpServers: {
      agentgate: {
        command: 'npx',
        args: ['-y', MCP_PACKAGE],
        env: { AGENTGATE_VAULT: vaultId, AGENTGATE_AGENT_KEY: privateKey },
      },
    },
  };
  return `# AgentGate for Claude, Cursor or any MCP agent. Keep the key secret like an API key.
# Your agent gets 3 tools: budget, pay, history. The vault decides every payment.

# Claude Code: one command
claude mcp add agentgate -e AGENTGATE_VAULT=${vaultId} -e AGENTGATE_AGENT_KEY=${privateKey} -- npx -y ${MCP_PACKAGE}

# Claude Desktop (claude_desktop_config.json) or Cursor (.cursor/mcp.json)
${JSON.stringify(config, null, 2)}`;
}

/** create_vault returns on_vault_created's bool: true = created. Reads it from the outcome. */
export function createdFromOutcome(outcome) {
  const v = outcome?.status?.SuccessValue;
  if (typeof v !== 'string') return null;
  try {
    return JSON.parse(atob(v)) === true;
  } catch {
    return null;
  }
}
