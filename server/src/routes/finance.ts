import { Router, Response } from "express";
import pool from "../db";
import crypto from "crypto";
import { AuthRequest } from "../middleware/auth";

const router = Router();

function hashPin(pin: string): string {
  return crypto.createHash("sha256").update(pin.trim()).digest("hex");
}

async function recalcMonth(month: string, userId: number): Promise<number> {
  const [year, mon] = month.split("-").map(Number);
  const prevDate = new Date(year, mon - 2, 1);
  const prevMonth = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, "0")}`;

  const prevSummary = await pool.query(
    "SELECT closing_balance FROM finance_monthly_summary WHERE month = $1 AND user_id = $2",
    [prevMonth, userId],
  );
  const openingBalance = prevSummary.rows.length > 0
    ? parseFloat(prevSummary.rows[0].closing_balance)
    : 0;

  const allTx = await pool.query(
    `SELECT type, SUM(amount) as total FROM finance_transactions
     WHERE TO_CHAR(date, 'YYYY-MM') = $1 AND user_id = $2 GROUP BY type`,
    [month, userId],
  );
  let allIncome = 0, allExpenses = 0;
  allTx.rows.forEach((r: any) => {
    if (r.type === "income") allIncome = parseFloat(r.total);
    else allExpenses = parseFloat(r.total);
  });

  const statsTx = await pool.query(
    `SELECT type, SUM(amount) as total FROM finance_transactions
     WHERE TO_CHAR(date, 'YYYY-MM') = $1 AND is_goal = false AND user_id = $2 GROUP BY type`,
    [month, userId],
  );
  let statsIncome = 0, statsExpenses = 0;
  statsTx.rows.forEach((r: any) => {
    if (r.type === "income") statsIncome = parseFloat(r.total);
    else statsExpenses = parseFloat(r.total);
  });

  const closingBalance = openingBalance + allIncome - allExpenses;

  await pool.query(
    `INSERT INTO finance_monthly_summary (month, opening_balance, closing_balance, total_income, total_expenses, user_id)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (month, user_id) DO UPDATE SET
       opening_balance = EXCLUDED.opening_balance,
       closing_balance = EXCLUDED.closing_balance,
       total_income = EXCLUDED.total_income,
       total_expenses = EXCLUDED.total_expenses`,
    [month, openingBalance, closingBalance, statsIncome, statsExpenses, userId],
  );

  return closingBalance;
}

// ── PIN Gate ──────────────────────────────────────────────────────────────────

router.get("/config/status", async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const result = await pool.query(
    "SELECT id FROM finance_config WHERE user_id = $1 LIMIT 1",
    [userId],
  );
  res.json({ configured: result.rows.length > 0 });
});

router.post("/config/setup", async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const existing = await pool.query(
    "SELECT id FROM finance_config WHERE user_id = $1 LIMIT 1",
    [userId],
  );
  if (existing.rows.length > 0) return res.status(400).json({ error: "Already configured" });
  const { pin } = req.body;
  if (!pin || pin.length < 4) return res.status(400).json({ error: "PIN must be at least 4 digits" });
  await pool.query("INSERT INTO finance_config (pin_hash, user_id) VALUES ($1, $2)", [hashPin(pin), userId]);
  res.json({ success: true });
});

router.post("/config/verify", async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const { pin } = req.body;
  const result = await pool.query(
    "SELECT pin_hash FROM finance_config WHERE user_id = $1 LIMIT 1",
    [userId],
  );
  if (result.rows.length === 0) return res.status(404).json({ error: "Not configured" });
  res.json({ success: hashPin(pin) === result.rows[0].pin_hash });
});

router.get("/config/settings", async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const result = await pool.query(
    "SELECT currency FROM finance_config WHERE user_id = $1 LIMIT 1",
    [userId],
  );
  if (result.rows.length === 0) return res.status(404).json({ error: "Not configured" });
  res.json({ currency: result.rows[0].currency || "EUR" });
});

router.put("/config/currency", async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const { currency } = req.body;
  const allowed = ["EUR", "USD", "GBP", "MAD", "CAD", "CHF", "JPY", "AED", "KWD", "LBP"];
  if (!allowed.includes(currency)) return res.status(400).json({ error: "Invalid currency" });
  await pool.query(
    "UPDATE finance_config SET currency = $1 WHERE user_id = $2",
    [currency, userId],
  );
  res.json({ success: true });
});

router.put("/config/pin", async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const { currentPin, newPin } = req.body;
  if (!newPin || newPin.length < 4) return res.status(400).json({ error: "New PIN must be at least 4 digits" });
  const result = await pool.query(
    "SELECT pin_hash FROM finance_config WHERE user_id = $1 LIMIT 1",
    [userId],
  );
  if (result.rows.length === 0) return res.status(404).json({ error: "Not configured" });
  if (hashPin(currentPin) !== result.rows[0].pin_hash) return res.status(401).json({ error: "Wrong PIN" });
  await pool.query(
    "UPDATE finance_config SET pin_hash = $1 WHERE user_id = $2",
    [hashPin(newPin), userId],
  );
  res.json({ success: true });
});

// ── Categories ────────────────────────────────────────────────────────────────

router.get("/categories", async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const result = await pool.query(
    "SELECT * FROM finance_categories WHERE user_id = $1 ORDER BY created_at ASC",
    [userId],
  );
  res.json(result.rows);
});

router.post("/categories", async (req: AuthRequest, res: Response) => {
  const { name, icon, color, monthly_budget, type } = req.body;
  const userId = req.userId!;
  const result = await pool.query(
    `INSERT INTO finance_categories (name, icon, color, monthly_budget, type, user_id)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [name, icon || "💰", color || "#6366f1", monthly_budget || 0, type || "expense", userId],
  );
  res.json(result.rows[0]);
});

