# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What is this

**Orbit** — a personal productivity dashboard built as a single-user home base. It replaces a browser homepage with tasks, a weekly schedule, a calendar, a knowledge wiki, drawing boards, a finance tracker, and a journal. The home screen is a 3D solar system on desktop (Three.js) or an app grid on mobile.

## Repo structure

Monorepo with two independent packages:

- `client/` — React 19 + Vite + TypeScript SPA
- `server/` — Express 5 + TypeScript REST API
- `docker-compose.yml` — 4 services: `postgres`, `api`, `web` (nginx), `tunnel` (cloudflared)

## Development commands

Run both concurrently in separate terminals:

```bash
# Client (port 5173, proxying is NOT configured — use the server port directly in dev)
cd client && npm run dev

# Server (port 3001)
cd server && npm run dev      # uses nodemon + ts-node
```

Other commands:
```bash
cd client && npm run build    # tsc -b + vite build
cd client && npm run lint     # eslint

cd server && npm run build    # tsc
cd server && npm run seed     # seed knowledge topics from seedTopics.ts
```

## Environment variables

Copy `.env.example` to `.env` at the repo root. The server also reads `server/.env`. Required vars:

| Variable | Purpose |
|---|---|
| `DB_HOST/PORT/USER/PASSWORD/NAME` | Postgres connection |
| `JWT_SECRET` | Access token signing (15 min expiry) |
| `JWT_REFRESH_SECRET` | Refresh token signing (30 day expiry) |
| `DEFAULT_USER_EMAIL/PASSWORD/NAME` | Auto-created on first boot if no users exist |
| `CLOUDFLARE_TUNNEL_TOKEN` | Production tunnel only |

## Architecture

### Client routing (no React Router)

`App.tsx` owns all navigation state. `Page` is a union type (`"home" | "tasks" | "calendar" | ...`). Pages are rendered by conditional JSX — no URL routing. The `page` state is lifted into `App` so cross-page navigation (e.g., clicking a date in Calendar navigates to Tasks with that date pre-selected) is done via callbacks passed as props.

### Auth flow

- `POST /api/auth/login` returns `accessToken` (15 min) + `refreshToken` (30 day), stored in `localStorage` as `orbit_token` / `orbit_refresh` / `orbit_user`.
- `client/src/http.ts` is the single axios instance used everywhere. It auto-refreshes on 401 via the interceptor. On refresh failure it dispatches `window.dispatchEvent(new Event("orbit_logout"))` which `App.tsx` listens to in order to reset user state.
- `server/src/middleware/auth.ts` — `requireAuth` extracts `userId` from the JWT and attaches it to `req.userId`. Every protected route then filters DB queries by `user_id`.

### API modules

- `client/src/api.ts` — tasks, topics, journals (all use `http.ts`)
- `client/src/financeAPI.ts` — all finance endpoints (categories, transactions, recurring, goals, summary)

### Database schema management

There is no migration framework. All tables are created/altered in the `initDb()` function at the top of `server/src/index.ts`, which runs on every server start. New columns are added with `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` to make changes safe on restart. The `user_id` FK column was added this way retroactively.

### Finance sub-system

Finance has its own PIN lock (separate from login), stored as `finance_config.pin_hash`. Key tables: `finance_categories`, `finance_transactions`, `finance_recurring`, `finance_recurring_skips`, `finance_goals`, `finance_monthly_summary`. Recurring transactions are not auto-posted — the UI shows "pending" recurring items and the user confirms them each month. Skipped months are tracked in `finance_recurring_skips`.

### Journal sub-system

Journal has a separate password+security-question lock (`journal_config.hash`). Content is stored as JSONB (TipTap JSON format). Each journal entry has an independent theme (bg color, font, text color).

### Notifications

Computed entirely client-side in `App.tsx::countNotifications()`. It calls 6 APIs in parallel and generates notification IDs. Dismissed IDs are stored in `localStorage` as `gp_dismissed_notifs`. The badge count reflects undismissed notifications.

### Home screen modes

- `galaxy` — Three.js 3D solar system (`GalaxyHome.tsx`), each planet is a nav target
- `grid` — flat app grid (`HomePage.tsx`)
- Mobile (≤768px) always uses grid; toggling to galaxy on mobile shows `GalaxyGatePage.tsx` (easter egg)
- Preference persisted in `localStorage` as `orbit_view`

### Production deployment

Push to `main` → GitHub Actions type-checks both packages, builds Docker images, pushes to GHCR as `ghcr.io/its-ousama/orbit-api:latest` and `ghcr.io/its-ousama/orbit-web:latest`. The server running `docker-compose pull && docker-compose up -d` picks up new images. The nginx container proxies `/api/` to the Express service; everything else serves the React SPA with SPA fallback (`try_files $uri $uri/ /index.html`).

## Key dependencies

| Dep | Use |
|---|---|
| `@react-three/fiber` + `three` | 3D solar system home screen |
| `@excalidraw/excalidraw` | Drawing boards |
| `@tiptap/*` | Rich-text journal editor |
| `recharts` | Finance charts |
| `react-calendar` | Calendar page |
| `dayjs` | Date formatting throughout |
| `bcryptjs` + `jsonwebtoken` | Server-side auth |
| `pg` | Direct PostgreSQL queries (no ORM) |
