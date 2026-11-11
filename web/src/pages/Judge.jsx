import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { describeStep } from '../../../scripts/lib/attacks.js';
import { formatNear, nearToYocto } from '../../../scripts/lib/format.js';
import { CapMeter, ErrorBox, Mono, StatusChip } from '../components/ui.jsx';
import { ALL_IDS, ATTACKS, proofs, refreshMeter, runAttacks } from '../lib/judge.js';
import { accessKeysLink } from '../lib/links.js';
import { attackContext, cfg, isReady } from '../lib/near.js';

function ResultCell({ row, running }) {
  if (running) return <span className="spinner-border spinner-border-sm" aria-label="running" />;
  if (!row) return <span className="text-secondary">not run</span>;
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
          <a key={i} className="d-block font-monospace" href={p.href} target="_blank" rel="noreferrer">
            tx {p.text} ↗
          </a>
        ) : (
          <Mono key={i} className="d-block">
            {p.text}
          </Mono>
        ),
      )}
    </div>
  );
}

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
      <h1 className="h3">Attack Lab</h1>
      <p className="text-secondary">
        These buttons sign real NEAR testnet transactions in your browser with the public api-buyer key (and the revoked old-bot key).
        No wallet, no signup.
      </p>

      <div className="card mb-4">
        <div className="card-body">
          <h2 className="h6">Judge path (60 seconds)</h2>
          <ol className="mb-0 small">
            <li>Press <strong>Run all attacks</strong>. Each attack is a real testnet transaction (about a minute in total).</li>
            <li>Read each row: what the attack expects, what actually happened, and the proof (explorer link, or NEAR’s raw refusal).</li>
            <li>Watch the meter: today’s total never goes past the daily cap, however many times J4 runs.</li>
            <li>
              Open the <a href={accessKeysLink(cfg.vaultAccountId)} target="_blank" rel="noreferrer">vault’s access keys ↗</a>: the agent key is a
              FunctionCall key for <code>request_spend</code> only.
            </li>
            <li>
              The key is public (<Link to="/agents">Agents page</Link>). Try it yourself with any NEAR tool.
            </li>
          </ol>
        </div>
      </div>

      <div className="row g-3 align-items-end mb-3">
        <div className="col-12 col-md-5">
          <button className="btn btn-danger btn-lg w-100" onClick={() => run(ALL_IDS)} disabled={busy || !isReady}>
            {busy ? 'Running…' : 'Run all attacks'}
          </button>
        </div>
        <div className="col-12 col-md-7">
          {meter?.error ? (
            <ErrorBox error={meter.error} />
          ) : meter ? (
            <CapMeter paidToday={meter.paidToday} dailyCap={meter.dailyCap} label="api-buyer: today’s total vs daily cap (live)" />
          ) : (
            <div className="small text-secondary">Reading today’s total…</div>
          )}
        </div>
      </div>

      {done.length > 0 && !busy && (
        <div className={`alert ${passed === done.length ? 'alert-success' : 'alert-warning'}`}>
          {passed} of {done.length} attacks were refused as expected.
        </div>
      )}

      <div className="table-responsive">
        <table className="table align-middle">
          <thead>
            <tr>
              <th style={{ minWidth: '14rem' }}>Attack</th>
              <th>Expected</th>
              <th>Actual</th>
              <th>Proof</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {ATTACKS.map((a) => {
              const row = rows[a.id];
              return (
                <tr key={a.id} className={row ? (row.pass ? 'table-success' : 'table-danger') : ''}>
                  <td>
                    <div className="fw-semibold">
                      {a.id} {a.name}
                    </div>
                    <div className="small text-secondary">{a.explain}</div>
                    <details className="small">
                      <summary>What it sends</summary>
                      {a.steps(cfg).map((s, i) => (
                        <Mono key={i} className="d-block">
                          {describeStep(s)}
                        </Mono>
                      ))}
                    </details>
                  </td>
                  <td className="small">{a.expected}</td>
                  <td>
                    <ResultCell row={row} running={running === a.id} />
                  </td>
                  <td>
                    <ProofCell row={row} />
                  </td>
                  <td>
                    <button className="btn btn-sm btn-outline-danger text-nowrap" onClick={() => run([a.id])} disabled={busy || !isReady}>
                      Run {a.id}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="small text-secondary">
        Per payment cap and daily cap come from the vault (see Agents). The agent key’s gas allowance ({formatNear(nearToYocto(cfg.agents.apiBuyer.keyAllowanceNear))}) pays for these
        transactions; a leaked key can burn it, but it can’t move the vault’s money.
      </p>
    </>
  );
}
