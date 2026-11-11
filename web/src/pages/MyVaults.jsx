// Multi-user: the signed-in wallet's vaults, and the Create vault form.
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { formatNear, nearToYocto, yoctoToNear } from '../../../scripts/lib/format.js';
import { ChainView, Ext, Icon, Mono, PageHead } from '../components/ui.jsx';
import { useWallet, WalletControl } from '../components/Wallet.jsx';
import { createdFromOutcome, validVaultName, vaultIdFor } from '../lib/factory.js';
import { accountLink, txLink } from '../lib/links.js';
import { cfg, viewAt, viewFactory } from '../lib/near.js';
import { outcomeFailure, outcomeHash } from '../lib/owner.js';
import { useChain } from '../lib/useChain.js';

export default function MyVaults() {
  const w = useWallet();
  return (
    <>
      <PageHead title="My vaults" aside={<Ext href={accountLink(cfg.factoryAccountId)} className="small">Factory on the explorer</Ext>}>
        Each wallet gets its own vaults. A vault is its own NEAR account with no key at all, so only its rules can move the money.
      </PageHead>
      {w.accountId ? <SignedIn accountId={w.accountId} /> : <SignedOut />}
    </>
  );
}

function SignedOut() {
  return (
    <section className="ag-panel ag-panel-pad ag-enter-2">
      <h2 className="h6 mb-1">Connect a wallet to start</h2>
      <p className="small text-secondary mb-3">
        Use a NEAR testnet wallet. You’ll see the vaults you own, and you can create one in a single transaction. No signup.
      </p>
      <WalletControl />
    </section>
  );
}

function SignedIn({ accountId }) {
  const info = useChain(() => viewFactory('get_info'));
  const vaults = useChain(() => viewFactory('get_vaults', { owner: accountId }), [accountId]);
  if (info.error) return <FactoryMissing error={info.error} />;
  return (
    <div className="row g-4">
      <div className="col-12 col-lg-7">
        <h2 className="ag-section-title mb-3">Your vaults</h2>
        <ChainView state={vaults} what="Reading your vaults">
          {(list) =>
            list.length === 0 ? (
              <div className="ag-panel ag-panel-pad small text-secondary">No vaults yet for {accountId}. Create your first one.</div>
            ) : (
              <div className="d-grid gap-3">
                {list.map((id) => (
                  <VaultRow key={id} vaultId={id} />
                ))}
              </div>
            )
          }
        </ChainView>
      </div>
      <div className="col-12 col-lg-5">
        <ChainView state={info} what="Reading the factory">
          {(i) => <CreateVault accountId={accountId} info={i} onCreated={vaults.reload} />}
        </ChainView>
      </div>
    </div>
  );
}

function VaultRow({ vaultId }) {
  const stats = useChain(() => viewAt(vaultId, 'get_stats'), [vaultId]);
  return (
    <Link to={`/v/${vaultId}`} className="ag-panel ag-panel-pad ag-vault-row text-decoration-none">
      <div className="min-w-0">
        <div className="font-monospace text-truncate">{vaultId}</div>
        <div className="ag-label mt-1">
          {stats.data
            ? `${formatNear(stats.data.vault_balance)} · ${stats.data.total_requests} requests · ${stats.data.held_pending} waiting for you`
            : stats.error
              ? 'Could not read the vault'
              : 'Reading…'}
        </div>
      </div>
      <Icon name="arrowRight" />
    </Link>
  );
}

