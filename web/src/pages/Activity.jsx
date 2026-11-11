import { formatNear } from '../../../scripts/lib/format.js';
import { ChainView, Mono, StatusChip } from '../components/ui.jsx';
import { accountLink, nsToDate } from '../lib/links.js';
import { cfg, viewVault } from '../lib/near.js';
import { useChain } from '../lib/useChain.js';

function HeldQueue() {
  const held = useChain(() => viewVault('get_held'));
  return (
    <section className="mb-4">
      <div className="d-flex justify-content-between align-items-center">
        <h2 className="h5 mb-2">Held for the owner</h2>
        <button className="btn btn-sm btn-outline-secondary" onClick={held.reload} disabled={held.loading}>
          Refresh
        </button>
      </div>
      <p className="small text-secondary">
        Payments to unknown recipients wait here. They use no budget. Owner actions are CLI only in this MVP, run from the repo root.
      </p>
      <ChainView state={held} what="Reading the held queue">
        {(list) =>
          list.length === 0 ? (
            <div className="text-secondary small">Nothing held right now.</div>
          ) : (
            <div className="list-group">
              {list.map((p) => (
                <div className="list-group-item" key={p.id}>
                  <div className="d-flex flex-wrap justify-content-between gap-2">
                    <div>
                      <StatusChip status="HELD" /> <strong>#{p.id}</strong> {p.agent_name} → <Mono>{p.to}</Mono> · {formatNear(p.amount)}
                    </div>
                    <span className="small text-secondary">{nsToDate(p.at)}</span>
                  </div>
                  <div className="small mt-1">“{p.reason}”</div>
                  <Mono className="d-block small bg-light rounded p-2 mt-2">
                    node scripts/owner.js approve {p.id}
                    <br />
                    node scripts/owner.js reject {p.id}
                  </Mono>
                </div>
              ))}
            </div>
          )
        }
      </ChainView>
    </section>
  );
}

function PaymentLog() {
  // get_payments returns the kept log (last logMax entries) oldest first; show newest first.
  const log = useChain(() => viewVault('get_payments', { from_index: 0, limit: cfg.logMax }).then((l) => [...l].reverse()));
  return (
    <section>
      <div className="d-flex justify-content-between align-items-center">
        <h2 className="h5 mb-2">Payment log (last {cfg.logMax})</h2>
        <button className="btn btn-sm btn-outline-secondary" onClick={log.reload} disabled={log.loading}>
          Refresh
        </button>
      </div>
      <p className="small text-secondary">
        Every request the vault decided, including blocked ones. The contract does not store transaction hashes; each request is a
        transaction on{' '}
        <a href={accountLink(cfg.vaultAccountId)} target="_blank" rel="noreferrer">
          the vault’s explorer page ↗
        </a>
        .
      </p>
      <ChainView state={log} what="Reading the payment log">
        {(list) =>
          list.length === 0 ? (
            <div className="text-secondary small">No payments yet.</div>
          ) : (
            <div className="table-responsive">
              <table className="table table-sm align-middle small">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Status</th>
                    <th>Code</th>
                    <th>Agent</th>
                    <th>To</th>
                    <th className="text-end">Amount</th>
                    <th>Reason</th>
                    <th>Time</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((p) => (
                    <tr key={p.id}>
                      <td>{p.id}</td>
                      <td>
                        <StatusChip status={p.status} />
                      </td>
                      <td>
                        <Mono>{p.code}</Mono>
                      </td>
                      <td>{p.agent_name}</td>
                      <td>
                        <Mono>{p.to}</Mono>
                      </td>
                      <td className="text-end text-nowrap">{formatNear(p.amount)}</td>
                      <td className="text-break">{p.reason}</td>
                      <td className="text-nowrap">{nsToDate(p.at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        }
      </ChainView>
    </section>
  );
}

export default function Activity() {
  return (
    <>
      <h1 className="h3">Activity</h1>
      <HeldQueue />
      <PaymentLog />
    </>
  );
}
