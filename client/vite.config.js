import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Shared between dev and preview so /api/* always proxies to the local API
// and any hostname (MagicDNS short name, *.ts.net, LAN IPs) is accepted.
const sharedServerConfig = {
  port: 5173,
  host: true,
  allowedHosts: true,
  proxy: {
    '/api': 'http://localhost:3001',
  },
};

export default defineConfig({
  plugins: [react()],
  server:  sharedServerConfig, // `vite dev` (Mac, local hacking)
  preview: sharedServerConfig, // `vite preview` (Pi kiosk — no HMR, no WebSocket noise)
});
