import { formatNear } from '../../../scripts/lib/format.js';
import { ChainView, Ext, Icon, Mono, PageHead, StatusChip } from '../components/ui.jsx';
import { OwnerButton, useWallet } from '../components/Wallet.jsx';
import { accountLink, nsToDate } from '../lib/links.js';
import { cfg, viewVault } from '../lib/near.js';
import { useChain } from '../lib/useChain.js';

function Refresh({ state }) {
  return (
    <button className="btn btn-sm btn-ghost d-inline-flex align-items-center gap-2" onClick={state.reload} disabled={state.loading}>
      <Icon name="refresh" size={14} />
      Refresh
    </button>
  );
}

function HeldQueue({ onChange }) {
  const held = useChain(() => viewVault('get_held'));
  const { isOwner } = useWallet();
  const done = () => {
    held.reload();
    onChange();
  };
  return (
    <section className="mb-5 ag-enter-2">
      <div className="d-flex justify-content-between align-items-center mb-1">
        <h2 className="ag-section-title">Held for the owner</h2>
        <Refresh state={held} />
      </div>
      <p className="ag-section-sub">
        Payments to unknown recipients wait here and use no budget. The owner approves or rejects them, from the buttons after signing in or from
        the CLI.
      </p>
      <ChainView state={held} what="Reading the held queue">
        {(list) =>
          list.length === 0 ? (
            <div className="ag-panel ag-panel-pad small text-secondary">Nothing held right now</div>
          ) : (
            <div className="d-grid gap-3">
              {list.map((p) => (
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
                  {isOwner && (
                    <div className="d-flex flex-wrap gap-2 mb-3">
                      <OwnerButton method="approve_held" args={{ payment_id: p.id }} label={`Approve and pay ${formatNear(p.amount)}`} variant="approve" onDone={done} />
                      <OwnerButton method="reject_held" args={{ payment_id: p.id }} label="Reject" variant="reject" onDone={done} />
                    </div>
                  )}
                  <div className="d-flex flex-wrap justify-content-between align-items-end gap-2">
                    <code className="ag-keyblock flex-grow-1" style={{ fontSize: 12 }}>
                      node scripts/owner.js approve {p.id}
                      <br />
                      node scripts/owner.js reject {p.id}
                    </code>
                  </div>
                  <div className="ag-label mt-2">{nsToDate(p.at)}</div>
                </div>
              ))}
            </div>
          )
        }
      </ChainView>
    </section>
  );
}

function PaymentLog({ log }) {
  return (
    <section>
      <div className="d-flex justify-content-between align-items-center mb-1">
        <h2 className="ag-section-title">Payment log, last {cfg.logMax}</h2>
        <Refresh state={log} />
      </div>
      <p className="ag-section-sub">
        Every request the vault decided, including blocked ones. The contract doesn’t store transaction hashes, and each request is a transaction on{' '}
        <Ext href={accountLink(cfg.vaultAccountId)}>the vault’s explorer page</Ext>
      </p>
      <ChainView state={log} what="Reading the payment log">
        {(list) =>
          list.length === 0 ? (
            <div className="ag-panel ag-panel-pad small text-secondary">No payments yet</div>
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
                        <td className="text-secondary">{p.agent_name}</td>
                        <td>
                          <Mono className="small">{p.to}</Mono>
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

export default function Activity() {
  const log = useChain(() => viewVault('get_payments', { from_index: 0, limit: cfg.logMax }).then((l) => [...l].reverse()));
  return (
    <>
      <PageHead title="Activity">Every decision the vault made, newest first, with the held queue on top.</PageHead>
      <HeldQueue onChange={log.reload} />
      <PaymentLog log={log} />
    </>
  );
}
