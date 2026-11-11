import { Link } from 'react-router-dom';
import { formatNear } from '../../../scripts/lib/format.js';
import { ChainView } from '../components/ui.jsx';
import { accessKeysLink } from '../lib/links.js';
import { lockStatus } from '../../../scripts/lib/lock.js';
import { cfg, vaultAccessKeys, viewVault } from '../lib/near.js';
import { useChain } from '../lib/useChain.js';

function Stat({ label, value, tone = 'body' }) {
  return (
    <div className="col-6 col-md-3">
      <div className="border rounded p-3 h-100">
        <div className="small text-secondary">{label}</div>
        <div className={`fs-4 fw-semibold text-${tone}`}>{value}</div>
      </div>
    </div>
  );
}

/** Live lock status (P1-b): locked = no full-access key on the vault account. */
function LockBadge() {
  const keys = useChain(vaultAccessKeys);
  if (keys.loading) return <span className="badge text-bg-light border p-2">Checking vault keys…</span>;
  if (keys.error) return <span className="badge text-bg-warning p-2 text-wrap">Could not read the vault keys: {String(keys.error.message || keys.error)}</span>;
  const s = lockStatus(keys.data);
  return (
    <a className={`badge p-2 text-wrap text-start ${s.locked ? 'text-bg-success' : 'text-bg-secondary'}`} href={accessKeysLink(cfg.vaultAccountId)} target="_blank" rel="noreferrer">
      {s.locked
        ? 'Vault locked: no full-access key. Not even the owner can move the NEAR outside the rules ↗'
        : `Vault not locked yet: ${s.fullAccess.length} full-access key on the vault account ↗`}
    </a>
  );
}

export default function Overview() {
  const stats = useChain(() => viewVault('get_stats'));
  return (
    <>
      <section className="py-3">
        <h1 className="display-6 fw-bold">The AI can be fooled. The money can’t.</h1>
        <p className="lead">
          AgentGate is a NEAR vault for AI agents. The agent gets a key that can only <em>ask</em> the vault to pay. The vault
          decides: <strong>PAID</strong>, <strong>HELD</strong> or <strong>BLOCKED</strong>.
        </p>
        <p className="text-secondary mb-1">
          <strong>Freysa (Nov 2024):</strong> after 482 tries, one message talked an AI agent into sending its whole prize pool.
        </p>
        <p className="text-secondary">
          <strong>AIXBT (Mar 2025):</strong> an attacker queued two prompts on its dashboard and the agent sent 55.5 ETH. Same weak
          point both times: the agent’s key was the money’s key.
        </p>
        <div className="d-flex flex-wrap gap-2 align-items-center">
          <Link to="/judge" className="btn btn-primary btn-lg">
            Try to break it →
          </Link>
          <a className="badge text-bg-light border text-wrap text-start p-2" href={accessKeysLink(cfg.vaultAccountId)} target="_blank" rel="noreferrer">
            Agent key permission on the explorer: FunctionCall → {cfg.vaultAccountId}, method request_spend only ↗
          </a>
          <LockBadge />
        </div>
      </section>

      <section className="py-3">
        <h2 className="h5">Vault right now</h2>
        <ChainView state={stats} what="Reading vault stats">
          {(s) => (
            <div className="row g-3">
              <Stat label="Vault balance" value={formatNear(s.vault_balance)} />
              <Stat label="Paid" value={s.paid} tone="success" />
              <Stat label={`Held (${s.held_pending} waiting)`} value={s.held} tone="warning" />
              <Stat label="Blocked" value={s.blocked} tone="danger" />
              <div className="col-12 small text-secondary">
                Total paid by agents {formatNear(s.total_paid)} · approved by owner {formatNear(s.total_approved)} · {s.total_requests}{' '}
                requests since deploy. Refusals by NEAR itself (leaked or revoked key) never reach the vault, so they are not counted here.
              </div>
            </div>
          )}
        </ChainView>
      </section>

      <section className="py-3">
        <h2 className="h5">How it works</h2>
        <ol className="mb-0">
          <li>The owner funds the vault. The vault mints the agent’s key: a NEAR Function Call Key that can only call <code>request_spend</code>.</li>
          <li>The agent asks: <code>request_spend(to, amount, reason)</code>.</li>
          <li>The vault decides: <strong>PAID</strong> (approved recipient, inside caps), <strong>HELD</strong> (unknown recipient, owner decides), <strong>BLOCKED</strong> (over a cap).</li>
          <li>NEAR itself stops the key from sending NEAR directly or calling anything else. The owner can revoke it in one transaction.</li>
        </ol>
      </section>
    </>
  );
}