router.put("/categories/:id", async (req: AuthRequest, res: Response) => {
  const { name, icon, color, monthly_budget, type } = req.body;
  const userId = req.userId!;
  const result = await pool.query(
    `UPDATE finance_categories SET name=$1, icon=$2, color=$3, monthly_budget=$4, type=$5
     WHERE id=$6 AND user_id=$7 RETURNING *`,
    [name, icon, color, monthly_budget, type, req.params.id, userId],
  );
  res.json(result.rows[0]);
});

router.delete("/categories/:id", async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  await pool.query("DELETE FROM finance_categories WHERE id=$1 AND user_id=$2", [req.params.id, userId]);
  res.json({ success: true });
});

// ── Transactions ──────────────────────────────────────────────────────────────

router.get("/transactions", async (req: AuthRequest, res: Response) => {
  const { month, category_id } = req.query;
  const userId = req.userId!;
  let query = `SELECT t.*, c.name as category_name, c.icon as category_icon, c.color as category_color,
               TO_CHAR(t.date, 'YYYY-MM-DD') as date
               FROM finance_transactions t
               LEFT JOIN finance_categories c ON t.category_id = c.id`;
  const params: any[] = [userId];
  const conditions: string[] = ["t.user_id = $1"];

  if (month) {
    params.push(month);
    conditions.push(`TO_CHAR(t.date, 'YYYY-MM') = $${params.length}`);
  }
  if (category_id) {
    params.push(category_id);
    conditions.push(`t.category_id = $${params.length}`);
  }
  query += " WHERE " + conditions.join(" AND ");
  query += " ORDER BY t.date DESC, t.created_at DESC";

  const result = await pool.query(query, params);
  res.json(result.rows);
});

router.post("/transactions", async (req: AuthRequest, res: Response) => {
  const { amount, type, category_id, date, note, is_recurring, recurring_id, is_goal } = req.body;
  const userId = req.userId!;
  const result = await pool.query(
    `INSERT INTO finance_transactions (amount, type, category_id, date, note, is_recurring, recurring_id, is_goal, user_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING *, TO_CHAR(date, 'YYYY-MM-DD') as date`,
    [amount, type, category_id || null, date, note || "", is_recurring || false, recurring_id || null, is_goal || false, userId],
  );
  res.json(result.rows[0]);
});

