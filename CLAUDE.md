# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Local-first family dashboard for a wall-mounted Raspberry Pi 5 touchscreen (1920×1080) that also works on phones/laptops on the same Tailnet. Tracks chores, calendar, meals & shopping, points, and a kid-safe Q&A bot for the four Maxwell kids (Kolt, Michael-ann, Emma, Preston). No cloud dependency — all state lives in `server/data.db`.

Stack: Node 20+ (works on 22+) · Express · SQLite (`better-sqlite3` preferred, `node:sqlite` fallback) · React 18 · Vite · Tailwind CSS.

## Commands

Run from the repo root unless noted.

```bash
npm run install:all   # installs deps in both server/ and client/
npm start             # runs ./start-all.sh — Express on :3001 + Vite on :5173
npm run server        # API only, on :3001
npm run client        # Vite only, on :5173 (proxies /api → :3001)
ADMIN_PIN=4821 ./start-all.sh   # override default PIN ('1234')

# Server (cd server)
npm start             # node index.js
npm run dev           # node --watch index.js (auto-restart on save)
node scripts/seed-real-chores.js   # wipes & re-seeds the real chore loadout (idempotent)

# Client (cd client)
npm run dev           # vite --host 0.0.0.0
npm run build         # production build to client/dist
npm run preview       # serve the build
```

There is no test runner, no linter, and no typechecker configured. Don't add one without being asked.

The dev API exposes `/api/health` and `/api/version` — curl them to confirm the server is up.

## Architecture — the parts that aren't obvious from a directory listing

### Two-process app, single SQLite file

`server/index.js` boots Express, calls `initSchema() → seedIfEmpty() → applySeedColorUpdates()` from `server/db.js`, then mounts one router per resource under `/api/*`. The Vite dev server proxies `/api/*` to `:3001`, so the client always uses relative URLs (`/api/...` via `client/src/api.js`). In production on the Pi, both processes run under one systemd unit (`maxwell-hq.service` → `start-all.sh`) and Chromium hits `http://localhost:5173`.

### The DB driver shim

`server/db.js` tries `better-sqlite3` first (used on the Pi, where it builds from source), then falls back to Node's built-in `node:sqlite` (used on dev machines without Xcode CLT). The fallback exposes a thin shim with the better-sqlite3 surface this codebase uses (`db.prepare(...).run|get|all`, `db.exec`, `db.pragma`, `db.transaction(fn)`). **Route code must stick to that surface** — anything else won't work on dev machines. The `db` export is awaited at module load (`export const db = await openDb();`), so it depends on top-level await.

### Schema migrations are idempotent and inline

`server/db.js → initSchema()` runs every boot. New columns are added via `try { db.prepare('SELECT new_col FROM kids LIMIT 1').get(); } catch { db.exec('ALTER TABLE ...'); }` — there's no migrations directory. When you need to add a column, follow that pattern in `initSchema()` rather than introducing a migration framework. Tables are added with `CREATE TABLE IF NOT EXISTS`. `seedIfEmpty()` only seeds on a fresh DB but also back-fills missing seeded family members on existing DBs. `applySeedColorUpdates()` re-applies seeded kid colors on every boot, but only when the current DB color matches a known *previous* seed default (tracked in `PREVIOUS_COLORS`) — admin overrides via the UI stick.

### Kids vs roles

The `kids` table holds the whole family: kids, parents, and pets, distinguished by `role IN ('kid','parent','pet')`. Anything that should only act on actual kids (e.g. streaks) must filter `WHERE role = 'kid'`.

### Chore scheduling — three frequency modes + per-day overrides + per-day skips

`server/routes/chores.js GET /` resolves which chores are visible for a given date. The logic is non-trivial:

- `frequency = 'daily' | 'weekly'` → include if today's day-of-week is in `chores.days_of_week` (CSV "0,1,2,3,4,5,6", 0=Sun).
- `frequency = 'weekly_rolling'` → schedule shows on the listed DOW *and* every following day until completed (so a Tuesday chore stays visible Wed/Thu/etc. with `overdue_days` until done).
- `frequency = 'interval'` → recurs every `interval_days` from the last completion. The chore stays visible the day it's completed (so the kid sees the "All done" state instead of an empty column).
- `chore_overrides(chore_id, override_date, kid_id)` → drag-and-drop reassign for **one day only**. Resolved by mutating `kid_id/kid_name/kid_color/kid_initials` on the row in the GET response. Dragging back to the original owner clears the override.
- `chore_skips(chore_id, skip_date)` → parent removes a chore from today's list (the X in edit mode). Doesn't change `kid_id`; just hides for one day.

Completion uniqueness is enforced by `chore_completions UNIQUE(chore_id, completed_date)` so the daily reset is just a date change. Completing/uncompleting a chore is a single transaction that touches three tables: `chore_completions`, `kids.points_balance`, and `point_transactions` (audit log).

### Auth model — single shared PIN

There's no per-user auth. One PIN (env `ADMIN_PIN`, default `1234`) gates parent-only endpoints. The `requirePin` middleware is duplicated at the top of each PIN-gated router (`admin.js`, `bot.js → /log`, `notes.js`, `settings.js`, `streaks.js` is open, `vacations.js`). Routes accept the PIN either as the `x-admin-pin` header (preferred) or `req.body.pin`. The client persists an unlocked window via `client/src/hooks/useEditMode.js` — once verified, edit mode stays unlocked for 5 minutes and the PIN is cached in `localStorage` under `admin_pin`.

