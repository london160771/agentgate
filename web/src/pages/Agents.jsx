import { formatNear } from '../../../scripts/lib/format.js';
import { CapMeter, ChainView, Mono, StatusChip } from '../components/ui.jsx';
import { accessKeysLink } from '../lib/links.js';
import { cfg, viewVault } from '../lib/near.js';
import { useChain } from '../lib/useChain.js';

export default function Agents() {
  const agents = useChain(() => viewVault('get_agents'));
  return (
    <>
      <h1 className="h3">Agents & Rules</h1>
      <p className="text-secondary">
        Rules live in the vault contract. Agent keys can’t change them: NEAR only lets them call <code>request_spend</code>.{' '}
        <a href={accessKeysLink(cfg.vaultAccountId)} target="_blank" rel="noreferrer">
          See the keys on the explorer ↗
        </a>
      </p>

      <div className="card border-danger mb-4">
        <div className="card-body">
          <h2 className="h6 card-title">The api-buyer private key. This key is public on purpose. Try to drain the vault.</h2>
          <Mono className="d-block bg-light p-2 rounded small">{cfg.demoKeys.apiBuyerPrivateKey}</Mono>
          <div className="small text-secondary mt-2">
            Account: <Mono>{cfg.vaultAccountId}</Mono>. It can only call <code>request_spend</code>; the vault decides the rest.
          </div>
        </div>
      </div>

      <ChainView state={agents} what="Reading agents">
        {(list) => (
          <div className="row g-3">
            {list.map((a) => (
              <div className="col-12 col-lg-6" key={a.public_key}>
                <div className="card h-100">
                  <div className="card-body">
                    <div className="d-flex justify-content-between align-items-start gap-2">
                      <h2 className="h5 card-title mb-1">{a.name}</h2>
                      <StatusChip status={a.active ? 'ACTIVE' : 'REVOKED'} />
                    </div>
                    <Mono className="small text-secondary d-block mb-3">{a.public_key}</Mono>
                    <dl className="row small mb-3">
                      <dt className="col-5">Per payment cap</dt>
                      <dd className="col-7">{formatNear(a.per_tx_cap)}</dd>
                      <dt className="col-5">Daily cap</dt>
                      <dd className="col-7">{formatNear(a.daily_cap)}</dd>
                      <dt className="col-5">Approved recipients</dt>
                      <dd className="col-7">
                        {a.allowed.map((r) => (
                          <Mono key={r} className="d-block">
                            {r}
                          </Mono>
                        ))}
                      </dd>
                    </dl>
                    <CapMeter paidToday={a.paid_today} dailyCap={a.daily_cap} label="Paid today (UTC)" />
                    {!a.active && <div className="small text-secondary mt-2">Revoked: the vault deleted this key, so NEAR refuses anything it signs.</div>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </ChainView>
    </>
  );
}
