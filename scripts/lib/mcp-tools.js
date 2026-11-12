// The three tools the AgentGate MCP server gives an AI agent (Claude, Cursor, any MCP client):
//   budget   read this agent's rules and what is left today
//   pay      ask the vault to pay someone; the vault decides PAID / HELD / BLOCKED
//   history  this agent's last payments, as the vault logged them
//
// Pure logic: everything that touches the chain comes in through `ctx`, so tests can pass
// mocks. The real ctx is built in scripts/mcp-server.js.

import { classifyError, classifyResult } from './classify.js';
import { isAccountId } from './config.js';
import { formatNear, nearToYocto, txLink } from './format.js';

export const TOOLS = [
  {
    name: 'budget',
    description:
      'Read your AgentGate spending rules before you pay anyone: the most you can send in one payment, ' +
      'what is left of today\'s limit, and which recipients are approved. The rules live in a NEAR smart ' +
      'contract; you cannot change them.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'pay',
    description:
      'Ask your AgentGate vault to pay a NEAR account. The vault contract decides, not you: ' +
      'PAID (sent now), HELD (recipient not approved; the human owner must approve it, do not retry), ' +
      'or BLOCKED (a rule said no; the reason says what to do). Every attempt is logged on chain with your reason.',
    inputSchema: {
      type: 'object',
      properties: {
        to: { type: 'string', description: 'NEAR account to pay, e.g. api-provider.agentgate-ayo.testnet' },
        amount_near: { type: 'string', description: 'Amount in NEAR as a decimal string, e.g. "0.01"' },
        reason: { type: 'string', description: 'Why you are paying. The owner reads this in the vault log.' },
      },
      required: ['to', 'amount_near', 'reason'],
      additionalProperties: false,
    },
  },
  {
    name: 'history',
    description: 'Your last payment attempts as the vault logged them (paid, held, blocked, approved, rejected).',
    inputSchema: {
      type: 'object',
      properties: { limit: { type: 'integer', minimum: 1, maximum: 50, description: 'How many, newest first (default 10)' } },
      additionalProperties: false,
    },
  },
];

/** What each vault answer means, in words an agent can act on. Codes are the contract's (PRD 6.3). */
const MEANING = {
  OK_PAID: 'Sent.',
  HELD_RECIPIENT_NOT_APPROVED: 'Not sent yet. The recipient is not on your approved list, so the owner must approve or reject it. Do not retry or split it.',
  BLOCKED_HOLD_QUEUE_FULL: 'Not sent. Too many payments are already waiting for the owner. Ask the owner to clear them.',
  BLOCKED_OVER_TX_CAP: 'Not sent. The amount is over your per-payment limit. Splitting it into smaller payments is not allowed; ask the owner to raise the limit.',
  BLOCKED_OVER_DAILY_CAP: 'Not sent. This would go over today\'s limit. It resets at 00:00 UTC.',
  BLOCKED_INSUFFICIENT_FUNDS: 'Not sent. The vault does not have enough NEAR. The owner must top it up.',
  BLOCKED_AGENT_INACTIVE: 'Not sent. The owner revoked this agent.',
  BLOCKED_ZERO_AMOUNT: 'Not sent. The amount must be more than 0.',
};

const NEAR_REFUSAL = {
  KEY_NOT_FOUND: 'NEAR refused the transaction: this agent key no longer exists on the vault (revoked, or wrong key).',
  METHOD_NOT_ALLOWED: 'NEAR refused the transaction: this key may only call request_spend.',
  TRANSFER_NOT_ALLOWED: 'NEAR refused the transaction: this key cannot move NEAR directly.',
};

const text = (s, isError = false) => ({ content: [{ type: 'text', text: s }], ...(isError ? { isError: true } : {}) });

