import { formatNear } from '../../../scripts/lib/format.js';
import { CapMeter, ChainView, Ext, Icon, Mono, PageHead, StatusChip } from '../components/ui.jsx';
import { OwnerButton } from '../components/Wallet.jsx';
import { accessKeysLink } from '../lib/links.js';
import { cfg, viewVault } from '../lib/near.js';
import { useChain } from '../lib/useChain.js';

function Rule({ label, children }) {
  return (
    <div className="d-flex justify-content-between gap-3 py-2" style={{ borderTop: '1px solid var(--ag-line)' }}>
      <span className="small text-secondary">{label}</span>
      <span className="small text-end">{children}</span>
    </div>
  );
}

export default function Agents() {
  const agents = useChain(() => viewVault('get_agents'));
  return (
    <>
      <PageHead title="Agents and rules" aside={<Ext href={accessKeysLink(cfg.vaultAccountId)} className="small">Keys on the explorer</Ext>}>
        Rules live in the vault contract. Agent keys can’t change them, because NEAR only lets them call <code>request_spend</code>.
      </PageHead>

      <section className="ag-panel ag-panel-pad mb-4 ag-enter-2">
        <div className="d-flex align-items-center gap-2 mb-1">
          <Icon name="key" />
          <h2 className="h6 mb-0">The api-buyer private key is public on purpose. Try to drain the vault</h2>
        </div>
        <p className="small text-secondary mb-3">
          It signs as <Mono>{cfg.vaultAccountId}</Mono> and can only call <code>request_spend</code>. The vault decides the rest.
        </p>
        <code className="ag-keyblock">{cfg.demoKeys.apiBuyerPrivateKey}</code>
      </section>

      <ChainView state={agents} what="Reading agents">
        {(list) => (
          <div className="row g-3">
            {list.map((a) => (
              <div className="col-12 col-lg-6" key={a.public_key}>
                <div className="ag-panel ag-panel-pad h-100 d-flex flex-column">
                  <div className="d-flex justify-content-between align-items-start gap-2 mb-1">
                    <h2 className="h5 mb-0">{a.name}</h2>
                    <StatusChip status={a.active ? 'ACTIVE' : 'REVOKED'} />
                  </div>
                  <Mono className="small ag-muted d-block mb-4">{a.public_key}</Mono>
                  <div className="mb-4">
                    <Rule label="Per payment cap">
                      <span className="font-monospace">{formatNear(a.per_tx_cap)}</span>
                    </Rule>
                    <Rule label="Daily cap">
                      <span className="font-monospace">{formatNear(a.daily_cap)}</span>
                    </Rule>
                    <Rule label="Approved recipients">
                      {a.allowed.map((r) => (
                        <Mono key={r} className="d-block">
                          {r}
                        </Mono>
                      ))}
                    </Rule>
                  </div>
                  <CapMeter paidToday={a.paid_today} dailyCap={a.daily_cap} label="Paid today, UTC" />
                  <div className="mt-auto pt-3">
                    {a.active ? (
                      <OwnerButton method="revoke_agent" args={{ public_key: a.public_key }} label="Revoke this agent" variant="reject" onDone={agents.reload} />
                    ) : (
                      <div className="small text-secondary">Revoked. The vault deleted this key, so NEAR refuses anything it signs.</div>
                    )}
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
