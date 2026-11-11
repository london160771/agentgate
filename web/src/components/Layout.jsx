import { NavLink, Outlet } from 'react-router-dom';
import { cfg, configProblems, isReady } from '../lib/near.js';
import { accountLink } from '../lib/links.js';
import { Mark } from './ui.jsx';
import { WalletControl, WalletNotice } from './Wallet.jsx';

const NAV = [
  ['/', 'Overview'],
  ['/agents', 'Agents and rules'],
  ['/activity', 'Activity'],
  ['/judge', 'Attack lab'],
  ['/docs', 'Docs'],
];

export default function Layout() {
  return (
    <>
      <nav className="ag-nav">
        <div className="container">
          <NavLink className="ag-brand" to="/">
            <Mark />
            AgentGate
          </NavLink>
          <ul className="ag-links">
            {NAV.map(([to, label]) => (
              <li key={to}>
                <NavLink to={to} end={to === '/'}>
                  {label}
                </NavLink>
              </li>
            ))}
          </ul>
          <div className="ag-nav-end">
            <WalletControl />
          </div>
        </div>
      </nav>
      <main className="container">
        {!isReady && (
          <div className="ag-panel ag-panel-pad mt-4">
            <div className="fw-medium">config/seed.json is not ready for the web app</div>
            <ul className="mb-0 small text-secondary">
              {configProblems.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </div>
        )}
        <WalletNotice />
        <Outlet />
      </main>
      <footer className="ag-footer">
        <div className="container d-flex flex-wrap gap-3 justify-content-between">
          <span className="d-inline-flex flex-wrap align-items-center gap-2">
            <span className="ag-dot" aria-hidden="true" />
            Real transactions on NEAR testnet. Every number is read live from{' '}
            <a className="font-monospace" href={accountLink(cfg.vaultAccountId)} target="_blank" rel="noreferrer">
              {cfg.vaultAccountId}
            </a>
          </span>
          <span>
            Built at NEAR HACKATHON · no backend, no signup ·{' '}
            <a href="https://github.com/london160771/agentgate" target="_blank" rel="noreferrer">
              Source on GitHub
            </a>
          </span>
        </div>
      </footer>
    </>
  );
}
