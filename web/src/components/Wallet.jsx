// Owner sign-in state shared by every page, plus the owner action button (P1-a).
import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { txLink } from '../lib/links.js';
import { viewVault } from '../lib/near.js';
import { isOwner, outcomeFailure, outcomeHash } from '../lib/owner.js';
import { Mono } from './ui.jsx';

// The wallet code is large, so it loads in its own chunk after the page renders.
// The Meteor wallet SDK reads Node's `global` when its module loads, so set it first.
const loadWallet = () => {
  globalThis.global ??= globalThis;
  return import('../lib/wallet.js');
};

const WalletContext = createContext(null);
export const useWallet = () => useContext(WalletContext);

export function WalletProvider({ children }) {
  const [accountId, setAccountId] = useState(null);
  const [owner, setOwner] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let sub;
    loadWallet()
      .then(async ({ getSelector, activeAccountId }) => {
        const selector = await getSelector();
        setAccountId(activeAccountId(selector.store.getState()));
        sub = selector.store.observable.subscribe((state) => setAccountId(activeAccountId(state)));
      })
      .catch((e) => setError(e));
    viewVault('get_owner').then(setOwner, (e) => setError(e));
    return () => sub?.unsubscribe();
  }, []);

  const value = {
    accountId,
    owner,
    error,
    isOwner: isOwner(accountId, owner),
    choices: () => loadWallet().then((m) => m.walletChoices()),
    /** The wallet module (sendCreateVault, sendFund, sendOwnerAction), loaded on demand. */
    load: loadWallet,
    signIn: (walletId) => loadWallet().then((m) => m.signIn(walletId)).catch((e) => setError(e)),
    signOut: () => loadWallet().then((m) => m.signOut()).catch((e) => setError(e)),
  };
  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

/** Small menu of wallets to sign in with (Meteor uses its extension when installed). */
function WalletPicker() {
  const w = useWallet();
  const [open, setOpen] = useState(false);
  const [list, setList] = useState(null);
  const box = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    w.choices().then(setList, () => setList([]));
    const close = (e) => {
      if (e.type === 'keydown' ? e.key === 'Escape' : !box.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', close);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', close);
    };
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const pick = (id) => {
    setOpen(false);
    w.signIn(id);
  };
  return (
    <div className="ag-picker" ref={box}>
      <button className="btn btn-sm btn-quiet" aria-expanded={open} aria-haspopup="menu" onClick={() => setOpen((o) => !o)}>
        Connect wallet
      </button>
      {open && (
        <div className="ag-picker-menu" role="menu">
          <div className="ag-label px-2 pb-2">NEAR testnet wallets</div>
          {list === null && <div className="small text-secondary px-2 py-2">Loading wallets…</div>}
          {list?.map((x) => (
            <button key={x.id} role="menuitem" className="ag-picker-item" onClick={() => pick(x.id)}>
              {x.icon && <img src={x.icon} alt="" width="24" height="24" />}
              <span>
                <span className="d-block fw-medium">{x.name}</span>
                {x.description && <span className="d-block ag-label text-truncate">{x.description}</span>}
              </span>
            </button>
          ))}
          <div className="ag-label px-2 pt-2">Sign in to create your own vault and manage its agents.</div>
        </div>
      )}
    </div>
  );
}

/** Navbar control: connect wallet / who is signed in / sign out. */
export function WalletControl() {
  const w = useWallet();
  if (!w.accountId) return <WalletPicker />;
  return (
    <div className="d-flex align-items-center gap-2 small">
      <span className="text-truncate font-monospace text-secondary" style={{ maxWidth: '14rem' }}>
        {w.accountId}
      </span>
      <button className="btn btn-sm btn-ghost" onClick={w.signOut}>
        Sign out
      </button>
    </div>
  );
}

/** Banner under the navbar: wallet errors, or a note when a non-owner is signed in. */
export function WalletNotice() {
  const w = useWallet();
  const { pathname } = useLocation();
  if (w.error) return <div className="ag-panel ag-panel-pad mt-4 small">Wallet: {String(w.error?.message || w.error)}</div>;
  // Only on the demo vault's pages; a user's own vault has its own dashboard.
  if (w.accountId && w.owner && !w.isOwner && ['/activity', '/agents'].includes(pathname))
    return (
      <div className="ag-panel ag-panel-pad mt-4 small text-secondary">
        This is the public demo vault. Only its owner (<Mono>{w.owner}</Mono>) can approve, reject or revoke here. Your own vaults are in{' '}
        <Link to="/app">My vaults</Link>.
      </div>
    );
  return null;
}

/** One owner action. Opens the wallet to confirm, then shows the tx link or the error. */
// Pass `vaultId` and `isOwner` for a user's own vault; without them it acts on the demo vault.
export function OwnerButton({ method, args, label, variant = 'quiet', onDone, vaultId, isOwner }) {
  const w = useWallet();
  const [state, setState] = useState({ busy: false, hash: '', error: '' });
  if (!(isOwner ?? w.isOwner)) return null;

  async function run() {
    setState({ busy: true, hash: '', error: '' });
    try {
      const { sendOwnerAction } = await loadWallet();
      const outcome = await sendOwnerAction(w.accountId, method, args, vaultId);
      const failure = outcomeFailure(outcome);
      setState({ busy: false, hash: outcomeHash(outcome), error: failure || '' });
      onDone?.();
    } catch (e) {
      setState({ busy: false, hash: '', error: String(e?.message || e) });
    }
  }

  return (
    <span className="d-inline-flex flex-wrap align-items-center gap-2">
      <button className={`btn btn-sm btn-${variant}`} onClick={run} disabled={state.busy}>
        {state.busy ? 'Confirm in wallet…' : label}
      </button>
      {state.hash && (
        <a className="small font-monospace" href={txLink(state.hash)} target="_blank" rel="noreferrer">
          tx {state.hash.slice(0, 8)}…
        </a>
      )}
      {state.error && <span className="small text-danger text-break">{state.error}</span>}
    </span>
  );
}
