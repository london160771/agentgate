import { formatNear } from '../../../scripts/lib/format.js';

// A few line icons (paths from lucide, ISC license), 16px, stroke 1.5, text color.
const ICONS = {
  arrowUpRight: (
    <>
      <path d="M7 7h10v10" />
      <path d="M7 17 17 7" />
    </>
  ),
  lock: (
    <>
      <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </>
  ),
  lockOpen: (
    <>
      <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 9.9-1" />
    </>
  ),
  play: <polygon points="6 3 20 12 6 21 6 3" />,
  refresh: (
    <>
      <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
      <path d="M8 16H3v5" />
    </>
  ),
  key: (
    <>
      <path d="M2.586 17.414A2 2 0 0 0 2 18.828V21a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h1a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h.172a2 2 0 0 0 1.414-.586l.814-.814a6.5 6.5 0 1 0-4-4z" />
      <circle cx="16.5" cy="7.5" r=".5" fill="currentColor" />
    </>
  ),
  arrowRight: (
    <>
      <path d="M5 12h14" />
      <path d="m12 5 7 7-7 7" />
    </>
  ),
};

export function Icon({ name, size = 16, className = '' }) {
  return (
    <svg className={`ag-icon ${className}`} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {ICONS[name]}
    </svg>
  );
}

/** Link that opens in a new tab, with the arrow icon. */
export function Ext({ href, children, className = '' }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className={`d-inline-flex align-items-center gap-1 ${className}`}>
      {children}
      <Icon name="arrowUpRight" size={14} />
    </a>
  );
}

/** The product mark: a gate (two posts and a bar) in one solid color. */
export function Mark({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" aria-hidden="true">
      <rect x="1" y="1" width="18" height="18" rx="5" fill="var(--ag-accent)" />
      <rect x="5.5" y="5" width="2" height="10" rx="1" fill="#fff" />
      <rect x="12.5" y="5" width="2" height="10" rx="1" fill="#fff" />
      <rect x="5.5" y="9" width="9" height="2" rx="1" fill="#fff" />
    </svg>
  );
}

export function Loading({ what = 'Reading from NEAR testnet' }) {
  return (
    <div className="d-flex align-items-center gap-2 text-secondary py-3 small" role="status">
      <span className="spinner-border spinner-border-sm" aria-hidden="true" />
      <span>{what}…</span>
    </div>
  );
}

/** Error state for a failed chain read. Shows the raw message; never falls back to fake numbers. */
export function ErrorBox({ error, onRetry }) {
  return (
    <div className="ag-panel ag-panel-pad ag-incident" role="alert">
      <div className="fw-medium mb-1">Could not read from NEAR testnet</div>
      <pre className="small text-secondary mb-3 text-wrap font-monospace">{String(error?.message || error)}</pre>
      {onRetry && (
        <button className="btn btn-sm btn-quiet" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  );
}

/** Wraps a useChain() result with loading and error states. */
export function ChainView({ state, children, what }) {
  if (state.loading && state.data === undefined) return <Loading what={what} />;
  if (state.error) return <ErrorBox error={state.error} onRetry={state.reload} />;
  return children(state.data);
}

const STAMP = {
  PAID: 'paid',
  OK_PAID: 'paid',
  ACTIVE: 'paid',
  APPROVED: 'paid',
  HELD: 'held',
  BLOCKED: 'blocked',
  ERROR: 'blocked',
  REFUSED_BY_NEAR: 'refused',
  REVOKED: 'neutral',
  REJECTED: 'neutral',
};

/** Kind of a verdict label: "BLOCKED_OVER_TX_CAP" → blocked, "REFUSED_BY_NEAR: KEY_NOT_FOUND" → refused. */
export function stampKind(status) {
  const head = String(status).split(':')[0].replace(/^(BLOCKED|HELD|APPROVED|REJECTED)_.*/, '$1');
  return STAMP[head] || 'neutral';
}

/** The verdict stamp: every decision on every page uses this one style. */
export function StatusChip({ status }) {
  return <span className={`ag-stamp ag-stamp--${stampKind(status)}`}>{status}</span>;
}

/** "paid today / daily cap" gauge. Values in yocto (strings). */
export function CapMeter({ paidToday, dailyCap, label = 'Paid today', compact = false }) {
  const paid = BigInt(paidToday);
  const cap = BigInt(dailyCap);
  const pct = cap > 0n ? Number((paid * 1000n) / cap) / 10 : 0;
  const over = paid > cap;
  return (
    <div>
      <div className={`justify-content-between align-items-baseline gap-3 mb-2 ${compact ? 'd-none' : 'd-flex'}`}>
        <span className="ag-label">{label}</span>
        <span className="font-monospace small">
          {formatNear(paid)} <span className="ag-muted">/ {formatNear(cap)}</span>
        </span>
      </div>
      <div className="ag-gauge-track" role="progressbar" aria-valuenow={pct} aria-valuemin="0" aria-valuemax="100" aria-label={label}>
        <div className={`ag-gauge-fill ${over ? 'is-over' : pct >= 80 ? 'is-high' : ''}`} style={{ width: `${Math.min(pct, 100)}%` }} />
      </div>
    </div>
  );
}

export function Mono({ children, className = '' }) {
  return <span className={`font-monospace text-break ${className}`}>{children}</span>;
}

/** Page header: title + one line. */
export function PageHead({ title, children, aside }) {
  return (
    <header className="d-flex flex-wrap align-items-end justify-content-between gap-3 pt-5 pb-4 ag-enter">
      <div>
        <h1 className="ag-page-title">{title}</h1>
        {children && <p className="ag-page-sub">{children}</p>}
      </div>
      {aside}
    </header>
  );
}
