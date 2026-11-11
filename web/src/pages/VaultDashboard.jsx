// Multi-user: the dashboard for one vault, /v/<vault account>. Everything is read
// live from that vault; owner buttons show only for the vault's owner.
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { KeyPair } from 'near-api-js';
import { formatNear, nearToYocto } from '../../../scripts/lib/format.js';
import { isAccountId } from '../../../scripts/lib/config.js';
import { lockStatus } from '../../../scripts/lib/lock.js';
import { CapMeter, ChainView, Ext, Icon, Mono, PageHead, StatusChip } from '../components/ui.jsx';
import { OwnerButton, useWallet, WalletControl } from '../components/Wallet.jsx';
import { addAgentArgs, agentSnippet } from '../lib/factory.js';
import { accessKeysLink, accountLink, nsToDate, txLink } from '../lib/links.js';
import { accessKeysOf, viewAt } from '../lib/near.js';
import { outcomeFailure, outcomeHash } from '../lib/owner.js';
import { useChain } from '../lib/useChain.js';

const LOG_LIMIT = 50;

export default function VaultDashboard() {
  const { vaultId } = useParams();
  if (!isAccountId(vaultId)) return <p className="mt-4">“{vaultId}” is not a NEAR account id.</p>;
  return <Dashboard key={vaultId} vaultId={vaultId} />;
}