router.put("/transactions/:id", async (req: AuthRequest, res: Response) => {
  const { amount, type, category_id, date, note } = req.body;
  const userId = req.userId!;
  const result = await pool.query(
    `UPDATE finance_transactions SET amount=$1, type=$2, category_id=$3, date=$4, note=$5
     WHERE id=$6 AND user_id=$7 RETURNING *, TO_CHAR(date, 'YYYY-MM-DD') as date`,
    [amount, type, category_id || null, date, note || "", req.params.id, userId],
  );
  res.json(result.rows[0]);
});

router.delete("/transactions/:id", async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  await pool.query("DELETE FROM finance_transactions WHERE id=$1 AND user_id=$2", [req.params.id, userId]);
  res.json({ success: true });
});

// ── Recurring Templates ───────────────────────────────────────────────────────

router.get("/recurring", async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const result = await pool.query(
    `SELECT r.*, c.name as category_name, c.icon as category_icon, c.color as category_color
     FROM finance_recurring r
     LEFT JOIN finance_categories c ON r.category_id = c.id
     WHERE r.active = true AND r.user_id = $1 ORDER BY r.day_of_month ASC`,
    [userId],
  );
  res.json(result.rows);
});

router.post("/recurring", async (req: AuthRequest, res: Response) => {
  const { title, amount, category_id, type, day_of_month } = req.body;
  const userId = req.userId!;
  const result = await pool.query(
    `INSERT INTO finance_recurring (title, amount, category_id, type, day_of_month, user_id)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [title, amount, category_id || null, type || "expense", day_of_month || 1, userId],
  );
  res.json(result.rows[0]);
});

router.delete("/recurring/:id", async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  await pool.query(
    "UPDATE finance_recurring SET active=false WHERE id=$1 AND user_id=$2",
    [req.params.id, userId],
  );
  res.json({ success: true });
});

router.post("/recurring/skip", async (req: AuthRequest, res: Response) => {
  const { recurring_id, month } = req.body;
  await pool.query(
    `INSERT INTO finance_recurring_skips (recurring_id, month) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
    [recurring_id, month],
  );
  res.json({ success: true });
});

// ── Savings Goals ─────────────────────────────────────────────────────────────

router.get("/goals", async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const result = await pool.query(
    "SELECT * FROM finance_goals WHERE user_id = $1 ORDER BY created_at DESC",
    [userId],
  );
  res.json(result.rows);
});

