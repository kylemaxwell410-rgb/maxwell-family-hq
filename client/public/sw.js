// Minimal service worker so the PWA install prompt fires and the app
// stays open as a standalone window. No offline caching yet — the kiosk
// and family LAN setup don't need it. Bumping VERSION will force update.
const VERSION = 'v1';
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
// Pass-through fetch — let the network handle every request normally.
self.addEventListener('fetch', () => {});
