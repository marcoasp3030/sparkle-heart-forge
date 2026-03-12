import { Router, Request, Response } from "express";
import { z } from "zod";
import { validate } from "../middleware/validate";
import { requireSuperAdmin } from "../middleware/permissions";
import { pool } from "../config/database";

const router = Router();

// ============================================
// GET /api/companies
// ============================================
router.get("/", async (req: Request, res: Response) => {
  try {
    if (req.user!.role === "superadmin") {
      const { rows } = await pool.query(
        `SELECT * FROM companies WHERE active = $1 ORDER BY name`,
        [req.query.active !== "false"]
      );
      return res.json(rows);
    }

    const { rows } = await pool.query(
      `SELECT * FROM companies WHERE id = $1 AND active = true`,
      [req.user!.company_id]
    );
    res.json(rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// GET /api/companies/:id
// ============================================
router.get("/:id", async (req: Request, res: Response) => {
  try {
    if (req.user!.role !== "superadmin" && req.params.id !== req.user!.company_id) {
      return res.status(403).json({ error: "Acesso restrito" });
    }

    const { rows } = await pool.query(`SELECT * FROM companies WHERE id = $1`, [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: "Empresa não encontrada" });
    res.json(rows[0]);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// POST /api/companies
// ============================================
const createSchema = z.object({
  name: z.string().trim().min(1).max(200),
  type: z.enum(["employee", "client"]).default("employee"),
  description: z.string().max(500).default(""),
  cnpj: z.string().max(20).default(""),
  email: z.string().email().max(255).optional().or(z.literal("")),
  phone: z.string().max(20).default(""),
  contact_name: z.string().max(100).default(""),
  address: z.string().max(300).default(""),
  city: z.string().max(100).default(""),
  state: z.string().max(2).default(""),
});

router.post("/", requireSuperAdmin, validate(createSchema), async (req: Request, res: Response) => {
  try {
    const { name, type, description, cnpj, email, phone, contact_name, address, city, state } = req.body;

    const { rows } = await pool.query(
      `INSERT INTO companies (name, type, description, cnpj, email, phone, contact_name, address, city, state)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
      [name, type, description, cnpj, email || "", phone, contact_name, address, city, state]
    );

    res.status(201).json(rows[0]);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// PUT /api/companies/:id
// ============================================
router.put("/:id", requireSuperAdmin, validate(createSchema.partial()), async (req: Request, res: Response) => {
  try {
    const fields = Object.entries(req.body);
    if (fields.length === 0) return res.status(400).json({ error: "Nenhum campo para atualizar" });

    const sets = fields.map(([key], i) => `${key} = $${i + 2}`).join(", ");
    const values = fields.map(([, val]) => val);

    const { rows } = await pool.query(
      `UPDATE companies SET ${sets}, updated_at = NOW() WHERE id = $1 RETURNING *`,
      [req.params.id, ...values]
    );

    if (!rows[0]) return res.status(404).json({ error: "Empresa não encontrada" });
    res.json(rows[0]);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// DELETE /api/companies/:id (soft delete)
// ============================================
router.delete("/:id", requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const { rows } = await pool.query(
      `UPDATE companies SET active = false, updated_at = NOW() WHERE id = $1 RETURNING id`,
      [req.params.id]
    );

    if (!rows[0]) return res.status(404).json({ error: "Empresa não encontrada" });
    res.json({ message: "Empresa desativada com sucesso" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export { router as companiesRouter };
