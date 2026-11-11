import { NavLink, Outlet } from 'react-router-dom';
import { cfg, configProblems, isReady } from '../lib/near.js';
import { accountLink } from '../lib/links.js';

const NAV = [
  ['/', 'Overview'],
  ['/agents', 'Agents & Rules'],
  ['/activity', 'Activity'],
  ['/judge', 'Attack Lab'],
];

export default function Layout() {
  return (
    <>
      <div className="bg-warning text-dark small py-1 text-center fw-semibold">
        REAL · NEAR TESTNET · every number below is read live from{' '}
        <a className="text-dark" href={accountLink(cfg.vaultAccountId)} target="_blank" rel="noreferrer">
          {cfg.vaultAccountId}
        </a>
      </div>
      <nav className="navbar navbar-expand bg-dark" data-bs-theme="dark">
        <div className="container flex-wrap">
          <NavLink className="navbar-brand fw-bold" to="/">
            AgentGate
          </NavLink>
          <ul className="navbar-nav flex-wrap">
            {NAV.map(([to, label]) => (
              <li className="nav-item" key={to}>
                <NavLink className="nav-link" to={to} end={to === '/'}>
                  {label}
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      </nav>
      <main className="container py-4">
        {!isReady && (
          <div className="alert alert-danger">
            <div className="fw-semibold">config/seed.json is not ready for the web app:</div>
            <ul className="mb-0">
              {configProblems.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </div>
        )}
        <Outlet />
      </main>
      <footer className="container pb-4 small text-secondary">
        Built at NEAR HACKATHON · testnet only · no backend, no signup ·{' '}
        <a href="https://github.com/london160771/agentgate" target="_blank" rel="noreferrer">
          source
        </a>
      </footer>
    </>
  );
}
