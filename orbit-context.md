# Orbit — Full Project Context (Claude Code Handoff)

## What This Project Is

**Orbit** is a personal operating system built as a full-stack web app. It started as an internship planner for an SNCF internship but evolved into a personal OS with a dark home screen, app-style navigation, and a finance dashboard as the flagship feature. The tagline is "Everything revolves around you."

The app runs locally at `http://localhost:5173` (frontend) and `http://localhost:3001` (backend).

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19 + TypeScript + Vite |
| Backend | Node.js + Express 5 + TypeScript |
| Database | PostgreSQL (local) |
| ORM/Query | Raw SQL via `pg` |
| Drawing | `@excalidraw/excalidraw` |
| Rich Text | TipTap (journal editor) |
| Charts | Recharts (finance dashboard) |
| HTTP Client | Axios |
| Date handling | dayjs |
| Dev tooling | nodemon + ts-node |

---

## Project Structure

```
internship-planner/
├── client/
│   └── src/
│       ├── App.tsx                    # Root — home screen entry, page routing
│       ├── App.css                    # Global layout styles
│       ├── financeApi.ts              # Axios functions for all finance endpoints
│       ├── api.ts                     # Axios functions for tasks and topics
│       ├── types.ts                   # All TypeScript types
│       └── assets/                   # Icons and images
│           ├── icons8-bank-96.png
│           ├── icons8-boards-96.png
│           ├── icons8-book-96.png
│           ├── icons8-calendar-96.png
│           ├── icons8-database-view-96.png
│           ├── icons8-tasks-96.png
│           └── icons8-week-view-96.png
│       └── components/
│           ├── HomePage.tsx/css        # Dark OS home screen with app grid
│           ├── HomeButton.tsx/css      # Floating home button (fixed top-left)
│           ├── TasksPage.tsx/css       # Daily task manager
│           ├── TaskCard.tsx/css        # Individual task card
│           ├── CalendarPage.tsx/css    # Monthly calendar
│           ├── WeekPage.tsx/css        # Weekly schedule
│           ├── DocumentationPage.tsx/css # Knowledge base shell
│           ├── TopicView.tsx/css       # Topic detail view
│           ├── TopicForm.tsx/css       # Add/edit topic form
│           ├── BoardsPage.tsx/css      # Excalidraw boards
│           ├── JournalPage.tsx/css     # Gated journal (3-factor auth)
│           ├── JournalEditor.tsx/css   # TipTap rich text editor
│           ├── NotificationsPage.tsx/css # Global notifications hub
│           ├── FinancePage.tsx/css     # Finance app shell + PIN gate
│           ├── FinanceDashboard.tsx/css # Charts + stats
│           ├── FinanceTransactions.tsx/css # Transaction log
│           ├── FinanceBudget.tsx/css   # Budget categories + recurring list
│           ├── FinanceGoals.tsx/css    # Savings goals
│           ├── FinanceNotifications.tsx/css # Finance-specific notifications
│           ├── NumberTicker.tsx        # Animated number count-up
│           ├── BlurFade.tsx            # Blur fade-in animation wrapper
│           ├── BorderBeam.tsx/css      # Rotating border beam effect
│           ├── ShineBorder.tsx/css     # Shine border effect
│           ├── AnimatedList.tsx/css    # Staggered list animation
│           └── Confetti.tsx            # Canvas confetti burst
│           └── css/                   # All CSS files live here
└── server/
    └── src/
        ├── index.ts                   # App entry, middleware, DB init
        ├── db.ts                      # PostgreSQL pool
        └── routes/
            ├── tasks.ts
            ├── topics.ts
            ├── boards.ts
            ├── schedule.ts
            ├── journals.ts
            └── finance.ts
```

---

## Running the App

```bash
# Backend
cd server && npm run dev
# Runs on http://localhost:3001

# Frontend
cd client && npm run dev
# Runs on http://localhost:5173
```

---

## Database Schema

### Core tables
- `tasks` — id, title, date, status (pending/scratched), priority, color, created_at
- `boards` — id, name, data (JSONB excalidraw state), updated_at
- `schedule` — id, title, date, start_time, end_time, type, created_at
- `topics` — id, slug, name, abbr, icon, color, category, description, analogy, concepts (JSONB), connects (JSONB), created_at
- `journals` — id, name, content (JSONB TipTap), theme (JSONB), created_at, updated_at
- `journal_config` — id, hash (SHA-256 of password+answer+number)

