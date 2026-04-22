# Maxwell Family HQ

Local-first family dashboard for a wall-mounted Raspberry Pi 5 touchscreen (1920x1080). Tracks **chores, calendar, meals & shopping, and a points-based reward system** for the four Maxwell kids — Kolt, Michael-ann, Emma, and Preston.

- **Stack:** Node 22+ · Express · `node:sqlite` (built-in) · React 18 · Vite · Tailwind CSS
- **Runs on:** a Raspberry Pi 5 in kiosk mode (Chromium) — no cloud dependency
- **Data:** single SQLite file at `server/data.db` (WAL mode)

> **Note on the SQLite driver:** the server uses Node's built-in `node:sqlite` (stable in Node 22+, shipped with Node, zero native build step). `server/db.js` exposes a thin better-sqlite3-compatible shim (`db.prepare(...).run|get|all`, `db.transaction(fn)`) so route code reads the same either way. If you prefer `better-sqlite3`, swap those two lines in `server/db.js` and add `better-sqlite3` to `server/package.json`.

---

## Quick start (dev on any machine)

```bash
# 1. Install deps (server + client)
npm run install:all

# 2. Start both together
./start-all.sh
# or: npm start
```

Open **http://localhost:5173** in a browser.

The Express API listens on `:3001`; Vite proxies `/api/*` through to it.

### Start each side separately

```bash
npm run server   # Express on :3001
npm run client   # Vite on :5173
```

### Default admin PIN

`1234` — override per-install with the `ADMIN_PIN` env var:

```bash
ADMIN_PIN=4821 ./start-all.sh
```

---

## Features

| Tab | What it does |
| --- | --- |
| **Chores**    | Per-kid tiles, big tap-targets, points auto-awarded on check-off. Completions are date-scoped so the list auto-resets at local midnight. Day-of-week scheduling per chore. |
| **Calendar**  | Today / Tomorrow / Week views. Tap a block to edit, tag events with a kid's color. Full CRUD. |
| **Meals**     | 7-day × 3-meal grid (breakfast/lunch/dinner). Tap a cell to edit. Running shopping list in the side panel. |
| **Points**    | Running balance per kid. Rewards: 30-min screen time (15), ice cream (25), movie pick (30), sleepover (75), $5 (50), $10 (100). Full transaction log. |
| **Admin**     | PIN-gated. CRUD for chores and kids (name/color/initials), manual point adjustments. |

Default seeded chores:
- **Kolt**: Feed horses AM (5), Chicken coop check (3), Make bed (2), Homework (5)
- **Michael-ann**: Feed dogs (3), Unload dishwasher (4), Make bed (2), Homework (5)
- **Emma**: Feed cats (3), Tidy room (3), Set table (2), Homework (5)
- **Preston**: Put toys away (2), Help feed chickens (3), Make bed (2)

---

## Raspberry Pi 5 installation

The full step-by-step install — systemd services, Chromium kiosk (Wayland and X11 paths), screen blanking, cursor hiding, nightly reboot, backups, and troubleshooting — lives in **[pi-setup/PI-INSTALL.md](pi-setup/PI-INSTALL.md)**. Copy-paste those commands over SSH and you're done.

Files that ship with the Pi setup:

- `maxwell-hq.service` — system-level systemd unit (API + Vite)
- `pi-setup/maxwell-kiosk.service` — user-level unit (Chromium kiosk, Wayland)
- `pi-setup/autostart` — LXDE autostart (X11 path, kiosk + blanking + cursor)
- `pi-setup/nightly-reboot` — cron drop-in for 3 AM reboot

---

## Project layout

```
Maxwell HQ/
├── server/
│   ├── index.js          # Express bootstrap + route wiring
│   ├── db.js             # schema, seed, better-sqlite3 handle
│   ├── data.db           # SQLite (created on first run; git-ignored)
│   └── routes/
│       ├── kids.js
│       ├── chores.js     # list + complete/uncomplete (awards/reverses points)
│       ├── events.js     # calendar CRUD
│       ├── meals.js      # 7-day planner upsert
│       ├── shopping.js   # shopping list CRUD + clear-checked
│       ├── points.js     # rewards, redeem, manual adjust, transactions
│       └── admin.js      # PIN-gated CRUD
├── client/
│   ├── src/
│   │   ├── App.jsx
│   │   ├── api.js
│   │   ├── components/{Header,TabNav,PinModal}.jsx
│   │   └── tabs/{Chores,Calendar,Meals,Points,Admin}.jsx
│   ├── tailwind.config.js
│   └── vite.config.js
├── start-all.sh           # dev + prod launcher
├── maxwell-hq.service     # systemd template
└── .gitignore
```

### Database schema

All tables live in `server/data.db` (SQLite, WAL mode, FK enforcement on):

- `kids(id, name, initials, color, sort_order, points_balance)`
- `chores(id, kid_id, title, points, frequency, days_of_week, active, sort_order)`
- `chore_completions(id, chore_id, completed_date, completed_at)` — unique on `(chore_id, completed_date)` so daily reset is just a date change
- `events(id, title, start_datetime, end_datetime, kid_id, notes, all_day)`
- `meals(id, meal_date, meal_type, description)` — unique on `(meal_date, meal_type)`
- `shopping_items(id, item, category, checked, created_at)`
- `point_transactions(id, kid_id, amount, reason, created_at)`

### API endpoints

See `server/routes/*.js` for the full surface. Key routes:

| Method | Path | Purpose |
| ------ | ---- | ------- |
| GET    | `/api/kids` | list kids |
| GET    | `/api/chores?date=YYYY-MM-DD` | today's chores with completion status |
| POST   | `/api/chores/:id/complete` | mark done, award points |
| POST   | `/api/chores/:id/uncomplete` | undo, reverse points |
| GET    | `/api/events?from=&to=` | list events in range |
| POST/PUT/DELETE | `/api/events[/:id]` | calendar CRUD |
| GET    | `/api/meals?from=&to=` | 7-day meal grid |
| PUT    | `/api/meals` | upsert single meal |
| GET    | `/api/shopping` | shopping list |
| POST/PATCH/DELETE | `/api/shopping[/:id]` | list CRUD |
| POST   | `/api/shopping/clear-checked` | batch delete completed |
| GET    | `/api/points/rewards` | reward catalog |
| POST   | `/api/points/redeem` | spend points |
| POST   | `/api/points/adjust` | admin manual adjustment |
| GET    | `/api/points/transactions[?kid_id=]` | audit log |
| POST   | `/api/admin/verify` | PIN check |
| POST/PUT/DELETE | `/api/admin/chores[/:id]` | chore CRUD (PIN required via `x-admin-pin` header) |
| PUT    | `/api/admin/kids/:id` | edit kid (PIN required) |

---

## Backup & restore

`server/data.db` is the entire app state. Copy it off the Pi periodically:

```bash
scp pi@maxwell-hq.local:/home/pi/maxwell-hq/server/data.db ./backup-$(date +%F).db
```

To restore: stop the service, drop the file into `server/`, start the service.

---

## License

Private family project. No license granted for redistribution.
