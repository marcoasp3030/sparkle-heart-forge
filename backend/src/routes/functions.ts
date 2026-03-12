/**
 * Functions route - proxies calls that previously went to Edge Functions.
 * Now delegates to dedicated route handlers.
 */
import { Router, Request, Response } from "express";
import { pool } from "../config/database";
import bcrypt from "bcryptjs";
import axios from "axios";

const router = Router();

// POST /api/functions/create-company-user
router.post("/create-company-user", async (req: Request, res: Response) => {
  if (req.user!.role !== "superadmin") {
    return res.status(403).json({ error: "Acesso restrito ao superadministrador" });
  }

  const { email, password, full_name, company_id, role } = req.body;
  if (!email || !password || !company_id) {
    return res.status(400).json({ error: "E-mail, senha e empresa são obrigatórios" });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const passwordHash = await bcrypt.hash(password, 12);
    const { rows } = await client.query(
      `INSERT INTO users (email, password_hash, email_confirmed, raw_user_meta_data)
       VALUES ($1, $2, true, $3) RETURNING id, email`,
      [email.toLowerCase().trim(), passwordHash, JSON.stringify({ full_name: full_name || "" })]
    );

    const newUser = rows[0];
    const userRole = ["admin", "user"].includes(role) ? role : "admin";

    await client.query(
      `INSERT INTO profiles (user_id, full_name, company_id, role, password_changed)
       VALUES ($1, $2, $3, $4, false)`,
      [newUser.id, full_name || "", company_id, userRole]
    );

    await client.query("COMMIT");
    res.json({ success: true, user_id: newUser.id, message: `Usuário ${email} criado com sucesso` });
  } catch (err: any) {
    await client.query("ROLLBACK");
    res.status(400).json({ error: err.message });
  } finally {
    client.release();
  }
});

// POST /api/functions/create-person-login
router.post("/create-person-login", async (req: Request, res: Response) => {
  const { person_id, email, password, send_whatsapp, send_email } = req.body;
  if (!person_id || !email || !password) {
    return res.status(400).json({ error: "Dados obrigatórios ausentes" });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const passwordHash = await bcrypt.hash(password, 12);
    const { rows } = await client.query(
      `INSERT INTO users (email, password_hash, email_confirmed)
       VALUES ($1, $2, true) RETURNING id`,
      [email.toLowerCase().trim(), passwordHash]
    );

    const userId = rows[0].id;

    // Get person's company
    const { rows: personRows } = await client.query(
      `SELECT company_id FROM funcionarios_clientes WHERE id = $1`,
      [person_id]
    );

    await client.query(
      `INSERT INTO profiles (user_id, company_id, role) VALUES ($1, $2, 'user')`,
      [userId, personRows[0]?.company_id]
    );

    await client.query(
      `UPDATE funcionarios_clientes SET user_id = $1 WHERE id = $2`,
      [userId, person_id]
    );

    await client.query("COMMIT");

    const notifications: any[] = [];
    // TODO: implement actual WhatsApp/email notifications
    if (send_whatsapp) notifications.push({ channel: "whatsapp", success: false, reason: "not_configured" });
    if (send_email) notifications.push({ channel: "email", success: false, reason: "not_configured" });

    res.json({ message: `Acesso criado para ${email}`, notifications });
  } catch (err: any) {
    await client.query("ROLLBACK");
    res.status(400).json({ error: err.message });
  } finally {
    client.release();
  }
});

// Proxy to dedicated routes for migrated Edge Functions
router.post("/:functionName", async (req: Request, res: Response) => {
  const { functionName } = req.params;
  const apiBase = `http://localhost:${process.env.PORT || 3001}/api`;
  
  const routeMap: Record<string, string> = {
    "send-smtp-email": "/smtp/send",
    "test-smtp": "/smtp/test",
    "email-locker-notify": "/email-notify",
    "whatsapp-locker-notify": "/whatsapp-notify",
    "uazapi-proxy": "/uazapi-proxy",
    "waitlist-notify": "/waitlist-notify",
  };

  const targetPath = routeMap[functionName];
  if (targetPath) {
    try {
      const { data } = await axios.post(`${apiBase}${targetPath}`, req.body, {
        headers: { Authorization: req.headers.authorization || "" },
      });
      return res.json(data);
    } catch (err: any) {
      const status = err.response?.status || 500;
      return res.status(status).json(err.response?.data || { error: err.message });
    }
  }

  res.status(404).json({ error: `Function ${functionName} not implemented` });
});

export { router as functionsRouter };
