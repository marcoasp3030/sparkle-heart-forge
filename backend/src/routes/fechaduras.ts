import { Router, Request, Response } from "express";
import { z } from "zod";
import { validate } from "../middleware/validate";
import { pool } from "../config/database";
import { apiKeyMiddleware } from "../middleware/apikey";
import { authMiddleware } from "../middleware/auth";

const router = Router();

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_REGEX.test(value);
}

async function enqueueOpenCommand(lockId: number, origem: string, personId: string | null) {
  try {
    const { rows } = await pool.query(
      `INSERT INTO comandos_fechadura (acao, lock_id, status, origem, person_id)
       VALUES ('abrir', $1, 'pendente', $2, $3)
       RETURNING id`,
      [lockId, origem, personId]
    );
    return rows[0].id;
  } catch (err: any) {
    const message = String(err?.message || "");
    const missingPersonIdColumn =
      /column\s+"?person_id"?\s+of\s+relation\s+"?comandos_fechadura"?\s+does\s+not\s+exist/i.test(
        message
      );

    if (missingPersonIdColumn) {
      const { rows } = await pool.query(
        `INSERT INTO comandos_fechadura (acao, lock_id, status, origem)
         VALUES ('abrir', $1, 'pendente', $2)
         RETURNING id`,
        [lockId, origem]
      );
      return rows[0].id;
    }

    throw err;
  }
}

// ============================================
// POST /api/fechaduras/abrir-portal  (JWT auth — usado pelo portal do usuário)
// ============================================
const abrirPortalSchema = z.object({
  lock_id: z.number().int().positive(),
  origem: z.string().max(30).optional().default("portal"),
});

router.post("/abrir-portal", authMiddleware, validate(abrirPortalSchema), async (req: Request, res: Response) => {
  const { lock_id, origem } = req.body;

  try {
    const userId = req.user?.user_id;
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
    const commandId = await enqueueOpenCommand(lock_id, origem || "portal", personId);

    res.status(201).json({ success: true, message: "Comando enviado", id: commandId });
  } catch (err: any) {
    console.error("[FECHADURAS] Erro ao criar comando (portal):", err);
    res.status(500).json({ success: false, error: "Erro ao criar comando" });
  }
});

// ============================================
// POST /api/fechaduras/abrir-admin  (JWT auth — usado pelo painel admin)
// ============================================
const abrirAdminSchema = z.object({
  lock_id: z.number().int().positive(),
  origem: z.string().max(30).optional().default("painel"),
});

router.post("/abrir-admin", authMiddleware, validate(abrirAdminSchema), async (req: Request, res: Response) => {
  const { lock_id, origem } = req.body;

  try {
    const role = req.user?.role;
    if (!role || !["admin", "superadmin"].includes(role)) {
      return res.status(403).json({ success: false, error: "Acesso restrito a administradores." });
    }

    // Buscar ocupante atual da porta para persistir no log
    const { rows: doorRows } = await pool.query(
      `SELECT occupied_by_person
       FROM locker_doors
       WHERE lock_id = $1 AND occupied_by_person IS NOT NULL
       ORDER BY occupied_at DESC NULLS LAST, updated_at DESC
       LIMIT 1`,
      [lock_id]
    );

    const rawPersonId = doorRows[0]?.occupied_by_person ?? null;
    const personId = isUuid(rawPersonId) ? rawPersonId : null;

    if (rawPersonId && !personId) {
      console.warn(
        `[FECHADURAS] occupied_by_person inválido para lock_id=${lock_id}. Registrando comando sem person_id.`
      );
    }

    const commandId = await enqueueOpenCommand(lock_id, origem || "painel", personId);

    res.status(201).json({ success: true, message: "Comando enviado", id: commandId });
  } catch (err: any) {
    console.error("[FECHADURAS] Erro ao criar comando (admin):", err);
    res.status(500).json({ success: false, error: "Erro ao criar comando" });
  }
});

// ============================================
// GET /api/fechaduras/meu-historico  (JWT auth — histórico do usuário logado)
// ============================================
router.get("/meu-historico", authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.user_id;

    // Buscar lock_ids das portas ocupadas pelo usuário
    const { rows: doors } = await pool.query(
      `SELECT ld.lock_id FROM locker_doors ld
       JOIN funcionarios_clientes fc ON fc.id = ld.occupied_by_person
       WHERE fc.user_id = $1 AND ld.lock_id IS NOT NULL`,
      [userId]
    );

    if (doors.length === 0) {
      return res.json([]);
    }

    const lockIds = doors.map(d => d.lock_id);
    const placeholders = lockIds.map((_, i) => `$${i + 1}`).join(", ");

    const { rows } = await pool.query(
      `SELECT id, acao, lock_id, status, resposta, origem, criado_em, executado_em
       FROM comandos_fechadura
       WHERE lock_id IN (${placeholders})
       ORDER BY criado_em DESC
       LIMIT 100`,
      lockIds
    );

    res.json(rows);
  } catch (err: any) {
    console.error("[FECHADURAS] Erro ao buscar histórico do usuário:", err);
    res.status(500).json({ error: "Erro ao buscar histórico" });
  }
});

