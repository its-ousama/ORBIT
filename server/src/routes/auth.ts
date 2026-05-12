import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import pool from "../db";

const router = Router();

function signAccess(userId: number) {
  return jwt.sign({ userId }, process.env.JWT_SECRET!, { expiresIn: "15m" });
}

function signRefresh(userId: number) {
  return jwt.sign({ userId }, process.env.JWT_REFRESH_SECRET!, { expiresIn: "30d" });
}

router.post("/register", async (req: Request, res: Response) => {
  const { email, username, password } = req.body;
  if (!email || !username || !password) {
    res.status(400).json({ error: "email, username and password are required" });
    return;
  }
  try {
    const existing = await pool.query(`SELECT id FROM users WHERE email = $1`, [email]);
    if (existing.rows.length > 0) {
      res.status(409).json({ error: "Email already registered" });
      return;
    }
    const passwordHash = await bcrypt.hash(password, 10);
    const { rows } = await pool.query(
      `INSERT INTO users (email, username, password_hash) VALUES ($1, $2, $3) RETURNING id, email, username`,
      [email, username, passwordHash]
    );
    const user = rows[0];
    res.status(201).json({
      accessToken: signAccess(user.id),
      refreshToken: signRefresh(user.id),
      user: { id: user.id, email: user.email, username: user.username },
    });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/login", async (req: Request, res: Response) => {
  const { email, password } = req.body;
  if (!email || !password) {
    res.status(400).json({ error: "email and password are required" });
    return;
  }
  try {
    const { rows } = await pool.query(`SELECT * FROM users WHERE email = $1`, [email]);
    if (rows.length === 0) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }
    const user = rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }
    res.json({
      accessToken: signAccess(user.id),
      refreshToken: signRefresh(user.id),
      user: { id: user.id, email: user.email, username: user.username },
    });
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/refresh", async (req: Request, res: Response) => {
  const { refreshToken } = req.body;
  if (!refreshToken) {
    res.status(400).json({ error: "refreshToken required" });
    return;
  }
  try {
    const payload = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET!) as { userId: number };
    res.json({ accessToken: signAccess(payload.userId) });
  } catch {
    res.status(401).json({ error: "Invalid or expired refresh token" });
  }
});

export default router;
