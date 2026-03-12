import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { pool } from "../config/database";

const JWT_SECRET = process.env.JWT_SECRET || "change-me";

export async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token) {
    return res.status(401).json({ error: "Token não fornecido" });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { sub: string };
    const { rows } = await pool.query(
      `SELECT p.id, p.user_id, p.role, p.company_id, p.full_name, u.email
       FROM profiles p JOIN users u ON u.id = p.user_id
       WHERE p.user_id = $1`,
      [decoded.sub]
    );

    if (!rows[0]) {
      return res.status(401).json({ error: "Usuário não encontrado" });
    }

    req.user = rows[0];
    next();
  } catch {
    return res.status(401).json({ error: "Token inválido ou expirado" });
  }
}