### Finance tables
- `finance_config` — id, pin_hash (SHA-256 4-digit PIN)
- `finance_categories` — id, name, icon, color, monthly_budget, type, created_at
- `finance_transactions` — id, amount, type, category_id, date, note, is_recurring, recurring_id, is_goal, created_at
- `finance_recurring` — id, title, amount, category_id, type, day_of_month, active, created_at
- `finance_recurring_skips` — id, recurring_id, month (YYYY-MM) — persists skipped recurring per month
- `finance_goals` — id, name, icon, color, target_amount, current_amount, deadline, created_at
- `finance_monthly_summary` — id, month, opening_balance, closing_balance, total_income, total_expenses

All tables are auto-created on server start via `initDb()` in `index.ts`.

---

## App Pages & Features

### Home Screen (HomePage.tsx)
- Dark background (`#020817`) with floating color orbs
- Large clock (time + date)
- Orbit logo — animated SVG orbit symbol that slowly rotates
- 8 app cards in a 4x2 grid with Icons8 icons from `src/assets/`
- Notifications app shows iPhone-style red number badge
- Click an app → 280ms animation → navigates
- No sidebar — each app is full screen
- Floating home button (⌂) fixed top-left on every page, returns to home

### Tasks Page
- Daily task list with date navigation (‹ ›)
- "Today" title gets indigo gradient text
- Add task form (unified card, glows on focus)
- Priority: high/medium/low with colored left border
- Scratch to complete (strikethrough), unscratch
- Inline edit with pencil icon
- Task cards animate in staggered on load

### Calendar Page
- Monthly grid view
- Colored priority dots per day
- Click day → popup with tasks for that day
- "Go to this day" navigates to Tasks for that date

### This Week Page
- 7-column weekly grid Mon → Sun
- Color-coded event types: Work, Shift, Personal, Meeting, Gym
- Click + → modal to add event
- Repeat on multiple days at once
- Navigate weeks, jump to date

### Documentation (Knowledge Base)
- Split layout: sidebar (topics list) + main (topic view)
- Categories with count badges
- Active topic has colored left accent
- TopicView: hero card with color wash, sections (Overview, Analogy, Key Concepts, Connects to)
- TopicForm: sectioned form (Basic Info, Category & Appearance, Content, Key Concepts)

### Boards
- List of named Excalidraw canvases
- Full-screen canvas per board
- Autosave to DB (2s debounce)

### Journal (labeled "Settings" in nav to hide it)
- 3-factor gate: password + secret answer + secret number
- All three combined and SHA-256 hashed — stored once, never shown again
- TipTap rich text editor: bold, italic, underline, headings, lists, blockquote, alignment
- Multiple journals, each with its own theme (background color + font)
- Dark backgrounds auto-flip text to light
- Autosave 2s debounce

### Finance
- 4-digit PIN gate with numpad + keyboard support + BorderBeam animation
- Inner sidebar: Dashboard / Transactions / Budget / Goals / Notifications
- **Dashboard**: NumberTicker animated stats, BlurFade sections, bar chart, donut chart, recent transactions
- **Transactions**: Quick-add form, category filter, type filter, recurring flag auto-creates template
- **Budget**: Category CRUD with progress bars (goes red when over), recurring templates list at bottom
- **Goals**: Savings goals with progress bars, Add funds / Withdraw, Confetti on 100% achievement
- **Notifications (Finance)**: Pending recurring confirmations, over budget alerts, near budget warnings, goal milestones, no income warning
- Monthly carryover: closing balance of previous month becomes opening balance of next month (auto-recalculated every load)
- Goal transactions (`is_goal=true`) affect balance but not income/spent stats

