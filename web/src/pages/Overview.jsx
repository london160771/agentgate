import { Link } from 'react-router-dom';
import { formatNear, shortKey } from '../../../scripts/lib/format.js';
import { lockStatus } from '../../../scripts/lib/lock.js';
import { ChainView, Ext, Icon, Mono, StatusChip } from '../components/ui.jsx';
import { accessKeysLink, accountLink } from '../lib/links.js';
import { cfg, vaultAccessKeys, viewVault } from '../lib/near.js';
import { useChain } from '../lib/useChain.js';

/** Live lock status (P1-b): locked = no full-access key on the vault account. */
function LockLine() {
  const keys = useChain(vaultAccessKeys);
  if (keys.loading) return <span className="ag-label">Checking vault keys…</span>;
  if (keys.error) return <span className="ag-label">Vault keys unavailable</span>;
  const s = lockStatus(keys.data);
  return (
    <a className="small d-inline-flex align-items-center gap-1 text-secondary text-decoration-none" href={accessKeysLink(cfg.vaultAccountId)} target="_blank" rel="noreferrer">
      <Icon name={s.locked ? 'lock' : 'lockOpen'} size={14} />
      {s.locked ? 'Locked: no full-access key' : `Not locked: ${s.fullAccess.length} full-access key`}
    </a>
  );
}

function Count({ label, value, kind, note }) {
  return (
    <div className="col-4">
      <div className="ag-figure ag-count">
        {value}
      </div>
      <div className="mt-2">
        <span className={`ag-stamp ag-stamp--${kind}`}>{label}</span>
      </div>
      {note && <div className="ag-label mt-1">{note}</div>}
    </div>
  );
}

/** The moment: the vault's real latest decisions, as a ledger card. */
function LedgerCard() {
  const stats = useChain(() => viewVault('get_stats'));
  const latest = useChain(() => viewVault('get_payments', { from_index: 0, limit: cfg.logMax }).then((l) => [...l].reverse().slice(0, 2)));
  return (
    <div className="ag-ledger-card ag-enter-2">
      <div className="ag-card-head">
        <span className="fw-medium text-nowrap">Vault right now</span>
        <LockLine />
      </div>
      <div className="ag-card-body">
        <ChainView state={stats} what="Reading vault stats">
          {(s) => (
            <>
              <div className="ag-label mb-2">Balance</div>
              <div className="ag-figure mb-4">{formatNear(s.vault_balance)}</div>
              <div className="row g-3 mb-3">
                <Count label="PAID" value={s.paid} kind="paid" />
                <Count label="HELD" value={s.held} kind="held" note={`${s.held_pending} waiting`} />
                <Count label="BLOCKED" value={s.blocked} kind="blocked" />
              </div>
              <p className="ag-label mb-4">
                {formatNear(s.total_paid)} paid by agents · {formatNear(s.total_approved)} approved by the owner · {s.total_requests} requests. NEAR’s own
                refusals never reach the vault, so they aren’t counted here.
              </p>
            </>
          )}
        </ChainView>
        <div className="ag-label mb-2">Latest decisions</div>
        <div className="ag-raised px-3 py-3">
          <ChainView state={latest} what="Reading the payment log">
            {(list) =>
              list.length === 0 ? (
                <div className="small text-secondary">No payments yet</div>
              ) : (
                list.map((p) => (
                  <div className="ag-receipt" key={p.id}>
                    <StatusChip status={p.code} />
                    <span className="font-monospace small text-nowrap">{formatNear(p.amount)}</span>
                    <div className="small text-secondary text-truncate ag-receipt-reason">“{p.reason}”</div>
                  </div>
                ))
              )
            }
          </ChainView>
        </div>
      </div>
      <div className="ag-card-foot">
        <span className="small text-secondary d-inline-flex align-items-center gap-2">
          <Icon name="key" size={14} />
          Agent key {shortKey(cfg.demoKeys.apiBuyerPublicKey)} can only call <code>request_spend</code>
        </span>
        <Ext href={accessKeysLink(cfg.vaultAccountId)} className="small">
          Explorer
        </Ext>
      </div>
    </div>
  );
}

