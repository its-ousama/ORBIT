import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import taskRoutes from "./routes/tasks";
import topicRoutes from "./routes/topics";
import pool from "./db";
import boardRoutes from "./routes/boards";
import scheduleRoutes from "./routes/schedule";
import journalRoutes from "./routes/journals";
import financeRoutes from "./routes/finance";
import booksRoutes from "./routes/books";
import authRoutes from "./routes/auth";
import { requireAuth } from "./middleware/auth";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

app.use("/api/auth", authRoutes);
app.use("/api/tasks", requireAuth, taskRoutes);
app.use("/api/topics", requireAuth, topicRoutes);
app.use("/api/boards", requireAuth, boardRoutes);
app.use("/api/schedule", requireAuth, scheduleRoutes);
app.use("/api/journals", requireAuth, journalRoutes);
app.use("/api/finance", requireAuth, financeRoutes);
app.use("/api/books", requireAuth, booksRoutes);

const PORT = process.env.PORT || 3001;

const initDb = async () => {
  // ── Users ────────────────────────────────────────────────────────────────────
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      username TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS tasks (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      date DATE NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      priority TEXT NOT NULL DEFAULT 'medium',
      color TEXT NOT NULL DEFAULT '#6366f1',
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS boards (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      data JSONB DEFAULT '{}',
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schedule (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      date DATE NOT NULL,
      start_time TEXT,
      end_time TEXT,
      type TEXT NOT NULL DEFAULT 'personal',
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS topics (
      id SERIAL PRIMARY KEY,
      slug TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      abbr TEXT,
      icon TEXT DEFAULT '📄',
      color TEXT DEFAULT '#2563eb',
      category TEXT NOT NULL,
      description TEXT,
      analogy TEXT,
      concepts JSONB DEFAULT '[]',
      connects JSONB DEFAULT '[]',
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS journals (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL DEFAULT 'Untitled',
      content JSONB DEFAULT '{}',
      theme JSONB DEFAULT '{}',
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS journal_config (
      id SERIAL PRIMARY KEY,
      hash TEXT NOT NULL
    )
  `);

  // ── Finance tables ──────────────────────────────────────────────────────────
  await pool.query(`
    CREATE TABLE IF NOT EXISTS finance_config (
      id SERIAL PRIMARY KEY,
      pin_hash TEXT NOT NULL
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS finance_categories (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      icon TEXT DEFAULT '💰',
      color TEXT DEFAULT '#6366f1',
      monthly_budget NUMERIC(12,2) DEFAULT 0,
      type TEXT NOT NULL DEFAULT 'expense',
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS finance_transactions (
      id SERIAL PRIMARY KEY,
      amount NUMERIC(12,2) NOT NULL,
      type TEXT NOT NULL DEFAULT 'expense',
      category_id INTEGER REFERENCES finance_categories(id) ON DELETE SET NULL,
      date DATE NOT NULL DEFAULT NOW(),
      note TEXT DEFAULT '',
      is_recurring BOOLEAN DEFAULT false,
      recurring_id INTEGER,
      is_goal BOOLEAN DEFAULT false,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);
  await pool.query(`
    ALTER TABLE finance_transactions ADD COLUMN IF NOT EXISTS is_goal BOOLEAN DEFAULT false
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS finance_recurring (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      amount NUMERIC(12,2) NOT NULL,
      category_id INTEGER REFERENCES finance_categories(id) ON DELETE SET NULL,
      type TEXT NOT NULL DEFAULT 'expense',
      day_of_month INTEGER DEFAULT 1,
      active BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS finance_recurring_skips (
      id SERIAL PRIMARY KEY,
      recurring_id INTEGER NOT NULL,
      month TEXT NOT NULL,
      UNIQUE(recurring_id, month)
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS finance_goals (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      icon TEXT DEFAULT '🎯',
      color TEXT DEFAULT '#6366f1',
      target_amount NUMERIC(12,2) NOT NULL,
      current_amount NUMERIC(12,2) DEFAULT 0,
      deadline DATE,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS finance_monthly_summary (
      id SERIAL PRIMARY KEY,
      month TEXT UNIQUE NOT NULL,
      opening_balance NUMERIC(12,2) DEFAULT 0,
      closing_balance NUMERIC(12,2) DEFAULT 0,
      total_income NUMERIC(12,2) DEFAULT 0,
      total_expenses NUMERIC(12,2) DEFAULT 0,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  // ── Add user_id to all data tables (safe no-op if column already exists) ────
  const dataTables = [
    "tasks", "boards", "schedule", "topics", "journals", "journal_config",
    "finance_config", "finance_categories", "finance_transactions",
    "finance_recurring", "finance_goals", "finance_monthly_summary",
  ];
  for (const table of dataTables) {
    await pool.query(`
      ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE CASCADE
    `);
  }

  // ── Fix finance_monthly_summary unique constraint to be per (month, user_id) ─
  await pool.query(`ALTER TABLE finance_monthly_summary DROP CONSTRAINT IF EXISTS finance_monthly_summary_month_key`);
  await pool.query(`
    DO $body$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fms_month_user_unique') THEN
        ALTER TABLE finance_monthly_summary ADD CONSTRAINT fms_month_user_unique UNIQUE (month, user_id);
      END IF;
    END $body$
  `);

  // ── Migrate existing data to default user ────────────────────────────────────
  const { rows: existingUsers } = await pool.query(`SELECT id FROM users LIMIT 1`);
  if (existingUsers.length === 0) {
    const email = process.env.DEFAULT_USER_EMAIL!;
    const username = process.env.DEFAULT_USER_NAME!;
    const passwordHash = await bcrypt.hash(process.env.DEFAULT_USER_PASSWORD!, 10);
    const { rows } = await pool.query(
      `INSERT INTO users (email, username, password_hash) VALUES ($1, $2, $3) RETURNING id`,
      [email, username, passwordHash]
    );
    const userId = rows[0].id;
    for (const table of dataTables) {
      await pool.query(`UPDATE ${table} SET user_id = $1 WHERE user_id IS NULL`, [userId]);
    }
    console.log(`Default user created: ${email} (id=${userId}), all existing data migrated.`);
  }

  // ── Books tables ─────────────────────────────────────────────────────────────
  await pool.query(`
    CREATE TABLE IF NOT EXISTS books (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE NOT NULL,
      title TEXT NOT NULL,
      author TEXT DEFAULT '',
      cover_image BYTEA,
      epub_data BYTEA NOT NULL,
      file_size INTEGER DEFAULT 0,
      source TEXT NOT NULL DEFAULT 'epub',
      gutenberg_id TEXT,
      added_at TIMESTAMP DEFAULT NOW()
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS book_progress (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE NOT NULL,
      book_id INTEGER REFERENCES books(id) ON DELETE CASCADE,
      current_location TEXT DEFAULT '',
      percent_complete INTEGER DEFAULT 0,
      last_read_at TIMESTAMP DEFAULT NOW(),
      finished_at TIMESTAMP,
      UNIQUE(user_id, book_id)
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS book_history (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE NOT NULL,
      book_id INTEGER REFERENCES books(id) ON DELETE SET NULL,
      title TEXT NOT NULL,
      author TEXT DEFAULT '',
      source TEXT NOT NULL DEFAULT 'epub',
      finished_at TIMESTAMP DEFAULT NOW()
    )
  `);

  await pool.query(`
    ALTER TABLE books ADD COLUMN IF NOT EXISTS format VARCHAR(10) DEFAULT 'epub'
  `);
  await pool.query(`
    ALTER TABLE book_history ADD COLUMN IF NOT EXISTS gutenberg_id TEXT
  `);

  console.log("Database ready");
};

initDb().then(() => {
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
});