function Dashboard({ vaultId }) {
  const w = useWallet();
  const owner = useChain(() => viewAt(vaultId, 'get_owner'));
  const stats = useChain(() => viewAt(vaultId, 'get_stats'));
  const agents = useChain(() => viewAt(vaultId, 'get_agents'));
  const held = useChain(() => viewAt(vaultId, 'get_held'));
  const log = useChain(() => viewAt(vaultId, 'get_payments', { from_index: 0, limit: LOG_LIMIT }).then((l) => [...l].reverse()));
  const mine = Boolean(w.accountId && owner.data && w.accountId === owner.data);
  const reloadAll = () => [stats, agents, held, log].forEach((s) => s.reload());

  if (owner.error) {
    return (
      <>
        <PageHead title="Vault not found" />
        <div className="ag-panel ag-panel-pad small" role="alert">
          <Mono>{vaultId}</Mono> doesn’t answer like an AgentGate vault. <Link to="/app">Back to My vaults</Link>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHead
        title={vaultId.split('.')[0]}
        aside={
          <Ext href={accountLink(vaultId)} className="small">
            Explorer
          </Ext>
        }
      >
        <Mono>{vaultId}</Mono> · owner <Mono>{owner.data || '…'}</Mono> {mine && <span className="ag-stamp ag-stamp--paid ms-1">you</span>}
      </PageHead>

      <section className="row g-3 mb-5">
        <div className="col-12 col-lg-7">
          <div className="ag-panel ag-panel-pad h-100">
            <div className="d-flex justify-content-between align-items-start gap-2">
              <div>
                <div className="ag-label mb-1">Balance</div>
                <ChainView state={stats} what="Reading">
                  {(s) => <div className="ag-figure">{formatNear(s.vault_balance)}</div>}
                </ChainView>
              </div>
              <LockBadge vaultId={vaultId} />
            </div>
            {stats.data && (
              <>
                <div className="d-flex flex-wrap gap-3 mt-3">
                  <Tally n={stats.data.paid + stats.data.approved} label="PAID" kind="paid" />
                  <Tally n={stats.data.held_pending} label="HELD" kind="held" />
                  <Tally n={stats.data.blocked} label="BLOCKED" kind="blocked" />
                </div>
                <p className="ag-label mt-2 mb-0">
                  {stats.data.total_requests} requests · {formatNear(stats.data.total_paid)} paid by agents · {formatNear(stats.data.total_approved)} approved by
                  the owner
                </p>
              </>
            )}
          </div>
        </div>
        <div className="col-12 col-lg-5">
          <Fund vaultId={vaultId} onDone={stats.reload} />
        </div>
      </section>

      <Held held={held} vaultId={vaultId} mine={mine} onDone={reloadAll} />

      <section className="mb-5">
        <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
          <h2 className="ag-section-title mb-0">Agents</h2>
        </div>
        {mine && <AddAgent vaultId={vaultId} onDone={agents.reload} />}
        <ChainView state={agents} what="Reading agents">
          {(list) =>
            list.length === 0 ? (
              <div className="ag-panel ag-panel-pad small text-secondary">{mine ? 'No agents yet. Add one above to give an AI agent a spending key.' : 'No agents yet.'}</div>
            ) : (
              <div className="row g-3">
                {list.map((a) => (
                  <div className="col-12 col-lg-6" key={a.public_key}>
                    <AgentCard a={a} vaultId={vaultId} mine={mine} onDone={agents.reload} />
                  </div>
                ))}
              </div>
            )
          }
        </ChainView>
      </section>

      <Log log={log} />
    </>
  );
}

function Tally({ n, label, kind }) {
  return (
    <span className="ag-tally">
      <span className="ag-count fs-5">{n}</span>
      <span className={`ag-stamp ag-stamp--${kind}`}>{label}</span>
    </span>
  );
}

function LockBadge({ vaultId }) {
  const keys = useChain(() => accessKeysOf(vaultId));
  if (!keys.data) return null;
  const s = lockStatus(keys.data);
  return (
    <a className="small d-inline-flex align-items-center gap-1 text-secondary text-decoration-none" href={accessKeysLink(vaultId)} target="_blank" rel="noreferrer">
      <Icon name={s.locked ? 'lock' : 'lockOpen'} size={14} />
      {s.locked ? 'Locked: no full-access key' : `Not locked: ${s.fullAccess.length} full-access key`}
    </a>
  );
}

function Fund({ vaultId, onDone }) {
  const w = useWallet();
  const [amount, setAmount] = useState('1');
  const [state, setState] = useState({ busy: false, error: '', hash: '' });
  async function submit(e) {
    e.preventDefault();
    let y;
    try {
      y = nearToYocto(amount);
      if (y <= 0n) throw new Error('Amount must be more than 0');
    } catch (err) {
      setState({ busy: false, error: err.message, hash: '' });
      return;
    }
    setState({ busy: true, error: '', hash: '' });
    try {
      const { sendFund } = await w.load();
      const outcome = await sendFund(w.accountId, vaultId, y.toString());
      setState({ busy: false, error: outcomeFailure(outcome) || '', hash: outcomeHash(outcome) });
      onDone();
    } catch (err) {
      setState({ busy: false, error: String(err?.message || err), hash: '' });
    }
  }
  return (
    <form className="ag-panel ag-panel-pad h-100" onSubmit={submit}>
      <h2 className="h6 mb-1">Add funds</h2>
      <p className="small text-secondary mb-3">Send NEAR from your wallet to this vault. Agents can only spend it under the rules below.</p>
      {w.accountId ? (
        <div className="d-flex gap-2">
          <div className="input-group">
            <input className="form-control font-monospace" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} aria-label="Amount in NEAR" />
            <span className="input-group-text">NEAR</span>
          </div>
          <button className="btn btn-primary text-nowrap" disabled={state.busy}>
            {state.busy ? 'Confirm…' : 'Send'}
          </button>
        </div>
      ) : (
        <WalletControl />
      )}
      {state.error && <div className="small text-danger mt-2 text-break">{state.error}</div>}
      {state.hash && (
        <a className="small font-monospace d-block mt-2" href={txLink(state.hash)} target="_blank" rel="noreferrer">
          tx {state.hash.slice(0, 8)}…
        </a>
      )}
    </form>
  );
}