export async function budget(ctx) {
  const [agent, stats] = await Promise.all([ctx.getAgent(), ctx.getStats().catch(() => null)]);
  if (!agent) return text(`This key is not an agent of ${ctx.vaultId}.`, true);
  const left = BigInt(agent.daily_cap) - BigInt(agent.paid_today);
  const lines = [
    `Agent "${agent.name}" on vault ${ctx.vaultId}${agent.active ? '' : ' (REVOKED: every payment will be blocked)'}`,
    `Per payment: up to ${formatNear(agent.per_tx_cap)}`,
    `Per day: ${formatNear(agent.daily_cap)} (spent today ${formatNear(agent.paid_today)}, left ${formatNear(left > 0n ? left : 0n)}, resets 00:00 UTC)`,
    `Approved recipients, paid at once: ${agent.allowed.length ? agent.allowed.join(', ') : 'none'}`,
    'Any other recipient: the payment is HELD until the owner approves it.',
  ];
  if (stats) lines.push(`Vault balance: ${formatNear(stats.vault_balance)}`);
  lines.push(`Owner's page: ${ctx.vaultPage}`);
  return text(lines.join('\n'));
}

export async function pay(ctx, { to, amount_near, reason } = {}) {
  to = String(to ?? '').trim();
  if (!isAccountId(to)) return text(`"${to}" is not a NEAR account id (example: api-provider.agentgate-ayo.testnet).`, true);
  let amount;
  try {
    amount = nearToYocto(amount_near);
  } catch {
    return text(`"${amount_near}" is not an amount in NEAR. Use a decimal string like "0.01".`, true);
  }
  reason = String(reason ?? '').trim() || '(no reason given)';

  let outcome;
  try {
    const { result, txHash } = await ctx.spend({ to, amountYocto: amount.toString(), reason });
    outcome = { ...classifyResult(result), txHash };
  } catch (error) {
    outcome = { ...classifyError(error), txHash: error?.txHash };
  }

  const proof = outcome.txHash ? `\nProof on chain: ${txLink(outcome.txHash)}` : '';
  const what = `${formatNear(amount)} to ${to}`;
  switch (outcome.kind) {
    case 'PAID':
      return text(`PAID: ${what}. Payment #${outcome.paymentId}. ${MEANING.OK_PAID}${proof}`);
    case 'HELD':
      return text(`HELD: ${what}, payment #${outcome.paymentId}. ${MEANING[outcome.code] || ''}\nOwner decides here: ${ctx.vaultPage}${proof}`);
    case 'BLOCKED':
      return text(`BLOCKED (${outcome.code}): ${what}. ${MEANING[outcome.code] || outcome.nextAction || ''}${proof}`);
    case 'REFUSED_BY_NEAR':
      return text(`${NEAR_REFUSAL[outcome.code] || 'NEAR refused the transaction.'} Nothing was sent.${proof}`, true);
    default:
      return text(`Error, nothing confirmed: ${outcome.message}${proof}`, true);
  }
}

export async function history(ctx, { limit = 10 } = {}) {
  const n = Math.min(Math.max(Number(limit) || 10, 1), 50);
  const mine = (await ctx.getPayments()).filter((p) => p.agent_key === ctx.publicKey).slice(-n).reverse();
  if (!mine.length) return text('No payments by this agent in the vault log yet.');
  const rows = mine.map((p) => {
    const at = new Date(Number(BigInt(p.at) / 1_000_000n)).toISOString().slice(0, 16).replace('T', ' ');
    return `#${p.id} ${at} UTC  ${p.status.padEnd(8)} ${formatNear(p.amount)} to ${p.to}  "${p.reason}"`;
  });
  return text(rows.join('\n'));
}

/** Runs one tool by name. Unknown names and thrown errors come back as tool errors, not crashes. */
export async function callTool(ctx, name, args = {}) {
  try {
    if (name === 'budget') return await budget(ctx);
    if (name === 'pay') return await pay(ctx, args);
    if (name === 'history') return await history(ctx, args);
    return text(`Unknown tool "${name}".`, true);
  } catch (error) {
    return text(`Error: ${error?.message || error}`, true);
  }
}
