import { Router, Request, Response } from "express";
import { z } from "zod";
import crypto from "crypto";
import { validate } from "../middleware/validate";
import { pool } from "../config/database";
import {
  authenticateUser,
  createUser,
  changePassword,
} from "../services/auth.service";
import rateLimit from "express-rate-limit";

const router = Router();

const loginLimiter = rateLimit({
  windowMs: 30 * 60 * 1000, // 30 min
  max: 10,
  message: { error: "Muitas tentativas de login. Tente novamente mais tarde." },
  standardHeaders: true,
  legacyHeaders: false,
});

// ============================================
// POST /api/auth/login
// ============================================
const loginSchema = z.object({
  email: z.string().trim().email().max(255),
  password: z.string().min(1).max(128),
});

router.post("/login", loginLimiter, validate(loginSchema), async (req: Request, res: Response) => {
  const { email, password } = req.body;

  try {
    // Check lockout
    const { rows: lockout } = await pool.query(
      `SELECT * FROM get_login_lockout_status($1)`,
      [email]
    );
    if (lockout[0]?.bloqueado) {
      await pool.query(`SELECT register_login_attempt($1, $2)`, [email, false]);
      return res.status(429).json({
        error: lockout[0].mensagem,
        lockout: {
          blocked: true,
          seconds_remaining: lockout[0].segundos_restantes,
        },
      });
    }

    const result = await authenticateUser(email, password);

    await pool.query(`SELECT register_login_attempt($1, $2)`, [email, true]);

    // Get profile data
    const { rows: profiles } = await pool.query(
      `SELECT role, company_id, full_name, password_changed FROM profiles WHERE user_id = $1`,
      [result.user.id]
    );

    // Audit
    await pool.query(
      `INSERT INTO audit_logs (user_id, action, resource_type, category, details, user_agent, ip_address)
       VALUES ($1, 'login_success', 'auth', 'auth', '{}', $2, $3)`,
      [result.user.id, req.headers["user-agent"] || "", req.ip || ""]
    );

    res.json({
      token: result.token,
      user: {
        id: result.user.id,
        email: result.user.email,
        ...profiles[0],
      },
    });
  } catch (err: any) {
    await pool.query(`SELECT register_login_attempt($1, $2)`, [email, false]);

    // Re-check lockout for updated message
    const { rows: lockout } = await pool.query(
      `SELECT * FROM get_login_lockout_status($1)`,
      [email]
    );

    await pool.query(
      `INSERT INTO audit_logs (action, resource_type, category, details, user_agent, ip_address)
       VALUES ('login_failed', 'auth', 'auth', $1, $2, $3)`,
      [JSON.stringify({ email }), req.headers["user-agent"] || "", req.ip || ""]
    );

    res.status(401).json({
      error: lockout[0]?.mensagem || "Credenciais inválidas",
      lockout: lockout[0]
        ? {
            blocked: lockout[0].bloqueado,
            attempts_remaining: lockout[0].tentativas_restantes,
            seconds_remaining: lockout[0].segundos_restantes,
            level: lockout[0].nivel,
          }
        : null,
    });
  }
});

// ============================================
// POST /api/auth/register
// ============================================
const registerSchema = z.object({
  email: z.string().trim().email().max(255),
  password: z.string().min(6).max(128),
  full_name: z.string().trim().min(1).max(100),
});

router.post("/register", validate(registerSchema), async (req: Request, res: Response) => {
  const { email, password, full_name } = req.body;

  try {
    const user = await createUser(email, password, full_name);
    res.status(201).json({ message: "Conta criada com sucesso", user_id: user.id });
  } catch (err: any) {
    if (err.code === "23505") {
      return res.status(409).json({ error: "Este e-mail já está cadastrado" });
    }
    res.status(500).json({ error: "Erro ao criar conta" });
  }
});

// ============================================
// GET /api/auth/me
// ============================================
router.get("/me", async (req: Request, res: Response) => {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token) return res.status(401).json({ error: "Token não fornecido" });

  try {
    const jwt = require("jsonwebtoken");
    const decoded = jwt.verify(token, process.env.JWT_SECRET) as { sub: string };

    const { rows } = await pool.query(
      `SELECT p.user_id, p.role, p.company_id, p.full_name, p.avatar_url,
              p.password_changed, u.email
       FROM profiles p JOIN users u ON u.id = p.user_id
       WHERE p.user_id = $1`,
      [decoded.sub]
    );

    if (!rows[0]) return res.status(404).json({ error: "Perfil não encontrado" });

    res.json({ user: { id: rows[0].user_id, ...rows[0] } });
  } catch {
    res.status(401).json({ error: "Token inválido" });
  }
});

// ============================================
// POST /api/auth/change-password
// ============================================
const changePasswordSchema = z.object({
  current_password: z.string().min(1),
  new_password: z.string().min(6).max(128),
});

router.post("/change-password", validate(changePasswordSchema), async (req: Request, res: Response) => {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token) return res.status(401).json({ error: "Token não fornecido" });

  try {
    const jwt = require("jsonwebtoken");
    const decoded = jwt.verify(token, process.env.JWT_SECRET) as { sub: string };
    await changePassword(decoded.sub, req.body.current_password, req.body.new_password);

    await pool.query(
      `INSERT INTO audit_logs (user_id, action, resource_type, category)
       VALUES ($1, 'password_change', 'auth', 'auth')`,
      [decoded.sub]
    );

    res.json({ message: "Senha alterada com sucesso" });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

export { router as authRouter };
