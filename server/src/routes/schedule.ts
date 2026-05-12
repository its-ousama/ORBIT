import { Router, Response } from "express";
import pool from "../db";
import { AuthRequest } from "../middleware/auth";

const router = Router();

router.get("/", async (req: AuthRequest, res: Response) => {
  const { start, end } = req.query;
  const userId = req.userId!;
  const result = await pool.query(
    `SELECT id, title, TO_CHAR(date, 'YYYY-MM-DD') as date, start_time, end_time, type, created_at
     FROM schedule
     WHERE date >= $1 AND date <= $2 AND user_id = $3
     ORDER BY date ASC, start_time ASC`,
    [start, end, userId],
  );
  res.json(result.rows);
});

router.post("/", async (req: AuthRequest, res: Response) => {
  const { title, date, start_time, end_time, type } = req.body;
  const userId = req.userId!;
  const result = await pool.query(
    `INSERT INTO schedule (title, date, start_time, end_time, type, user_id)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, title, TO_CHAR(date, 'YYYY-MM-DD') as date, start_time, end_time, type, created_at`,
    [title, date, start_time, end_time, type, userId],
  );
  res.json(result.rows[0]);
});

router.put("/:id", async (req: AuthRequest, res: Response) => {
  const { title, date, start_time, end_time, type } = req.body;
  const userId = req.userId!;
  const result = await pool.query(
    `UPDATE schedule SET title=$1, date=$2, start_time=$3, end_time=$4, type=$5
     WHERE id=$6 AND user_id=$7
     RETURNING id, title, TO_CHAR(date, 'YYYY-MM-DD') as date, start_time, end_time, type, created_at`,
    [title, date, start_time, end_time, type, req.params.id, userId],
  );
  res.json(result.rows[0]);
});

router.delete("/:id", async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  await pool.query("DELETE FROM schedule WHERE id = $1 AND user_id = $2", [req.params.id, userId]);
  res.json({ success: true });
});

router.post("/bulk", async (req: AuthRequest, res: Response) => {
  const { title, dates, start_time, end_time, type } = req.body;
  const userId = req.userId!;
  if (!dates || dates.length === 0)
    return res.status(400).json({ error: "No dates provided" });

  const results = [];
  for (const date of dates) {
    const result = await pool.query(
      `INSERT INTO schedule (title, date, start_time, end_time, type, user_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, title, TO_CHAR(date, 'YYYY-MM-DD') as date, start_time, end_time, type, created_at`,
      [title, date, start_time, end_time, type, userId],
    );
    results.push(result.rows[0]);
  }
  res.json(results);
});

export default router;
