import 'bootstrap/dist/css/bootstrap.min.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout.jsx';
import Activity from './pages/Activity.jsx';
import Agents from './pages/Agents.jsx';
import Judge from './pages/Judge.jsx';
import Overview from './pages/Overview.jsx';

function NotFound() {
  return <p>Page not found.</p>;
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Overview />} />
          <Route path="agents" element={<Agents />} />
          <Route path="activity" element={<Activity />} />
          <Route path="judge" element={<Judge />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </StrictMode>,
);