### Notifications (Global Hub)
- Pulls from all apps: Finance (recurring, over budget, near budget, goal deadlines, no income), Tasks (overdue, today's high priority), This Week (events today, events starting soon)
- Sorted by priority (urgent first)
- Tap → navigates to relevant app/section
- Dismiss (✕ button) → stored in localStorage, persists across sessions
- Clear all button
- iPhone-style number badge on home screen

---

## Key Design Decisions

- **No sidebar** — home screen replaces it entirely, each app is full screen
- **HomeButton** — floating ⌂ fixed top-left on every page
- **Orbit branding** — name: Orbit, tagline: "Everything revolves around you", animated SVG logo
- **CSS files in `components/css/` folder** — all CSS imports use `./css/filename.css`
- **Finance PIN** — independent from journal gate, 4-digit numpad
- **Journal gate** — 3-factor: password + answer + number, all combined SHA-256
- **Recurring auto-template** — checking "Recurring" on a transaction auto-creates a `finance_recurring` entry
- **Recurring skips** — skipping a recurring stores it in `finance_recurring_skips` (recurring_id, month) so it doesn't reappear
- **Goal transactions** — `is_goal=true` flag, affect balance but excluded from income/spent stats
- **NumberTicker** — always starts from 0, expo ease-out, 2s duration
- **BlurFade** — 12px blur, spring easing, triggers on mount with `inView` prop
- **Confetti** — fires when savings goal first hits 100%

---

## API Routes

All routes prefixed `/api`.

### Tasks `/api/tasks`
- GET `/` — all tasks, filter by `?date=`
- POST `/` — create task
- PATCH `/:id/status` — update status
- PATCH `/:id` — edit task
- DELETE `/:id` — delete task

### Topics `/api/topics`
- GET, POST, PUT `/:id`, DELETE `/:id`

### Boards `/api/boards`
- GET `/` (list, no canvas data)
- GET `/:id` (with canvas data)
- POST, PUT `/:id` (save canvas), PATCH `/:id` (rename), DELETE `/:id`

### Schedule `/api/schedule`
- GET `/` (filter by `?start=&end=`)
- POST `/`, POST `/bulk`, PUT `/:id`, DELETE `/:id`

### Journals `/api/journals`
- GET `/config/status`, POST `/config/setup`, POST `/config/verify`
- GET `/`, GET `/:id`, POST `/`, PUT `/:id` (content), PATCH `/:id/theme`, PATCH `/:id` (rename), DELETE `/:id`

### Finance `/api/finance`
- GET `/config/status`, POST `/config/setup`, POST `/config/verify`
- GET/POST/PUT/DELETE `/categories`
- GET/POST/PUT/DELETE `/transactions`
- GET/POST/DELETE `/recurring`
- POST `/recurring/skip`
- GET `/recurring/pending/:month`
- GET/POST `/goals`, PATCH `/goals/:id/contribute`, PUT/DELETE `/goals/:id`
- GET `/summary/:month` (auto-recalculates previous month cascade)
- GET `/spending/:month`

---

## Future Implementations (v2 Roadmap)

### 1. Real Settings Page
- Rename "Settings" nav item to "Settings" (currently points to journal)
- Rename journal nav item to "Journal"  
- Settings app contains:
  - Toggle: Orbit Mode (solar system 3D view) vs Grid Mode (current)
  - Theme preferences
  - Notification preferences
  - Account settings (once auth exists)

### 2. Auth System (Login + Users)
- Registration and login page
- JWT-based auth
- User-specific data (each user has their own tasks, finance, journals etc.)
- Currently all data is shared (single user local setup)
- Will need: `users` table, JWT middleware, all routes protected
- Start with 2-3 users (you + brothers for testing)

### 3. 3D Solar System Home Screen (Three.js)
- Replace or toggle alongside current grid home screen
- Center: glowing sun = Orbit logo/planet
- Each app = a textured 3D planet orbiting the sun
- Starfield particle background
- Click a planet → camera zooms into it (flies in)
- Realistic orbit paths with slight tilt
- Toggle between Solar System mode and Grid mode in Settings
- Three.js is already compatible with React, no migration needed

### 4. Mobile App
- React Native companion app
- Will need the backend deployed (not just local)
- Settings page will have connection/sync settings

### 5. Deployment
- Self-hosted on personal server (already has one)
- Nginx reverse proxy
- PM2 for Node process management
- Let's Encrypt SSL
- Custom domain

### 6. Projects Page
- Showcase internship projects and GitHub projects worth sharing
- Each project: name, description, tech stack, links, status
- Stored in DB like topics
- Connected to GitHub optionally

### 7. AI Chatbot (Finance)
- Finance-specific AI assistant
- Can analyze spending, give budget advice
- "Roast mode" — calls you out when overspending 😄
- Will use OpenAI or Anthropic API
- Build after auth system so it can be user-specific

### 8. Email Integration
- Dedicated business email for Orbit
- Read/send emails from within the app
- Gmail API (OAuth) or IMAP/SMTP
- Inbox view, compose, reply, search

---

## Environment

### `server/.env`
```env
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=your_password
DB_NAME=internship_planner
PORT=3001
```

---

## Notes for Claude Code

- All CSS files are in `client/src/components/css/` — imports use `./css/filename.css`
- Finance API functions are in `client/src/financeApi.ts` (separate from `api.ts`)
- The `Page` type in `App.tsx` includes: `"home" | "tasks" | "calendar" | "documentation" | "boards" | "week" | "journal" | "finance" | "notifications"`
- No sidebar exists anymore — it was removed. Each page is full screen with a floating HomeButton
- `FinancePage` accepts `initialSection?: string` prop to deep-link into a section from notifications
- Notifications dismissals are stored in `localStorage` under key `gp_dismissed_notifs`
- The finance summary endpoint always recalculates the previous month first (cascade logic) — don't break this
- `is_goal` transactions affect balance but are excluded from income/spent stats — both in summary and spending queries
- TipTap packages needed: `@tiptap/react @tiptap/pm @tiptap/starter-kit @tiptap/extension-underline @tiptap/extension-text-align @tiptap/extension-placeholder`