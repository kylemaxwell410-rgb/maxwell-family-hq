import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';

// Kiosk detection: Pi launches Chromium with ?kiosk=1; we persist the flag so
// the Pi only needs to learn it once. Other devices (phone/laptop) never set it.
const kioskParam = new URLSearchParams(location.search).get('kiosk');
if (kioskParam === '1') localStorage.setItem('kiosk', '1');
else if (kioskParam === '0') localStorage.removeItem('kiosk');
if (localStorage.getItem('kiosk') === '1') {
  document.documentElement.classList.add('kiosk');
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Auto-reload the kiosk when the API server restarts (new deploy).
// Polls /api/version every 30s; if `start` changes from the first value we saw, reload.
let initialVersion = null;
async function checkVersion() {
  try {
    const r = await fetch('/api/version', { cache: 'no-store' });
    if (!r.ok) return;
    const { start } = await r.json();
    if (initialVersion == null) initialVersion = start;
    else if (start !== initialVersion) location.reload();
  } catch {}
}
checkVersion();
setInterval(checkVersion, 30_000);

// Register a minimal service worker so phones can "Add to Home Screen" and
// open the planner as a standalone app. Skip on the kiosk (no benefit) and
// in dev (Vite hot reload conflicts).
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}
