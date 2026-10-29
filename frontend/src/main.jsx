import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { ToastProvider } from './components/Toast';
import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap-icons/font/bootstrap-icons.css';
/* WHAT: Leaflet CSS mula sa npm package (hindi sa CDN).
   WHY: kapag hindi na-load ang leaflet.css, malalaki at unpositioned ang tiles
        at walang maipapakitang zoom control — kaya naka-bundle na ito. */
import 'leaflet/dist/leaflet.css';
import './index.css';
import './styles/ui-tokens.css';
import './styles/sidebar.css';
import './styles/page-header.css';
import './styles/kpi-card.css';
import './styles/admin-dashboard.css';
import './styles/public-dashboard.css';
import './styles/change-password.css';
import './styles/audit-log.css';
import './components/admin/forecast/forecast.css';
import './components/admin/target/target.css';
import './components/admin/municipality/muni.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ToastProvider>
      <App />
    </ToastProvider>
  </React.StrictMode>
);
