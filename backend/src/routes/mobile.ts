import { Router, Request, Response } from "express";
import { z } from "zod";
import { validate } from "../middleware/validate";
import { pool } from "../config/database";
import { authMiddleware } from "../middleware/auth";

const router = Router();

// ============================================
// GET /api/mobile/version — Versão da API (público, sem auth)
// ============================================
const API_VERSION = {
  api_version: "1.0.0",
  min_app_version: "1.0.0",
  force_update: false,
  changelog: "Versão inicial da API mobile",
  updated_at: "2026-04-03",
};

router.get("/version", async (_req: Request, res: Response) => {
  try {
    const { rows } = await pool.query(
      `SELECT value FROM platform_settings WHERE key = 'mobile_api_version' LIMIT 1`
    );

    const config = rows[0]?.value || API_VERSION;

    res.json({ success: true, data: config });
  } catch {
    res.json({ success: true, data: API_VERSION });
  }
});

// Todas as rotas abaixo exigem JWT
router.use(authMiddleware);

// ============================================
// GET /api/mobile/me — Perfil completo do usuário
// ============================================
router.get("/me", async (req: Request, res: Response) => {
  try {
    const userId = req.user?.user_id;

    const { rows: personRows } = await pool.query(
      `SELECT fc.id, fc.nome, fc.cargo, fc.tipo, fc.company_id, fc.email, fc.telefone,
              fc.matricula, fc.avatar_url, fc.notification_email, fc.notification_whatsapp,
              fc.notification_expiry, fc.notification_renewal,
              c.name AS company_name
       FROM funcionarios_clientes fc
       JOIN companies c ON c.id = fc.company_id
       WHERE fc.user_id = $1`,
      [userId]
    );

    if (!personRows[0]) {
      return res.status(404).json({ success: false, error: "Perfil não encontrado" });
    }

    const person = personRows[0];

    // Buscar configurações do app para esta empresa
    const { rows: appSettings } = await pool.query(
      `SELECT value FROM platform_settings WHERE key = $1 LIMIT 1`,
      [`app_features_${person.company_id}`]
    );

    const features = appSettings[0]?.value || {};

    res.json({
      success: true,
      data: {
        person,
        app_features: features,
      },
    });
  } catch (err: any) {
    console.error("[MOBILE] Erro ao buscar perfil:", err);
    res.status(500).json({ success: false, error: "Erro ao buscar perfil" });
  }
});

// ============================================
// GET /api/mobile/portas — Portas vinculadas ao usuário
// ============================================
router.get("/portas", async (req: Request, res: Response) => {
  try {
    const userId = req.user?.user_id;

    const { rows: personRows } = await pool.query(
      `SELECT id, company_id FROM funcionarios_clientes WHERE user_id = $1`,
      [userId]
    );

    if (!personRows[0]) {
      return res.json({ success: true, data: [] });
    }

    const personId = personRows[0].id;

    const { rows: doors } = await pool.query(
      `SELECT ld.id, ld.door_number, ld.label, ld.size, ld.status, ld.expires_at,
              ld.occupied_at, ld.usage_type, ld.lock_id,
              l.name AS locker_name, l.location AS locker_location
       FROM locker_doors ld
       JOIN lockers l ON l.id = ld.locker_id
       WHERE ld.occupied_by_person = $1`,
      [personId]
    );

    res.json({ success: true, data: doors });
  } catch (err: any) {
    console.error("[MOBILE] Erro ao buscar portas:", err);
    res.status(500).json({ success: false, error: "Erro ao buscar portas" });
  }
});

// ============================================
// POST /api/mobile/abrir — Abrir fechadura vinculada
// ============================================
const abrirSchema = z.object({
  lock_id: z.number().int().positive(),
});

