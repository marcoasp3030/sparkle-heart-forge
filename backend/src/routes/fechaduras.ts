import { Router, Request, Response } from "express";
import { z } from "zod";
import { validate } from "../middleware/validate";
import { pool } from "../config/database";

const router = Router();

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