### Settings table doubles as the bot's secret store

Family-wide config lives in `settings(key, value)` — currently `bedtime` (default `'20:45'`) and `anthropic_api_key`. `server/routes/settings.js` redacts secrets in the GET response (replaces the value with a boolean) — the key list is `SECRET_KEYS` in that file. **When adding any new secret, append its key to `SECRET_KEYS` so the value never leaks via the public GET.** The bot route (`server/routes/bot.js`) reads the API key from this table at request time and calls Anthropic directly via `fetch` (no SDK) using `claude-haiku-4-5-20251001`. If no key is configured the bot returns 503; every Q&A is logged in `bot_messages` for parent visibility (PIN-gated GET/DELETE).

### `client/src/api.js` is the only HTTP layer

All fetch calls go through the `api` object in `client/src/api.js`. The `req()` helper merges headers with `Content-Type: application/json` set by default — **spread `opts` first, then headers** (there's a comment about this; mis-ordering drops Content-Type and breaks JSON parsing on the server, which was a real bug). PIN-gated calls take a `pin` argument and put it in the `x-admin-pin` header. Add new endpoints here rather than calling `fetch` directly from components.

### Auto-reload on deploy

`server/index.js` exposes `/api/version` returning a fixed `SERVER_START` ISO timestamp. `client/src/main.jsx` polls every 30s; when the value changes, it `location.reload()`s. So restarting the server is the deploy mechanism — the kiosk picks up the new client without manual intervention. Don't break this contract by making `/api/version` return something dynamic.

### Daily key remount

`client/src/App.jsx` keeps a `dateKey` (today's `YYYY-MM-DD`) refreshed every 30s and uses it as the `key=` prop on each tab. When local midnight rolls over, the key changes and the active tab remounts with fresh state — that's how chores/calendar/meals reset without a reload. Tabs should rely on this rather than implementing their own midnight detection.

### Kiosk vs non-kiosk

`main.jsx` reads `?kiosk=1` once and persists `localStorage.kiosk = '1'`. When set, it adds the `kiosk` class to `<html>`. CSS in `client/src/index.css` uses this:

- `html.kiosk *` → `cursor: none`, `overflow: hidden`
- `html.kiosk .hide-on-kiosk { display: none }` — hide parent-only controls from kids walking past
- `.show-on-kiosk-only` → inverse

The Pi's Chromium launches with `?kiosk=1`. Phones/laptops never set it, so they get cursors, scrollbars, and parent UI. Use these classes (not `lg:hidden`) when something should be hidden specifically on the wall display.

A minimal service worker is registered in production builds (`/sw.js`) so phones can "Add to Home Screen" — skipped in dev to avoid Vite HMR conflicts.

### Tabs

`Today` (a dashboard view), `Chores`, `Calendar`, `Meals`, `Points` (currently hidden from `TABS` in `App.jsx` while the reward system is being reworked — tables and routes are intact), `Admin`. Per-kid colors are wired in two places: Tailwind theme (`client/tailwind.config.js`) and the seeded `kids.color` hex (`server/db.js`). When changing a seeded color, also update `PREVIOUS_COLORS` in `db.js` so existing installs pick up the change without overwriting admin customizations.

### Touch targets

`index.css` enforces `min-height: 44px; min-width: 44px` on `button`, `[role="button"]`, and `.tap`. Disable text selection globally and re-enable on `input`/`textarea`/`select` (the kiosk shouldn't have draggable text). Use the `.surface` class for cards. There's a `VirtualKeyboard` component because the Pi has no physical keyboard — text inputs need to be focusable from touch.

## Conventions worth preserving

- **Date handling**: dates that represent a calendar day (chore completion, meal, vacation, override) are stored as `YYYY-MM-DD` strings, computed in *local* time. Both `server/routes/chores.js` and `client/src/api.js` define their own `todayStr()` that uses `getFullYear/getMonth/getDate` — don't switch to `toISOString().slice(0,10)` because that's UTC and will be wrong for late-evening completions.
- **IDs**: `nanoid()` for everything except `kids.id`, which uses stable string slugs (`'kolt'`, `'michaelann'`, etc.) so seed code can reference them by name.
- **Transactions**: any operation that touches multiple tables (chore complete/uncomplete, override upsert) goes through `db.transaction(() => { ... })()`. The shim implements this for `node:sqlite` too.
- **Validation**: routes return `400` for missing required fields, `404` for missing rows, `401` from `requirePin`, `503` for unconfigured external deps (e.g. bot without API key), `502` for upstream failures (Open-Meteo, Anthropic). Match these when adding new routes.
- **Secrets**: never put API keys in env files or systemd units; they live in the `settings` table and are entered through Admin → Settings. Add new secret keys to `SECRET_KEYS` in `server/routes/settings.js`.
- **`.claude/` is gitignored.** Same with `server/data.db*` (the database file plus WAL/SHM journals).

## Pi deployment

Full step-by-step is in `pi-setup/PI-INSTALL.md`. The short version: clone, `npm run install:all`, install `maxwell-hq.service` as a system unit and `pi-setup/maxwell-kiosk.service` as a user unit (Wayland) or use `pi-setup/autostart` for X11. Updates are `git pull && sudo systemctl restart maxwell-hq` — the client auto-reloads via the `/api/version` poll.

The single source of truth for app state is `server/data.db`. Backup = scp that file off the Pi; restore = stop the service, drop it back, start.
