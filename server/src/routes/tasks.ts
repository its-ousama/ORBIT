import { Router, Response } from "express";
import pool from "../db";
import { AuthRequest } from "../middleware/auth";

const router = Router();

const DATE_FORMAT = "TO_CHAR(date, 'YYYY-MM-DD') as date";

router.get("/", async (req: AuthRequest, res: Response) => {
  const { date } = req.query;
  const userId = req.userId!;
  const result = date
    ? await pool.query(
        `SELECT id, title, ${DATE_FORMAT}, status, priority, color, created_at FROM tasks WHERE date = $1 AND user_id = $2 ORDER BY created_at ASC`,
        [date, userId],
      )
    : await pool.query(
        `SELECT id, title, ${DATE_FORMAT}, status, priority, color, created_at FROM tasks WHERE user_id = $1 ORDER BY date ASC, created_at ASC`,
        [userId],
      );
  res.json(result.rows);
});

router.post("/", async (req: AuthRequest, res: Response) => {
  const { title, date, priority, color } = req.body;
  const userId = req.userId!;
  const result = await pool.query(
    `INSERT INTO tasks (title, date, priority, color, user_id) VALUES ($1, $2, $3, $4, $5) RETURNING id, title, ${DATE_FORMAT}, status, priority, color, created_at`,
    [title, date, priority, color, userId],
  );
  res.json(result.rows[0]);
});

router.patch("/:id/status", async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { status } = req.body;
  const userId = req.userId!;
  const result = await pool.query(
    `UPDATE tasks SET status = $1 WHERE id = $2 AND user_id = $3 RETURNING id, title, ${DATE_FORMAT}, status, priority, color, created_at`,
    [status, id, userId],
  );
  res.json(result.rows[0]);
});

router.patch("/:id", async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { title, priority, color } = req.body;
  const userId = req.userId!;
  const result = await pool.query(
    `UPDATE tasks SET title = $1, priority = $2, color = $3 WHERE id = $4 AND user_id = $5 RETURNING id, title, ${DATE_FORMAT}, status, priority, color, created_at`,
    [title, priority, color, id, userId],
  );
  res.json(result.rows[0]);
});

router.delete("/:id", async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  await pool.query("DELETE FROM tasks WHERE id = $1 AND user_id = $2", [req.params.id, userId]);
  res.json({ success: true });
});

export default router;
