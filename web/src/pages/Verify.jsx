// /verify/<vault>: anyone can check, live from NEAR RPC, that a vault really enforces its rules.
// No wallet needed. /verify alone checks the demo vault.
import { Link, useParams } from 'react-router-dom';
import { isAccountId } from '../../../scripts/lib/config.js';
import { ChainView, Ext, Icon, Mono, PageHead } from '../components/ui.jsx';
import { accessKeysLink, accountLink } from '../lib/links.js';
import { accessKeysOf, cfg, viewAccountOf, viewAt } from '../lib/near.js';
import { useChain } from '../lib/useChain.js';
import { allPassed, verifyChecks } from '../lib/verify.js';

const REPO = 'https://github.com/london160771/agentgate';

export default function Verify() {
  const { vaultId = cfg.vaultAccountId } = useParams();
  if (!isAccountId(vaultId)) return <p className="mt-4">“{vaultId}” is not a NEAR account id.</p>;
  return <Report key={vaultId} vaultId={vaultId} />;
}

async function readAll(vaultId) {
  const factoryId = cfg.factoryAccountId;
  const [keys, account, owner] = await Promise.all([accessKeysOf(vaultId), viewAccountOf(vaultId), viewAt(vaultId, 'get_owner')]);
  let factoryInfo = null;
  let factoryVaults = null;
  if (vaultId.endsWith(`.${factoryId}`)) {
    [factoryInfo, factoryVaults] = await Promise.all([
      viewAt(factoryId, 'get_info').catch(() => null),
      viewAt(factoryId, 'get_vaults', { owner }).catch(() => null),
    ]);
  }
  return { checks: verifyChecks({ vaultId, keys, account, factoryId, factoryInfo, factoryVaults, owner }), owner, at: new Date() };
}

function Check({ c }) {
  const kind = c.ok === true ? 'paid' : c.ok === false ? 'blocked' : 'neutral';
  const word = c.ok === true ? 'PASS' : c.ok === false ? 'FAIL' : 'INFO';
  return (
    <li className="ag-panel ag-panel-pad d-flex gap-3 align-items-start">
      <span className={`ag-stamp ag-stamp--${kind} flex-shrink-0`} style={{ minWidth: '3.6rem', textAlign: 'center' }}>
        {word}
      </span>
      <div className="min-w-0">
        <div className="fw-medium">{c.title}</div>
        <div className="small text-secondary text-break">{c.detail}</div>
      </div>
    </li>
  );
}

function Report({ vaultId }) {
  const report = useChain(() => readAll(vaultId));
  const isDemo = vaultId === cfg.vaultAccountId;
  return (
    <>
      <PageHead title="Verify this vault" aside={<Link className="small" to={isDemo ? '/' : `/v/${vaultId}`}>Back to the vault</Link>}>
        <Mono>{vaultId}</Mono> · read live from NEAR testnet, no wallet needed
      </PageHead>

      <ChainView state={report} what="Reading the vault’s keys and code">
        {({ checks, at }) => (
          <section className="mb-5">
            <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
              <div className="d-flex align-items-center gap-2 fw-medium">
                <Icon name={allPassed(checks) ? 'lock' : 'lockOpen'} size={18} />
                {allPassed(checks) ? 'Every check passed. The rules are enforced by NEAR, not by a promise.' : 'Some checks failed. Read them before you fund this vault.'}
              </div>
              <button className="btn btn-sm btn-ghost d-inline-flex align-items-center gap-2" onClick={report.reload} disabled={report.loading}>
                <Icon name="refresh" size={14} /> Check again
              </button>
            </div>
            <ul className="list-unstyled d-grid gap-2 mb-2">
              {checks.map((c) => (
                <Check key={c.id} c={c} />
              ))}
            </ul>
            <p className="ag-label mb-0">Checked {at.toISOString().replace('T', ' ').slice(0, 19)} UTC</p>
          </section>
        )}
      </ChainView>

      <section className="row g-3 mb-5">
        <div className="col-12 col-lg-6">
          <div className="ag-panel ag-panel-pad h-100">
            <h2 className="h6">Check it yourself</h2>
            <p className="small text-secondary">The same reads this page made, with plain RPC calls:</p>
            <pre className="ag-doc-code small mb-2">{`curl -s https://rpc.testnet.near.org -H 'content-type: application/json' \\
 -d '{"jsonrpc":"2.0","id":1,"method":"query","params":{"request_type":"view_access_key_list","finality":"final","account_id":"${vaultId}"}}'`}</pre>
            <div className="d-flex flex-wrap gap-3 small">
              <Ext href={accessKeysLink(vaultId)}>Keys on the explorer</Ext>
              <Ext href={accountLink(vaultId)}>Account</Ext>
            </div>
          </div>
        </div>
        <div className="col-12 col-lg-6">
          <div className="ag-panel ag-panel-pad h-100">
            <h2 className="h6">What the code allows</h2>
            <ul className="small text-secondary ps-3 mb-2">
              <li>An agent key can only call <code>request_spend</code>. The contract checks the agent’s caps and recipients, then pays, holds or blocks, and logs it.</li>
              <li>The owner can add, change or revoke agents and approve or reject held payments. Each of these is a contract call; there is no method that moves NEAR without a log entry.</li>
              <li>With no full-access key, the code can never be replaced. A fix means a new vault.</li>
            </ul>
            <div className="d-flex flex-wrap gap-3 small">
              <Ext href={`${REPO}/blob/main/contract/src/lib.rs`}>Vault source</Ext>
              <Ext href={`${REPO}/blob/main/factory/src/lib.rs`}>Factory source</Ext>
            </div>
            <p className="small ag-muted mt-2 mb-0">
              The code hash proves every factory vault runs the same build. Matching that build to the GitHub source needs a reproducible build, which is on the roadmap.
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