function CreateVault({ accountId, info, onCreated }) {
  const w = useWallet();
  const navigate = useNavigate();
  const min = BigInt(info.min_deposit);
  // Suggest the minimum plus 1 NEAR of spending money, rounded up to 0.1 NEAR.
  const step = 100_000_000_000_000_000_000_000n;
  const suggested = ((min + 1_000_000_000_000_000_000_000_000n + step - 1n) / step) * step;
  const [name, setName] = useState('');
  const [amount, setAmount] = useState(yoctoToNear(suggested.toString()));
  const [state, setState] = useState({ busy: false, error: '', hash: '' });

  let depositYocto = null;
  try {
    depositYocto = nearToYocto(amount);
  } catch {
    depositYocto = null;
  }
  const nameOk = validVaultName(name);
  const depositOk = depositYocto !== null && depositYocto >= min;
  const vaultId = vaultIdFor(name || 'name', cfg.factoryAccountId);

  async function submit(e) {
    e.preventDefault();
    if (!nameOk || !depositOk) return;
    setState({ busy: true, error: '', hash: '' });
    try {
      const { sendCreateVault } = await w.load();
      const outcome = await sendCreateVault(accountId, name, depositYocto.toString());
      const failure = outcomeFailure(outcome);
      const created = createdFromOutcome(outcome);
      if (failure || created === false) {
        setState({
          busy: false,
          hash: outcomeHash(outcome),
          error: failure || `Could not create ${vaultId}. The name may be taken. Your deposit was sent back.`,
        });
        return;
      }
      onCreated();
      navigate(`/v/${vaultIdFor(name, cfg.factoryAccountId)}`);
    } catch (err) {
      setState({ busy: false, error: String(err?.message || err), hash: '' });
    }
  }

  return (
    <form className="ag-panel ag-panel-pad" onSubmit={submit}>
      <h2 className="h6 mb-1">Create a vault</h2>
      <p className="small text-secondary mb-3">One transaction from your wallet. You become the owner.</p>
      <label className="form-label small fw-medium" htmlFor="vault-name">
        Vault name
      </label>
      <input
        id="vault-name"
        className="form-control font-monospace"
        value={name}
        onChange={(e) => setName(e.target.value.toLowerCase())}
        placeholder="my-agents"
        autoComplete="off"
        spellCheck={false}
        aria-describedby="vault-name-help"
      />
      <div id="vault-name-help" className="ag-label mt-1 mb-3 text-break">
        Your vault: <Mono>{vaultId}</Mono>
        {name && !nameOk && <div className="text-danger">2–32 characters: lowercase letters, digits, - or _.</div>}
      </div>
      <label className="form-label small fw-medium" htmlFor="vault-deposit">
        Deposit (NEAR)
      </label>
      <input id="vault-deposit" className="form-control font-monospace" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
      <div className="ag-label mt-1 mb-3">
        At least {formatNear(info.min_deposit)}: {formatNear((BigInt(info.code_bytes) * 10_000_000_000_000_000_000n).toString())} pays for storing the vault
        code ({Math.round(Number(info.code_bytes) / 1000)} KB) and the rest is the vault’s balance. Agents spend from that balance, under your rules.
        {!depositOk && <div className="text-danger">The deposit must be at least {formatNear(info.min_deposit)}.</div>}
      </div>
      <button className="btn btn-primary w-100" type="submit" disabled={!nameOk || !depositOk || state.busy}>
        {state.busy ? 'Confirm in your wallet…' : 'Create vault'}
      </button>
      {state.error && <div className="small text-danger mt-2 text-break">{state.error}</div>}
      {state.hash && (
        <a className="small font-monospace d-block mt-1" href={txLink(state.hash)} target="_blank" rel="noreferrer">
          tx {state.hash.slice(0, 8)}…
        </a>
      )}
    </form>
  );
}

function FactoryMissing({ error }) {
  return (
    <div className="ag-panel ag-panel-pad" role="alert">
      <div className="fw-medium mb-1">The vault factory isn’t reachable yet</div>
      <p className="small text-secondary mb-2">
        It should live at <Mono>{cfg.factoryAccountId}</Mono>. If it was just deployed, try again in a minute.
      </p>
      <pre className="small text-secondary mb-0 text-wrap font-monospace">{String(error?.message || error).slice(0, 400)}</pre>
    </div>
  );
}