function Held({ held, vaultId, mine, onDone }) {
  if (!held.data || held.data.length === 0) return null;
  return (
    <section className="mb-5">
      <h2 className="ag-section-title">Waiting for the owner</h2>
      <p className="ag-section-sub">Payments to recipients that aren’t approved. They use no budget until the owner decides.</p>
      <div className="d-grid gap-3">
        {held.data.map((p) => (
          <div className="ag-panel ag-panel-pad" key={p.id}>
            <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-2">
              <div className="d-flex flex-wrap align-items-center gap-2">
                <StatusChip status="HELD" />
                <span className="font-monospace ag-muted small">#{p.id}</span>
                <span>
                  {p.agent_name} → <Mono>{p.to}</Mono>
                </span>
              </div>
              <span className="font-monospace">{formatNear(p.amount)}</span>
            </div>
            <p className="text-secondary mb-3">“{p.reason}”</p>
            {mine && (
              <div className="d-flex flex-wrap gap-2">
                <OwnerButton vaultId={vaultId} isOwner method="approve_held" args={{ payment_id: p.id }} label={`Approve and pay ${formatNear(p.amount)}`} variant="approve" onDone={onDone} />
                <OwnerButton vaultId={vaultId} isOwner method="reject_held" args={{ payment_id: p.id }} label="Reject" variant="reject" onDone={onDone} />
              </div>
            )}
            <div className="ag-label mt-2">{nsToDate(p.at)}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

function AgentCard({ a, vaultId, mine, onDone }) {
  return (
    <div className="ag-panel ag-panel-pad h-100 d-flex flex-column">
      <div className="d-flex justify-content-between align-items-start gap-2 mb-1">
        <h3 className="h6 mb-0">{a.name}</h3>
        <StatusChip status={a.active ? 'ACTIVE' : 'REVOKED'} />
      </div>
      <Mono className="small ag-muted d-block mb-3 text-break">{a.public_key}</Mono>
      <dl className="ag-doc-facts mb-3">
        <dt>Per payment</dt>
        <dd className="font-monospace">{formatNear(a.per_tx_cap)}</dd>
        <dt>Per day</dt>
        <dd className="font-monospace">{formatNear(a.daily_cap)}</dd>
        <dt>Approved</dt>
        <dd>
          {a.allowed.map((r) => (
            <Mono key={r} className="d-block">
              {r}
            </Mono>
          ))}
        </dd>
      </dl>
      <CapMeter paidToday={a.paid_today} dailyCap={a.daily_cap} label="Paid today, UTC" />
      {mine && a.active && (
        <div className="mt-auto pt-3">
          <OwnerButton vaultId={vaultId} isOwner method="revoke_agent" args={{ public_key: a.public_key }} label="Revoke this agent" variant="reject" onDone={onDone} />
        </div>
      )}
    </div>
  );
}

function AddAgent({ vaultId, onDone }) {
  const w = useWallet();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: '', perTxNear: '0.5', dailyNear: '1', recipients: '', allowanceNear: '0.25' });
  const [state, setState] = useState({ busy: false, problems: [], error: '', created: null });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    const kp = KeyPair.fromRandom('ed25519'); // made in this browser; the private key is never sent anywhere
    const { args, problems } = addAgentArgs({ ...form, publicKey: kp.getPublicKey().toString() });
    if (problems.length) return setState({ busy: false, problems, error: '', created: null });
    setState({ busy: true, problems: [], error: '', created: null });
    try {
      const { sendOwnerAction } = await w.load();
      const outcome = await sendOwnerAction(w.accountId, 'add_agent', args, vaultId);
      const failure = outcomeFailure(outcome);
      if (failure) return setState({ busy: false, problems: [], error: failure, created: null });
      setState({ busy: false, problems: [], error: '', created: { name: args.name, privateKey: kp.toString(), hash: outcomeHash(outcome) } });
      onDone();
    } catch (err) {
      setState({ busy: false, problems: [], error: String(err?.message || err), created: null });
    }
  }

  if (state.created) return <NewKey vaultId={vaultId} created={state.created} onClose={() => { setState({ busy: false, problems: [], error: '', created: null }); setOpen(false); }} />;
  if (!open)
    return (
      <button className="btn btn-primary mb-3 d-inline-flex align-items-center gap-2" onClick={() => setOpen(true)}>
        <Icon name="key" size={14} /> Add an agent
      </button>
    );

  return (
    <form className="ag-panel ag-panel-pad mb-3" onSubmit={submit}>
      <h3 className="h6 mb-1">Add an agent</h3>
      <p className="small text-secondary mb-3">
        Your browser makes a new key. The vault adds it to itself as a key that can only call <code>request_spend</code>, with the rules below. You confirm once in your wallet.
      </p>
      <div className="row g-3">
        <div className="col-12 col-md-6">
          <label className="form-label small fw-medium" htmlFor="ag-name">Agent name</label>
          <input id="ag-name" className="form-control" value={form.name} onChange={set('name')} placeholder="research-bot" />
        </div>
        <div className="col-6 col-md-3">
          <label className="form-label small fw-medium" htmlFor="ag-ptx">Max per payment</label>
          <div className="input-group">
            <input id="ag-ptx" className="form-control font-monospace" inputMode="decimal" value={form.perTxNear} onChange={set('perTxNear')} />
            <span className="input-group-text">NEAR</span>
          </div>
        </div>
        <div className="col-6 col-md-3">
          <label className="form-label small fw-medium" htmlFor="ag-day">Max per day</label>
          <div className="input-group">
            <input id="ag-day" className="form-control font-monospace" inputMode="decimal" value={form.dailyNear} onChange={set('dailyNear')} />
            <span className="input-group-text">NEAR</span>
          </div>
        </div>
        <div className="col-12 col-md-8">
          <label className="form-label small fw-medium" htmlFor="ag-to">Approved recipients</label>
          <textarea id="ag-to" className="form-control font-monospace" rows={2} value={form.recipients} onChange={set('recipients')} placeholder="api-provider.testnet, data-shop.testnet" />
          <div className="ag-label mt-1">Up to 10 accounts, separated by commas or new lines. Payments to anyone else wait for you.</div>
        </div>
        <div className="col-12 col-md-4">
          <label className="form-label small fw-medium" htmlFor="ag-gas">Gas allowance</label>
          <div className="input-group">
            <input id="ag-gas" className="form-control font-monospace" inputMode="decimal" value={form.allowanceNear} onChange={set('allowanceNear')} />
            <span className="input-group-text">NEAR</span>
          </div>
          <div className="ag-label mt-1">Paid from the vault for the agent’s transaction fees. The most a leaked key can burn.</div>
        </div>
      </div>
      {state.problems.length > 0 && (
        <ul className="small text-danger mt-3 mb-0">
          {state.problems.map((p) => <li key={p}>{p}</li>)}
        </ul>
      )}
      {state.error && <div className="small text-danger mt-3 text-break">{state.error}</div>}
      <div className="d-flex gap-2 mt-3">
        <button className="btn btn-primary" disabled={state.busy}>{state.busy ? 'Confirm in your wallet…' : 'Create agent key'}</button>
        <button type="button" className="btn btn-quiet" onClick={() => setOpen(false)}>Cancel</button>
      </div>
    </form>
  );
}

function NewKey({ vaultId, created, onClose }) {
  const snippet = agentSnippet({ vaultId, privateKey: created.privateKey });
  const [copied, setCopied] = useState(false);
  const copy = () => navigator.clipboard?.writeText(snippet).then(() => setCopied(true), () => setCopied(false));
  return (
    <div className="ag-panel ag-panel-pad mb-3 ag-newkey" role="status">
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-1">
        <h3 className="h6 mb-0">“{created.name}” is ready. Copy its key now</h3>
        {created.hash && (
          <a className="small font-monospace" href={txLink(created.hash)} target="_blank" rel="noreferrer">tx {created.hash.slice(0, 8)}…</a>
        )}
      </div>
      <p className="small text-secondary mb-3">
        This is the only time the private key is shown. AgentGate doesn’t store it. Give it to your agent like an API key. If it leaks, the worst case is the caps you set, and you can revoke it here.
      </p>
      <pre className="ag-doc-code mb-3">{snippet}</pre>
      <div className="d-flex gap-2">
        <button className="btn btn-primary" onClick={copy}>{copied ? 'Copied' : 'Copy setup'}</button>
        <button className="btn btn-quiet" onClick={onClose}>I saved it</button>
      </div>
    </div>
  );
}

function Log({ log }) {
  return (
    <section>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h2 className="ag-section-title mb-0">Activity, last {LOG_LIMIT}</h2>
        <button className="btn btn-sm btn-ghost d-inline-flex align-items-center gap-2" onClick={log.reload} disabled={log.loading}>
          <Icon name="refresh" size={14} /> Refresh
        </button>
      </div>
      <ChainView state={log} what="Reading the payment log">
        {(list) =>
          list.length === 0 ? (
            <div className="ag-panel ag-panel-pad small text-secondary">No requests yet. Every request an agent makes shows up here, including blocked ones.</div>
          ) : (
            <div className="ag-panel ag-panel-pad">
              <div className="table-responsive">
                <table className="ag-ledger">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Verdict</th>
                      <th>Agent</th>
                      <th>To</th>
                      <th className="num">Amount</th>
                      <th>Reason</th>
                      <th>Time, UTC</th>
                    </tr>
                  </thead>
                  <tbody>
                    {list.map((p) => (
                      <tr key={p.id}>
                        <td className="font-monospace ag-muted">{p.id}</td>
                        <td>
                          <StatusChip status={p.code} />
                        </td>
                        <td className="text-secondary text-nowrap">{p.agent_name}</td>
                        <td>
                          <span className="font-monospace small text-nowrap">{p.to}</span>
                        </td>
                        <td className="num">{formatNear(p.amount)}</td>
                        <td className="text-secondary" style={{ minWidth: '12rem' }}>
                          {p.reason}
                        </td>
                        <td className="font-monospace small ag-muted text-nowrap">{nsToDate(p.at).replace(' UTC', '')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )
        }
      </ChainView>
    </section>
  );
}