const STEPS = [
  ['Fund and mint', <>The owner funds the vault. The vault mints the agent’s key: a NEAR Function Call Key that can only call <code>request_spend</code>.</>],
  ['The agent asks', <>Every payment is a request: <Mono>request_spend(to, amount, reason)</Mono>. The model never holds the money.</>],
  ['The vault decides', <>Paid for an approved recipient inside the caps. Held for an unknown recipient. Blocked over a cap.</>],
  ['NEAR guards the key', <>The key can’t send NEAR directly or call anything else, and the owner can revoke it in one transaction.</>],
];

export default function Overview() {
  return (
    <>
      <section className="ag-hero">
        <div className="row g-5 align-items-center">
          <div className="col-12 col-lg-6 ag-enter">
            <a className="ag-eyebrow" href={accountLink(cfg.vaultAccountId)} target="_blank" rel="noreferrer">
              <span className="ag-dot" aria-hidden="true" />
              Live on NEAR testnet · real transactions
            </a>
            <h1>
              The AI can be fooled.
              <br />
              <span className="ag-hero-em">The money can’t.</span>
            </h1>
            <p className="ag-hero-sub">
              AgentGate is a NEAR vault for AI agents. The agent’s key can only <em className="fst-normal text-body">ask</em> the vault to pay,
              and the contract decides what money moves.
            </p>
            <div className="d-flex flex-wrap gap-3">
              <Link to="/judge" className="btn btn-primary btn-lg btn-icon-end d-inline-flex align-items-center gap-2">
                Try to break it
                <Icon name="arrowRight" />
              </Link>
              <Link to="/agents" className="btn btn-quiet btn-lg">
                See the rules
              </Link>
            </div>
          </div>
          <div className="col-12 col-lg-6">
            <div className="ag-hero-visual">
              <img
                className="ag-hero-photo"
                src="/hero-vault-1200.webp"
                srcSet="/hero-vault-700.webp 700w, /hero-vault-1200.webp 1200w"
                sizes="(min-width: 992px) 50vw, 100vw"
                alt=""
              />
              <LedgerCard />
              <a className="ag-photo-credit" href="https://unsplash.com/photos/steel-bank-vault-door-locking-wheel-3wPJxh-piRw" target="_blank" rel="noreferrer">
                Photo: Jason Dent / Unsplash
              </a>
            </div>
          </div>
        </div>
      </section>

      <section className="ag-section">
        <h2 className="ag-section-title">The weak point it removes</h2>
        <p className="ag-section-sub">In both cases the agent’s key was the money’s key, so whoever steered the agent’s words also moved the money.</p>
        <div className="row g-3">
          <div className="col-12 col-md-6">
            <div className="ag-panel ag-panel-pad h-100 ag-incident">
              <div className="ag-label mb-2 font-monospace">Freysa · Nov 2024</div>
              <p className="mb-0">After 482 tries, one message talked an AI agent into sending its whole prize pool.</p>
            </div>
          </div>
          <div className="col-12 col-md-6">
            <div className="ag-panel ag-panel-pad h-100 ag-incident">
              <div className="ag-label mb-2 font-monospace">AIXBT · Mar 2025</div>
              <p className="mb-0">An attacker queued two prompts on its dashboard and the agent sent 55.5 ETH.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="ag-section">
        <h2 className="ag-section-title">How it works</h2>
        <p className="ag-section-sub">Three of these rules live in the vault contract. The last one is enforced by the NEAR protocol itself.</p>
        <div className="row g-3">
          {STEPS.map(([title, text], i) => (
            <div className="col-12 col-sm-6 col-lg-3" key={title}>
              <div className="ag-panel ag-panel-pad ag-step">
                <div className="ag-step-num mb-3">{i + 1}</div>
                <div className="fw-semibold mb-1">{title}</div>
                <p className="small text-secondary mb-0">{text}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
