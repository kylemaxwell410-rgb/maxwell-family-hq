import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
    // Tailnet-only deployment — accept any hostname (MagicDNS short name + *.ts.net).
    allowedHosts: true,
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
});
