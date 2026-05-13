import { Router, Response } from "express";
import pool from "../db";
import { AuthRequest } from "../middleware/auth";

const router = Router();

router.get("/", async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const result = await pool.query(
    "SELECT * FROM topics WHERE user_id = $1 ORDER BY category, name",
    [userId],
  );
  res.json(result.rows);
});

router.post("/", async (req: AuthRequest, res: Response) => {
  const { slug, name, abbr, icon, color, category, description, analogy, concepts, connects } = req.body;
  const userId = req.userId!;
  const result = await pool.query(
    `INSERT INTO topics (slug, name, abbr, icon, color, category, description, analogy, concepts, connects, user_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
    [slug, name, abbr, icon, color, category, description, analogy,
     JSON.stringify(concepts || []), JSON.stringify(connects || []), userId],
  );
  res.json(result.rows[0]);
});

router.put("/:id", async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { name, abbr, icon, color, category, description, analogy, concepts, connects } = req.body;
  const userId = req.userId!;
  const result = await pool.query(
    `UPDATE topics SET name=$1, abbr=$2, icon=$3, color=$4, category=$5,
     description=$6, analogy=$7, concepts=$8, connects=$9 WHERE id=$10 AND user_id=$11 RETURNING *`,
    [name, abbr, icon, color, category, description, analogy,
     JSON.stringify(concepts || []), JSON.stringify(connects || []), id, userId],
  );
  res.json(result.rows[0]);
});

router.delete("/:id", async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  await pool.query("DELETE FROM topics WHERE id = $1 AND user_id = $2", [req.params.id, userId]);
  res.json({ success: true });
});

export default router;