router.post("/abrir", validate(abrirSchema), async (req: Request, res: Response) => {
  const { lock_id } = req.body;
  try {
    const userId = req.user?.user_id;

    // Validar que o usuário tem vínculo com esta fechadura
    const { rows: personRows } = await pool.query(
      `SELECT fc.id FROM funcionarios_clientes fc
       JOIN locker_doors ld ON ld.occupied_by_person = fc.id
       WHERE fc.user_id = $1 AND ld.lock_id = $2 AND ld.status = 'occupied'`,
      [userId, lock_id]
    );

    if (personRows.length === 0) {
      return res.status(403).json({ success: false, error: "Você não tem permissão para abrir esta fechadura." });
    }

    const personId = personRows[0].id;

    // Enfileirar comando
    const { rows } = await pool.query(
      `INSERT INTO comandos_fechadura (acao, lock_id, status, origem, person_id)
       VALUES ('abrir', $1, 'pendente', 'app', $2)
       RETURNING id`,
      [lock_id, personId]
    );

    console.log(`[MOBILE] Comando de abertura criado: cmd=#${rows[0].id} lock_id=${lock_id} person=${personId}`);

    res.status(201).json({ success: true, message: "Comando enviado", id: rows[0].id });
  } catch (err: any) {
    console.error("[MOBILE] Erro ao criar comando:", err);
    res.status(500).json({ success: false, error: "Erro ao criar comando" });
  }
});

// ============================================
// GET /api/mobile/comando/:id — Status de um comando
// ============================================
router.get("/comando/:id", async (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    return res.status(400).json({ success: false, error: "ID inválido" });
  }

  try {
    const { rows } = await pool.query(
      `SELECT id, acao, lock_id, status, resposta, origem, criado_em, executado_em
       FROM comandos_fechadura WHERE id = $1`,
      [id]
    );

    if (!rows[0]) {
      return res.status(404).json({ success: false, error: "Comando não encontrado" });
    }

    res.json({ success: true, data: rows[0] });
  } catch (err: any) {
    console.error("[MOBILE] Erro ao consultar comando:", err);
    res.status(500).json({ success: false, error: "Erro ao consultar comando" });
  }
});

// ============================================
// GET /api/mobile/historico — Histórico de comandos do usuário
// ============================================
router.get("/historico", async (req: Request, res: Response) => {
  try {
    const userId = req.user?.user_id;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
    const offset = parseInt(req.query.offset as string) || 0;

    const { rows: doors } = await pool.query(
      `SELECT ld.lock_id FROM locker_doors ld
       JOIN funcionarios_clientes fc ON fc.id = ld.occupied_by_person
       WHERE fc.user_id = $1 AND ld.lock_id IS NOT NULL`,
      [userId]
    );

    if (doors.length === 0) {
      return res.json({ success: true, data: [], total: 0 });
    }

    const lockIds = doors.map(d => d.lock_id);
    const placeholders = lockIds.map((_, i) => `$${i + 1}`).join(", ");

    const { rows } = await pool.query(
      `SELECT id, acao, lock_id, status, resposta, origem, criado_em, executado_em
       FROM comandos_fechadura
       WHERE lock_id IN (${placeholders})
       ORDER BY criado_em DESC
       LIMIT $${lockIds.length + 1} OFFSET $${lockIds.length + 2}`,
      [...lockIds, limit, offset]
    );

    const { rows: countRows } = await pool.query(
      `SELECT COUNT(*)::int AS total FROM comandos_fechadura WHERE lock_id IN (${placeholders})`,
      lockIds
    );

    res.json({ success: true, data: rows, total: countRows[0]?.total || 0 });
  } catch (err: any) {
    console.error("[MOBILE] Erro ao buscar histórico:", err);
    res.status(500).json({ success: false, error: "Erro ao buscar histórico" });
  }
});

// ============================================
// GET /api/mobile/notificacoes — Notificações do usuário
// ============================================
router.get("/notificacoes", async (req: Request, res: Response) => {
  try {
    const userId = req.user?.user_id;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
    const unreadOnly = req.query.unread === "true";

    let query = `SELECT id, title, message, type, read, created_at FROM notifications WHERE user_id = $1`;
    const params: any[] = [userId];

    if (unreadOnly) {
      query += ` AND read = false`;
    }

    query += ` ORDER BY created_at DESC LIMIT $${params.length + 1}`;
    params.push(limit);

    const { rows } = await pool.query(query, params);

    const { rows: countRows } = await pool.query(
      `SELECT COUNT(*)::int AS unread_count FROM notifications WHERE user_id = $1 AND read = false`,
      [userId]
    );

    res.json({ success: true, data: rows, unread_count: countRows[0]?.unread_count || 0 });
  } catch (err: any) {
    console.error("[MOBILE] Erro ao buscar notificações:", err);
    res.status(500).json({ success: false, error: "Erro ao buscar notificações" });
  }
});

