import { Router, Response } from "express";
import pool from "../db";
import crypto from "crypto";
import { AuthRequest } from "../middleware/auth";

const router = Router();

function hashValue(val: string): string {
  return crypto.createHash("sha256").update(val.trim().toLowerCase()).digest("hex");
}

router.get("/config/status", async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const result = await pool.query(
    "SELECT id FROM journal_config WHERE user_id = $1 LIMIT 1",
    [userId],
  );
  res.json({ configured: result.rows.length > 0 });
});

router.post("/config/setup", async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const existing = await pool.query(
    "SELECT id FROM journal_config WHERE user_id = $1 LIMIT 1",
    [userId],
  );
  if (existing.rows.length > 0) {
    return res.status(400).json({ error: "Already configured" });
  }
  const { password, answer, number } = req.body;
  if (!password || !answer || !number) {
    return res.status(400).json({ error: "Missing fields" });
  }
  const hash = hashValue(password + answer + String(number));
  await pool.query("INSERT INTO journal_config (hash, user_id) VALUES ($1, $2)", [hash, userId]);
  res.json({ success: true });
});

router.post("/config/verify", async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const { password, answer, number } = req.body;
  if (!password || !answer || !number) {
    return res.status(400).json({ error: "Missing fields" });
  }
  const result = await pool.query(
    "SELECT hash FROM journal_config WHERE user_id = $1 LIMIT 1",
    [userId],
  );
  if (result.rows.length === 0) {
    return res.status(404).json({ error: "Not configured" });
  }
  const hash = hashValue(password + answer + String(number));
  res.json({ success: hash === result.rows[0].hash });
});

router.get("/", async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const result = await pool.query(
    `SELECT id, name, theme, created_at, updated_at FROM journals WHERE user_id = $1 ORDER BY updated_at DESC`,
    [userId],
  );
  res.json(result.rows);
});

router.get("/:id", async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const result = await pool.query(
    `SELECT id, name, content, theme, created_at, updated_at FROM journals WHERE id = $1 AND user_id = $2`,
    [req.params.id, userId],
  );
  if (result.rows.length === 0) return res.status(404).json({ error: "Not found" });
  res.json(result.rows[0]);
});

router.post("/", async (req: AuthRequest, res: Response) => {
  const { name, theme } = req.body;
  const userId = req.userId!;
  const result = await pool.query(
    `INSERT INTO journals (name, content, theme, user_id)
     VALUES ($1, $2, $3, $4)
     RETURNING id, name, content, theme, created_at, updated_at`,
    [
      name || "Untitled",
      JSON.stringify({ type: "doc", content: [] }),
      JSON.stringify(theme || defaultTheme()),
      userId,
    ],
  );
  res.json(result.rows[0]);
});

router.put("/:id", async (req: AuthRequest, res: Response) => {
  const { content } = req.body;
  const userId = req.userId!;
  const result = await pool.query(
    `UPDATE journals SET content = $1, updated_at = NOW()
     WHERE id = $2 AND user_id = $3
     RETURNING id, name, theme, updated_at`,
    [JSON.stringify(content), req.params.id, userId],
  );
  res.json(result.rows[0]);
});

router.patch("/:id/theme", async (req: AuthRequest, res: Response) => {
  const { theme } = req.body;
  const userId = req.userId!;
  const result = await pool.query(
    `UPDATE journals SET theme = $1, updated_at = NOW()
     WHERE id = $2 AND user_id = $3
     RETURNING id, name, theme, updated_at`,
    [JSON.stringify(theme), req.params.id, userId],
  );
  res.json(result.rows[0]);
});

router.patch("/:id", async (req: AuthRequest, res: Response) => {
  const { name } = req.body;
  const userId = req.userId!;
  const result = await pool.query(
    `UPDATE journals SET name = $1, updated_at = NOW()
     WHERE id = $2 AND user_id = $3
     RETURNING id, name, theme, updated_at`,
    [name, req.params.id, userId],
  );
  res.json(result.rows[0]);
});

router.delete("/:id", async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  await pool.query("DELETE FROM journals WHERE id = $1 AND user_id = $2", [req.params.id, userId]);
  res.json({ success: true });
});

function defaultTheme() {
  return { bg: "#ffffff", font: "Georgia, serif", textColor: "#1a1a1a" };
}

export default router;