// ============================================
// GET /api/fechaduras/historico-admin  (JWT auth — todos os comandos para admin/superadmin)
// ============================================
router.get("/historico-admin", authMiddleware, async (req: Request, res: Response) => {
  try {
    const role = req.user?.role;
    if (!role || !["admin", "superadmin"].includes(role)) {
      return res.status(403).json({ error: "Acesso restrito a administradores." });
    }

    const companyId = req.query.company_id as string | undefined;

    let query = `
      SELECT 
        cf.id, cf.acao, cf.lock_id, cf.status, cf.resposta, cf.origem, cf.criado_em, cf.executado_em,
        ld.door_number, ld.label AS door_label,
        l.name AS locker_name, l.location AS locker_location, l.company_id,
        COALESCE(fc_cmd.nome, fc_door.nome) AS person_name,
        COALESCE(fc_cmd.tipo, fc_door.tipo) AS person_type,
        COALESCE(fc_cmd.matricula, fc_door.matricula) AS person_matricula
      FROM comandos_fechadura cf
      LEFT JOIN locker_doors ld ON ld.lock_id = cf.lock_id
      LEFT JOIN lockers l ON l.id = ld.locker_id
      LEFT JOIN funcionarios_clientes fc_cmd ON fc_cmd.id = cf.person_id
      LEFT JOIN funcionarios_clientes fc_door ON fc_door.id = ld.occupied_by_person
    `;
    const params: any[] = [];

    if (companyId && role !== "superadmin") {
      params.push(companyId);
      query += ` WHERE l.company_id = $${params.length}`;
    } else if (companyId) {
      params.push(companyId);
      query += ` WHERE l.company_id = $${params.length}`;
    }

    query += ` ORDER BY cf.criado_em DESC LIMIT 1000`;

    const { rows } = await pool.query(query, params);

    res.json(rows);
  } catch (err: any) {
    console.error("[FECHADURAS] Erro ao listar histórico (admin):", err);
    res.status(500).json({ error: "Erro ao listar histórico" });
  }
});

// ============================================
// GET /api/fechaduras/status/:id  (JWT auth — usado pelo portal para polling)
// ============================================
router.get("/status/:id", authMiddleware, async (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    return res.status(400).json({ error: "ID inválido" });
  }

  try {
    const { rows } = await pool.query(
      `SELECT id, acao, lock_id, status, resposta, origem, criado_em, executado_em
       FROM comandos_fechadura WHERE id = $1`,
      [id]
    );

    if (!rows[0]) {
      return res.status(404).json({ error: "Comando não encontrado" });
    }

    res.json(rows[0]);
  } catch (err: any) {
    console.error("[FECHADURAS] Erro ao consultar status:", err);
    res.status(500).json({ error: "Erro ao consultar status" });
  }
});

// Demais rotas de fechaduras passam pelo middleware de API Key (agente IoT)
router.use(apiKeyMiddleware);

// ============================================
// POST /api/fechaduras/abrir
// ============================================
const abrirSchema = z.object({
  lock_id: z.number().int().positive(),
  origem: z.string().max(30).optional().default("web"),
});

router.post("/abrir", validate(abrirSchema), async (req: Request, res: Response) => {
  const { lock_id, origem } = req.body;

  try {
    const { rows } = await pool.query(
      `INSERT INTO comandos_fechadura (acao, lock_id, status, origem)
       VALUES ('abrir', $1, 'pendente', $2)
       RETURNING id`,
      [lock_id, origem || "web"]
    );

    res.status(201).json({
      success: true,
      message: "Comando enviado",
      id: rows[0].id,
    });
  } catch (err: any) {
    console.error("[FECHADURAS] Erro ao criar comando:", err);
    res.status(500).json({ success: false, error: "Erro ao criar comando" });
  }
});

// ============================================
// GET /api/fechaduras/comandos
// Busca próximo pendente e marca como executando (atomic)
// ============================================
router.get("/comandos", async (_req: Request, res: Response) => {
  try {
    const { rows } = await pool.query(
      `UPDATE comandos_fechadura
       SET status = 'executando'
       WHERE id = (
         SELECT id FROM comandos_fechadura
         WHERE status = 'pendente'
         ORDER BY id ASC
         LIMIT 1
         FOR UPDATE SKIP LOCKED
       )
       RETURNING id, acao, lock_id`
    );

    if (!rows[0]) {
      return res.json({ status: "vazio" });
    }

    res.json(rows[0]);
  } catch (err: any) {
    console.error("[FECHADURAS] Erro ao buscar comando:", err);
    res.status(500).json({ error: "Erro ao buscar comando pendente" });
  }
});

// ============================================
// POST /api/fechaduras/concluir
// ============================================
const concluirSchema = z.object({
  id: z.number().int().positive(),
  status: z.enum(["executado", "erro"]),
  resposta: z.string().max(500).optional().default(""),
});

router.post("/concluir", validate(concluirSchema), async (req: Request, res: Response) => {
  const { id, status, resposta } = req.body;

  try {
    const { rowCount } = await pool.query(
      `UPDATE comandos_fechadura
       SET status = $1, resposta = $2, executado_em = NOW()
       WHERE id = $3 AND status = 'executando'`,
      [status, resposta || "", id]
    );

    if (rowCount === 0) {
      return res.status(404).json({ success: false, error: "Comando não encontrado ou já finalizado" });
    }

    res.json({ success: true, message: "Comando finalizado" });
  } catch (err: any) {
    console.error("[FECHADURAS] Erro ao concluir comando:", err);
    res.status(500).json({ success: false, error: "Erro ao finalizar comando" });
  }
});


// ============================================
// GET /api/fechaduras/historico
// ============================================
router.get("/historico", async (_req: Request, res: Response) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, acao, lock_id, status, resposta, origem, criado_em, executado_em
       FROM comandos_fechadura
       ORDER BY criado_em DESC
       LIMIT 50`
    );

    res.json(rows);
  } catch (err: any) {
    console.error("[FECHADURAS] Erro ao listar histórico:", err);
    res.status(500).json({ error: "Erro ao listar histórico" });
  }
});

export { router as fechadurasRouter };