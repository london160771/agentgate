import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { describeStep } from '../../../scripts/lib/attacks.js';
import { formatNear, nearToYocto } from '../../../scripts/lib/format.js';
import { CapMeter, ErrorBox, Ext, Icon, Mono, PageHead, StatusChip } from '../components/ui.jsx';
import { ALL_IDS, ATTACKS, proofs, refreshMeter, runAttacks } from '../lib/judge.js';
import { accessKeysLink } from '../lib/links.js';
import { attackContext, cfg, isReady } from '../lib/near.js';

function ResultCell({ row, running }) {
  if (running)
    return (
      <span className="d-inline-flex align-items-center gap-2 small text-secondary">
        <span className="spinner-border spinner-border-sm" aria-hidden="true" /> Sending
      </span>
    );
  if (!row) return <span className="small ag-muted text-nowrap">Not run</span>;
  return (
    <div>
      <div className="d-flex flex-wrap gap-1">
        {row.steps.length ? row.steps.map((s, i) => <StatusChip key={i} status={s.label} />) : <StatusChip status="ERROR" />}
      </div>
      {row.note && <div className="small text-secondary mt-1">{row.note}</div>}
    </div>
  );
}

function ProofCell({ row }) {
  if (!row) return null;
  return (
    <div className="small">
      {proofs(row).map((p, i) =>
        p.kind === 'tx' ? (
          <a key={i} className="d-block font-monospace text-nowrap" href={p.href} target="_blank" rel="noreferrer">
            tx {p.text}
          </a>
        ) : (
          <Mono key={i} className="d-block ag-muted">
            {p.text}
          </Mono>
        ),
      )}
    </div>
  );
}

const PATH = [
  <>Press <strong>Run all attacks</strong>. Each attack is a real testnet transaction, about a minute in total.</>,
  <>Read each row: what the attack expects, what happened, and the proof (an explorer link, or NEAR’s raw refusal).</>,
  <>Watch the gauge. Today’s total never passes the daily cap, however many times J4 runs.</>,
];

export default function Judge() {
  const [rows, setRows] = useState({});
  const [running, setRunning] = useState(null);
  const [busy, setBusy] = useState(false);
  const [meter, setMeter] = useState(null);

  useEffect(() => {
    if (isReady) refreshMeter(attackContext(), setMeter);
  }, []);

  async function run(ids) {
    setBusy(true);
    try {
      await runAttacks(ids, attackContext(), {
        onStart: setRunning,
        onRow: (row) => setRows((r) => ({ ...r, [row.id]: row })),
        onMeter: setMeter,
      });
    } finally {
      setRunning(null);
      setBusy(false);
    }
  }

  const done = Object.values(rows);
  const passed = done.filter((r) => r.pass).length;

  return (
    <>
      <PageHead title="Attack lab">
        These buttons sign real NEAR testnet transactions in your browser with the public api-buyer key, and the revoked old-bot key. No wallet, no
        signup.
      </PageHead>

      <div className="row g-3 mb-4 ag-enter-2">
        <div className="col-12 col-lg-7">
          <div className="ag-panel ag-panel-pad h-100">
            <h2 className="h6 mb-3">Judge path, 60 seconds</h2>
            <ol className="list-unstyled mb-0 d-grid gap-2">
              {[
                ...PATH,
                <>
                  Open the <Ext href={accessKeysLink(cfg.vaultAccountId)}>vault’s access keys</Ext>. The agent key is a FunctionCall key for <code>request_spend</code> only.
                </>,
                <>
                  The key is public on the <Link to="/agents">Agents page</Link>. Try it yourself with any NEAR tool.
                </>,
              ].map((text, i) => (
                <li className="d-flex gap-3 small" key={i}>
                  <span className="ag-step-num">{String(i + 1).padStart(2, '0')}</span>
                  <span className="text-secondary">{text}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>
        <div className="col-12 col-lg-5">
          <div className="ag-panel ag-panel-pad h-100 d-flex flex-column justify-content-between gap-4">
            <div>
              <div className="ag-label mb-2">api-buyer paid today (UTC) vs its daily cap, live</div>
              {meter?.error ? (
                <ErrorBox error={meter.error} />
              ) : meter ? (
                <>
                  <div className="ag-figure mb-3">
                    {formatNear(meter.paidToday)} <span className="ag-muted" style={{ fontSize: 18 }}>/ {formatNear(meter.dailyCap)}</span>
                  </div>
                  <CapMeter paidToday={meter.paidToday} dailyCap={meter.dailyCap} label="Paid today, UTC" compact />
                </>
              ) : (
                <div className="small text-secondary">Reading today’s total…</div>
              )}
            </div>
            <button className="btn btn-primary btn-lg w-100 d-inline-flex align-items-center justify-content-center gap-2" onClick={() => run(ALL_IDS)} disabled={busy || !isReady}>
              <Icon name="play" size={14} />
              {busy ? 'Running…' : 'Run all attacks'}
            </button>
          </div>
        </div>
      </div>

      {done.length > 0 && !busy && (
        <div className="ag-panel px-4 py-3 mb-4 d-flex align-items-center gap-3">
          <span className={`ag-stamp ag-stamp--${passed === done.length ? 'paid' : 'blocked'}`}>
            {passed}/{done.length}
          </span>
          <span>
            {passed} of {done.length} attacks ended as expected
          </span>
        </div>
      )}

      <div className="ag-panel ag-panel-pad">
        <div className="table-responsive">
          <table className="ag-ledger">
            <thead>
              <tr>
                <th style={{ minWidth: '16rem' }}>Attack</th>
                <th style={{ minWidth: '12rem' }}>Expected</th>
                <th>Actual</th>
                <th>Proof</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {ATTACKS.map((a) => {
                const row = rows[a.id];
                return (
                  <tr key={a.id} className={row ? (row.pass ? 'ag-row-pass' : 'ag-row-fail') : ''}>
                    <td>
                      <div className="fw-medium">
                        <span className="font-monospace ag-muted me-2">{a.id}</span>
                        {a.name}
                      </div>
                      <div className="small text-secondary mt-1">{a.explain}</div>
                      <details className="small mt-1">
                        <summary className="ag-muted">What it sends</summary>
                        {a.steps(cfg).map((s, i) => (
                          <Mono key={i} className="d-block ag-muted mt-1">
                            {describeStep(s)}
                          </Mono>
                        ))}
                      </details>
                    </td>
                    <td className="small font-monospace text-secondary">{a.expected}</td>
                    <td>
                      <ResultCell row={row} running={running === a.id} />
                    </td>
                    <td>
                      <ProofCell row={row} />
                    </td>
                    <td className="text-end">
                      <button className="btn btn-sm btn-quiet text-nowrap" onClick={() => run([a.id])} disabled={busy || !isReady}>
                        Run {a.id}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      <p className="small text-secondary mt-3">
        The per payment cap and daily cap come from the vault, see Agents. The agent key’s gas allowance ({formatNear(nearToYocto(cfg.agents.apiBuyer.keyAllowanceNear))}) pays for
        these transactions. A leaked key can burn it, but it can’t move the vault’s money.
      </p>
    </>
  );
}