router.post("/goals", async (req: AuthRequest, res: Response) => {
  const { name, icon, color, target_amount, deadline } = req.body;
  const userId = req.userId!;
  const result = await pool.query(
    `INSERT INTO finance_goals (name, icon, color, target_amount, deadline, user_id)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [name, icon || "🎯", color || "#6366f1", target_amount, deadline || null, userId],
  );
  res.json(result.rows[0]);
});

router.patch("/goals/:id/contribute", async (req: AuthRequest, res: Response) => {
  const { amount } = req.body;
  const userId = req.userId!;
  const result = await pool.query(
    `UPDATE finance_goals SET current_amount = GREATEST(0, current_amount + $1) WHERE id=$2 AND user_id=$3 RETURNING *`,
    [amount, req.params.id, userId],
  );
  res.json(result.rows[0]);
});

router.put("/goals/:id", async (req: AuthRequest, res: Response) => {
  const { name, icon, color, target_amount, deadline } = req.body;
  const userId = req.userId!;
  const result = await pool.query(
    `UPDATE finance_goals SET name=$1, icon=$2, color=$3, target_amount=$4, deadline=$5
     WHERE id=$6 AND user_id=$7 RETURNING *`,
    [name, icon, color, target_amount, deadline || null, req.params.id, userId],
  );
  res.json(result.rows[0]);
});

router.delete("/goals/:id", async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  await pool.query("DELETE FROM finance_goals WHERE id=$1 AND user_id=$2", [req.params.id, userId]);
  res.json({ success: true });
});

// ── Monthly Summary ───────────────────────────────────────────────────────────

router.get("/summary/:month", async (req: AuthRequest, res: Response) => {
  const month = String(req.params.month);
  const userId = req.userId!;

  const [year, mon] = month.split("-").map(Number);
  const prevDate = new Date(year, mon - 2, 1);
  const prevMonth = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, "0")}`;

  const prevExists = await pool.query(
    "SELECT id FROM finance_monthly_summary WHERE month = $1 AND user_id = $2",
    [prevMonth, userId],
  );
  let openingBalance = 0;
  if (prevExists.rows.length > 0) {
    openingBalance = await recalcMonth(prevMonth, userId);
  }

  const allTx = await pool.query(
    `SELECT type, SUM(amount) as total FROM finance_transactions
     WHERE TO_CHAR(date, 'YYYY-MM') = $1 AND user_id = $2 GROUP BY type`,
    [month, userId],
  );
  let allIncome = 0, allExpenses = 0;
  allTx.rows.forEach((r: any) => {
    if (r.type === "income") allIncome = parseFloat(r.total);
    else allExpenses = parseFloat(r.total);
  });

  const statsTx = await pool.query(
    `SELECT type, SUM(amount) as total FROM finance_transactions
     WHERE TO_CHAR(date, 'YYYY-MM') = $1 AND is_goal = false AND user_id = $2 GROUP BY type`,
    [month, userId],
  );
  let statsIncome = 0, statsExpenses = 0;
  statsTx.rows.forEach((r: any) => {
    if (r.type === "income") statsIncome = parseFloat(r.total);
    else statsExpenses = parseFloat(r.total);
  });

  const closingBalance = openingBalance + allIncome - allExpenses;

  const result = await pool.query(
    `INSERT INTO finance_monthly_summary (month, opening_balance, closing_balance, total_income, total_expenses, user_id)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (month, user_id) DO UPDATE SET
       opening_balance = EXCLUDED.opening_balance,
       closing_balance = EXCLUDED.closing_balance,
       total_income = EXCLUDED.total_income,
       total_expenses = EXCLUDED.total_expenses
     RETURNING *`,
    [month, openingBalance, closingBalance, statsIncome, statsExpenses, userId],
  );

  return res.json({
    ...result.rows[0],
    closing_balance: closingBalance,
    total_income: statsIncome,
    total_expenses: statsExpenses,
  });
});

// ── Category spending ─────────────────────────────────────────────────────────

router.get("/spending/:month", async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const result = await pool.query(
    `SELECT c.id, c.name, c.icon, c.color, c.monthly_budget, c.type,
            COALESCE(SUM(t.amount), 0) as spent
     FROM finance_categories c
     LEFT JOIN finance_transactions t
       ON t.category_id = c.id
       AND TO_CHAR(t.date, 'YYYY-MM') = $1
       AND t.type = 'expense'
       AND t.is_goal = false
     WHERE c.user_id = $2
     GROUP BY c.id ORDER BY c.created_at ASC`,
    [req.params.month, userId],
  );
  res.json(result.rows);
});

// ── Pending recurring ─────────────────────────────────────────────────────────

router.get("/recurring/pending/:month", async (req: AuthRequest, res: Response) => {
  const { month } = req.params;
  const userId = req.userId!;
  const result = await pool.query(
    `SELECT r.*, c.name as category_name, c.icon as category_icon, c.color as category_color
     FROM finance_recurring r
     LEFT JOIN finance_categories c ON r.category_id = c.id
     WHERE r.active = true AND r.user_id = $2
     AND r.id NOT IN (
       SELECT DISTINCT recurring_id FROM finance_transactions
       WHERE TO_CHAR(date, 'YYYY-MM') = $1
       AND recurring_id IS NOT NULL
       AND user_id = $2
     )
     AND r.id NOT IN (
       SELECT recurring_id FROM finance_recurring_skips
       WHERE month = $1
     )
     AND TO_CHAR(r.created_at, 'YYYY-MM') != $1`,
    [month, userId],
  );
  res.json(result.rows);
});

export default router;
