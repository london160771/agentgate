import 'bootstrap/dist/css/bootstrap.min.css';
import './theme.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout.jsx';
import { WalletProvider } from './components/Wallet.jsx';
import Activity from './pages/Activity.jsx';
import Agents from './pages/Agents.jsx';
import Docs from './pages/Docs.jsx';
import MyVaults from './pages/MyVaults.jsx';
import VaultDashboard from './pages/VaultDashboard.jsx';
import Judge from './pages/Judge.jsx';
import Overview from './pages/Overview.jsx';
import Verify from './pages/Verify.jsx';

function NotFound() {
  return <p>Page not found.</p>;
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <WalletProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Overview />} />
            <Route path="agents" element={<Agents />} />
            <Route path="activity" element={<Activity />} />
            <Route path="judge" element={<Judge />} />
            <Route path="docs" element={<Docs />} />
            <Route path="app" element={<MyVaults />} />
            <Route path="v/:vaultId" element={<VaultDashboard />} />
            <Route path="verify" element={<Verify />} />
            <Route path="verify/:vaultId" element={<Verify />} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </WalletProvider>
  </StrictMode>,
);