// ============================================
// PUT /api/mobile/notificacoes/:id/lida — Marcar como lida
// ============================================
router.put("/notificacoes/:id/lida", async (req: Request, res: Response) => {
  try {
    const userId = req.user?.user_id;
    const { id } = req.params;

    const { rowCount } = await pool.query(
      `UPDATE notifications SET read = true WHERE id = $1 AND user_id = $2`,
      [id, userId]
    );

    if (rowCount === 0) {
      return res.status(404).json({ success: false, error: "Notificação não encontrada" });
    }

    res.json({ success: true });
  } catch (err: any) {
    console.error("[MOBILE] Erro ao marcar notificação:", err);
    res.status(500).json({ success: false, error: "Erro ao atualizar notificação" });
  }
});

// ============================================
// POST /api/mobile/renovacao — Solicitar renovação
// ============================================
const renovacaoSchema = z.object({
  door_id: z.string().uuid(),
  requested_hours: z.number().int().min(1).max(720),
});

router.post("/renovacao", validate(renovacaoSchema), async (req: Request, res: Response) => {
  const { door_id, requested_hours } = req.body;

  try {
    const userId = req.user?.user_id;

    const { rows: personRows } = await pool.query(
      `SELECT fc.id, fc.company_id FROM funcionarios_clientes fc
       JOIN locker_doors ld ON ld.occupied_by_person = fc.id
       WHERE fc.user_id = $1 AND ld.id = $2`,
      [userId, door_id]
    );

    if (personRows.length === 0) {
      return res.status(403).json({ success: false, error: "Porta não vinculada ao seu perfil." });
    }

    const { id: personId, company_id } = personRows[0];

    // Verificar se já existe solicitação pendente
    const { rows: existing } = await pool.query(
      `SELECT id FROM renewal_requests WHERE person_id = $1 AND door_id = $2 AND status = 'pending'`,
      [personId, door_id]
    );

    if (existing.length > 0) {
      return res.status(409).json({ success: false, error: "Já existe uma solicitação pendente para esta porta." });
    }

    const { rows } = await pool.query(
      `INSERT INTO renewal_requests (person_id, door_id, company_id, requested_hours)
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [personId, door_id, company_id, requested_hours]
    );

    res.status(201).json({ success: true, message: "Solicitação enviada", id: rows[0].id });
  } catch (err: any) {
    console.error("[MOBILE] Erro ao solicitar renovação:", err);
    res.status(500).json({ success: false, error: "Erro ao solicitar renovação" });
  }
});

// ============================================
// GET /api/mobile/renovacoes — Listar solicitações
// ============================================
router.get("/renovacoes", async (req: Request, res: Response) => {
  try {
    const userId = req.user?.user_id;

    const { rows } = await pool.query(
      `SELECT rr.id, rr.door_id, rr.status, rr.requested_hours, rr.admin_notes, rr.created_at,
              ld.door_number, ld.label AS door_label
       FROM renewal_requests rr
       JOIN funcionarios_clientes fc ON fc.id = rr.person_id
       LEFT JOIN locker_doors ld ON ld.id = rr.door_id
       WHERE fc.user_id = $1
       ORDER BY rr.created_at DESC
       LIMIT 50`,
      [userId]
    );

    res.json({ success: true, data: rows });
  } catch (err: any) {
    console.error("[MOBILE] Erro ao listar renovações:", err);
    res.status(500).json({ success: false, error: "Erro ao listar renovações" });
  }
});

// ============================================
// POST /api/mobile/liberar — Devolver/liberar porta
// ============================================
const liberarSchema = z.object({
  door_id: z.string().uuid(),
});

router.post("/liberar", validate(liberarSchema), async (req: Request, res: Response) => {
  const { door_id } = req.body;

  try {
    const userId = req.user?.user_id;

    const { rows: personRows } = await pool.query(
      `SELECT fc.id FROM funcionarios_clientes fc
       JOIN locker_doors ld ON ld.occupied_by_person = fc.id
       WHERE fc.user_id = $1 AND ld.id = $2 AND ld.usage_type = 'temporary'`,
      [userId, door_id]
    );

    if (personRows.length === 0) {
      return res.status(403).json({ success: false, error: "Porta não vinculada ou não é temporária." });
    }

    const personId = personRows[0].id;

    // Liberar porta
    await pool.query(
      `UPDATE locker_doors SET status = 'available', occupied_by = NULL, occupied_by_person = NULL,
       occupied_at = NULL, expires_at = NULL WHERE id = $1`,
      [door_id]
    );

    // Encerrar reserva ativa
    await pool.query(
      `UPDATE locker_reservations SET status = 'released', released_at = NOW()
       WHERE door_id = $1 AND person_id = $2 AND status = 'active'`,
      [door_id, personId]
    );

    console.log(`[MOBILE] Porta liberada: door=${door_id} person=${personId}`);

    res.json({ success: true, message: "Porta liberada com sucesso" });
  } catch (err: any) {
    console.error("[MOBILE] Erro ao liberar porta:", err);
    res.status(500).json({ success: false, error: "Erro ao liberar porta" });
  }
});

// ============================================
// PUT /api/mobile/perfil — Atualizar dados do perfil
// ============================================
const perfilSchema = z.object({
  telefone: z.string().max(20).optional(),
  notification_email: z.boolean().optional(),
  notification_whatsapp: z.boolean().optional(),
  notification_expiry: z.boolean().optional(),
  notification_renewal: z.boolean().optional(),
});

router.put("/perfil", validate(perfilSchema), async (req: Request, res: Response) => {
  try {
    const userId = req.user?.user_id;
    const updates = req.body;

    const setClauses: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined) {
        setClauses.push(`${key} = $${paramIndex}`);
        params.push(value);
        paramIndex++;
      }
    }

    if (setClauses.length === 0) {
      return res.status(400).json({ success: false, error: "Nenhum campo para atualizar" });
    }

    params.push(userId);
    await pool.query(
      `UPDATE funcionarios_clientes SET ${setClauses.join(", ")}, updated_at = NOW() WHERE user_id = $${paramIndex}`,
      params
    );

    res.json({ success: true, message: "Perfil atualizado" });
  } catch (err: any) {
    console.error("[MOBILE] Erro ao atualizar perfil:", err);
    res.status(500).json({ success: false, error: "Erro ao atualizar perfil" });
  }
});

// ============================================
// GET /api/mobile/config — Configurações gerais do app
// ============================================
router.get("/config", async (req: Request, res: Response) => {
  try {
    const userId = req.user?.user_id;

    const { rows: personRows } = await pool.query(
      `SELECT company_id FROM funcionarios_clientes WHERE user_id = $1 LIMIT 1`,
      [userId]
    );

    if (!personRows[0]) {
      return res.json({ success: true, data: {} });
    }

    const companyId = personRows[0].company_id;

    // Buscar features do app para esta empresa
    const { rows: settings } = await pool.query(
      `SELECT value FROM platform_settings WHERE key = $1 LIMIT 1`,
      [`app_features_${companyId}`]
    );

    // Buscar branding da empresa
    const { rows: branding } = await pool.query(
      `SELECT logo_url, platform_name, theme_colors FROM company_branding WHERE company_id = $1 LIMIT 1`,
      [companyId]
    );

    res.json({
      success: true,
      data: {
        features: settings[0]?.value || {},
        branding: branding[0] || {},
      },
    });
  } catch (err: any) {
    console.error("[MOBILE] Erro ao buscar configuração:", err);
    res.status(500).json({ success: false, error: "Erro ao buscar configuração" });
  }
});

export { router as mobileRouter };
