import { formatNear } from '../../../scripts/lib/format.js';

export function Loading({ what = 'Reading from NEAR testnet' }) {
  return (
    <div className="d-flex align-items-center gap-2 text-secondary py-3" role="status">
      <span className="spinner-border spinner-border-sm" aria-hidden="true" />
      <span>{what}…</span>
    </div>
  );
}

/** Error state for a failed chain read. Shows the raw message; never falls back to fake numbers. */
export function ErrorBox({ error, onRetry }) {
  return (
    <div className="alert alert-danger" role="alert">
      <div className="fw-semibold">Could not read from NEAR testnet.</div>
      <pre className="small mb-2 text-wrap">{String(error?.message || error)}</pre>
      {onRetry && (
        <button className="btn btn-sm btn-outline-danger" onClick={onRetry}>
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

const CHIP = {
  PAID: 'success',
  ACTIVE: 'success',
  REVOKED: 'secondary',
  APPROVED: 'success',
  HELD: 'warning',
  BLOCKED: 'danger',
  REJECTED: 'secondary',
  REFUSED_BY_NEAR: 'dark',
  ERROR: 'danger',
};

export function StatusChip({ status }) {
  // "BLOCKED_OVER_TX_CAP" → BLOCKED, "REFUSED_BY_NEAR: KEY_NOT_FOUND" → REFUSED_BY_NEAR
  const kind = String(status).split(':')[0].replace(/^BLOCKED_.*/, 'BLOCKED');
  const text = kind === 'HELD' ? 'text-dark' : '';
  return <span className={`badge bg-${CHIP[kind] || 'secondary'} ${text}`}>{status}</span>;
}

/** "paid today / daily cap" bar. Values in yocto (strings). */
export function CapMeter({ paidToday, dailyCap, label = 'Paid today' }) {
  const paid = BigInt(paidToday);
  const cap = BigInt(dailyCap);
  const pct = cap > 0n ? Number((paid * 1000n) / cap) / 10 : 0;
  const over = paid > cap;
  return (
    <div>
      <div className="d-flex justify-content-between small">
        <span>{label}</span>
        <span className="font-monospace">
          {formatNear(paid)} / {formatNear(cap)}
        </span>
      </div>
      <div className="progress" role="progressbar" aria-valuenow={pct} aria-valuemin="0" aria-valuemax="100" aria-label={label}>
        <div className={`progress-bar ${over ? 'bg-danger' : pct >= 80 ? 'bg-warning' : 'bg-success'}`} style={{ width: `${Math.min(pct, 100)}%` }} />
      </div>
    </div>
  );
}

export function Mono({ children, className = '' }) {
  return <span className={`font-monospace text-break ${className}`}>{children}</span>;
}
