// Owner sign-in state shared by every page, plus the owner action button (P1-a).
import { createContext, useContext, useEffect, useState } from 'react';
import { txLink } from '../lib/links.js';
import { viewVault } from '../lib/near.js';
import { isOwner, outcomeFailure, outcomeHash } from '../lib/owner.js';
import { Mono } from './ui.jsx';

// The wallet code is large, so it loads in its own chunk after the page renders.
const loadWallet = () => import('../lib/wallet.js');

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
    signIn: () => loadWallet().then((m) => m.signIn()).catch((e) => setError(e)),
    signOut: () => loadWallet().then((m) => m.signOut()).catch((e) => setError(e)),
  };
  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

/** Navbar control: owner sign in / who is signed in / sign out. */
export function WalletControl() {
  const w = useWallet();
  if (!w.accountId) {
    return (
      <button className="btn btn-sm btn-outline-light" onClick={w.signIn}>
        Owner sign in
      </button>
    );
  }
  return (
    <div className="d-flex align-items-center gap-2 small text-light">
      <span className={`badge ${w.isOwner ? 'text-bg-success' : 'text-bg-secondary'}`}>{w.isOwner ? 'owner' : 'not the owner'}</span>
      <span className="text-truncate" style={{ maxWidth: '12rem' }}>
        {w.accountId}
      </span>
      <button className="btn btn-sm btn-outline-light" onClick={w.signOut}>
        Sign out
      </button>
    </div>
  );
}

/** Banner under the navbar: wallet errors, or a note when a non-owner is signed in. */
export function WalletNotice() {
  const w = useWallet();
  if (w.error) return <div className="alert alert-warning small">Wallet: {String(w.error?.message || w.error)}</div>;
  if (w.accountId && w.owner && !w.isOwner)
    return (
      <div className="alert alert-secondary small">
        Signed in as <Mono>{w.accountId}</Mono>. Only the vault owner (<Mono>{w.owner}</Mono>) can approve, reject or revoke, so no owner
        buttons are shown.
      </div>
    );
  return null;
}

/** One owner action. Opens the wallet to confirm, then shows the tx link or the error. */
export function OwnerButton({ method, args, label, variant = 'outline-primary', onDone }) {
  const w = useWallet();
  const [state, setState] = useState({ busy: false, hash: '', error: '' });
  if (!w.isOwner) return null;

  async function run() {
    setState({ busy: true, hash: '', error: '' });
    try {
      const { sendOwnerAction } = await loadWallet();
      const outcome = await sendOwnerAction(w.accountId, method, args);
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
        <a className="small" href={txLink(state.hash)} target="_blank" rel="noreferrer">
          tx {state.hash.slice(0, 8)}… ↗
        </a>
      )}
      {state.error && <span className="small text-danger text-break">{state.error}</span>}
    </span>
  );
}
