// Attack Lab runner logic (pure: the chain is passed in as `ctx`, so vitest can
// drive it with a mocked RPC object). Uses the shared Attack Suite definitions.
import { ATTACKS, getAttack, runAttack } from '../../../scripts/lib/attacks.js';
import { txLink } from '../../../scripts/lib/format.js';

/**
 * Runs the given attacks one after another.
 * events: onStart(id), onRow(row), onMeter({ paidToday, dailyCap }), onError(id, error)
 * Returns the rows. A failure inside one attack becomes an error row; the run continues.
 */
export async function runAttacks(ids, ctx, events = {}) {
  const { onStart = () => {}, onRow = () => {}, onMeter = () => {}, onError = () => {} } = events;
  const rows = [];
  for (const id of ids) {
    onStart(id);
    let row;
    try {
      row = await runAttack(getAttack(id), ctx);
    } catch (error) {
      onError(id, error);
      const a = getAttack(id);
      row = { id, name: a.name, expected: a.expected, actual: 'ERROR', pass: false, note: String(error?.message || error), steps: [] };
    }
    rows.push(row);
    onRow(row);
    await refreshMeter(ctx, onMeter);
  }
  return rows;
}

export async function refreshMeter(ctx, onMeter) {
  try {
    const agent = await ctx.getAgent('apiBuyer');
    onMeter({ paidToday: agent.paid_today, dailyCap: agent.daily_cap });
  } catch (error) {
    onMeter({ error });
  }
}

/** Proof cells for a row: explorer links for txs, NEAR's raw refusal text otherwise. */
export function proofs(row) {
  return row.steps.map((s) =>
    s.txHash ? { kind: 'tx', href: txLink(s.txHash), text: `${s.txHash.slice(0, 8)}…` } : { kind: 'raw', text: s.error ? `${s.error.name}: ${s.error.message}` : s.message || '' },
  );
}

export const ALL_IDS = ATTACKS.map((a) => a.id);
export { ATTACKS };
