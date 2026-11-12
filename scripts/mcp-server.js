#!/usr/bin/env node
// AgentGate MCP server: gives any MCP agent (Claude Desktop, Claude Code, Cursor, ...) three
// tools, budget / pay / history, that go through your AgentGate vault. The agent holds only
// its agent key, which NEAR lets call request_spend and nothing else. The vault contract
// decides every payment: PAID, HELD for you, or BLOCKED.
//
// Your own vault:
//   AGENTGATE_VAULT=<vault id> AGENTGATE_AGENT_KEY=ed25519:... node scripts/mcp-server.js
// The public demo vault (its api-buyer key is public on purpose, see config/seed.json):
//   node scripts/mcp-server.js --demo
// Print the tools and exit:
//   node scripts/mcp-server.js --dry-run
//
// It talks MCP over stdin/stdout, so it never prints anything else to stdout.

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { KeyPair } from 'near-api-js';
import { GAS_SPEND, callMethod, makeAccount, makeProvider, view } from './lib/chain.js';
import { TOOLS, callTool } from './lib/mcp-tools.js';
import { dryRunBanner, loadConfig, parseArgs } from './lib/node.js';

const { dryRun, flags } = parseArgs();

if (dryRun) {
  dryRunBanner('mcp-server');
  console.log('needs:  AGENTGATE_VAULT + AGENTGATE_AGENT_KEY (your vault), or --demo (the public demo vault)');
  for (const t of TOOLS) console.log(`tool ${t.name.padEnd(8)} ${t.description.split('. ')[0].replace(/\.$/, '')}.`);
  console.log('pay → request_spend(to, amount, reason) signed with the agent key; nothing else is possible with that key');
  process.exit(0);
}

const fail = (msg) => {
  console.error(`agentgate-mcp: ${msg}`);
  process.exit(1);
};

let vaultId = process.env.AGENTGATE_VAULT;
let privateKey = process.env.AGENTGATE_AGENT_KEY;
let site;
try {
  const { cfg } = loadConfig({ stage: flags.demo ? 'seeded' : 'template' });
  site = cfg.siteUrl;
  if (flags.demo) {
    vaultId = cfg.vaultAccountId;
    privateKey = cfg.demoKeys.apiBuyerPrivateKey;
  }
} catch (e) {
  if (flags.demo) fail(`cannot read the demo key from config/seed.json: ${e.message}`);
}
if (!vaultId || !privateKey) fail('set AGENTGATE_VAULT and AGENTGATE_AGENT_KEY, or run with --demo');

let publicKey;
try {
  publicKey = KeyPair.fromString(privateKey).getPublicKey().toString();
} catch {
  fail('AGENTGATE_AGENT_KEY is not a NEAR private key (it starts with "ed25519:")');
}

const provider = makeProvider(process.env.NEAR_RPC);
const agent = makeAccount(vaultId, privateKey, provider);
const ctx = {
  vaultId,
  publicKey,
  vaultPage: `${site || 'https://agentgate-near.vercel.app'}/v/${vaultId}`,
  getAgent: () => view(provider, vaultId, 'get_agent', { public_key: publicKey }),
  getStats: () => view(provider, vaultId, 'get_stats'),
  getPayments: () => view(provider, vaultId, 'get_payments', {}),
  spend: ({ to, amountYocto, reason }) =>
    callMethod(agent, vaultId, 'request_spend', { to, amount: amountYocto, reason }, { gas: GAS_SPEND }),
};

const server = new Server({ name: 'agentgate', version: '0.1.0' }, { capabilities: { tools: {} } });
server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));
server.setRequestHandler(CallToolRequestSchema, async (req) => callTool(ctx, req.params.name, req.params.arguments || {}));

await server.connect(new StdioServerTransport());
console.error(`agentgate-mcp: ready. Vault ${vaultId}, agent key ${publicKey}`);
