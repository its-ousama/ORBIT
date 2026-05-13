import { Router, Response } from "express";
import pool from "../db";
import { AuthRequest } from "../middleware/auth";

const router = Router();

router.get("/", async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const result = await pool.query(
    "SELECT id, name, updated_at FROM boards WHERE user_id = $1 ORDER BY updated_at DESC",
    [userId],
  );
  res.json(result.rows);
});

router.get("/:id", async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const result = await pool.query(
    "SELECT * FROM boards WHERE id = $1 AND user_id = $2",
    [req.params.id, userId],
  );
  if (result.rows.length === 0) return res.status(404).json({ error: "Not found" });
  res.json(result.rows[0]);
});

router.post("/", async (req: AuthRequest, res: Response) => {
  const { name } = req.body;
  const userId = req.userId!;
  const result = await pool.query(
    "INSERT INTO boards (name, user_id) VALUES ($1, $2) RETURNING id, name, updated_at",
    [name, userId],
  );
  res.json(result.rows[0]);
});

router.put("/:id", async (req: AuthRequest, res: Response) => {
  const { data } = req.body;
  const userId = req.userId!;
  const result = await pool.query(
    "UPDATE boards SET data = $1, updated_at = NOW() WHERE id = $2 AND user_id = $3 RETURNING id, name, updated_at",
    [JSON.stringify(data), req.params.id, userId],
  );
  res.json(result.rows[0]);
});

router.patch("/:id", async (req: AuthRequest, res: Response) => {
  const { name } = req.body;
  const userId = req.userId!;
  const result = await pool.query(
    "UPDATE boards SET name = $1 WHERE id = $2 AND user_id = $3 RETURNING id, name, updated_at",
    [name, req.params.id, userId],
  );
  res.json(result.rows[0]);
});

router.delete("/:id", async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  await pool.query("DELETE FROM boards WHERE id = $1 AND user_id = $2", [req.params.id, userId]);
  res.json({ success: true });
});

export default router;
