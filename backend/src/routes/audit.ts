import { Router, Request, Response } from "express";
import { pool } from "../config/database";
import { requireSuperAdmin } from "../middleware/permissions";

const router = Router();

// ============================================
// GET /api/audit
// ============================================
router.get("/", async (req: Request, res: Response) => {
  try {
    let query = `SELECT al.*, p.full_name as user_name
       FROM audit_logs al
       LEFT JOIN profiles p ON p.user_id = al.user_id
       WHERE 1=1`;
    const params: any[] = [];

    if (req.user!.role !== "superadmin") {
      query += ` AND al.company_id = $${params.length + 1}`;
      params.push(req.user!.company_id);
    } else if (req.query.company_id) {
      query += ` AND al.company_id = $${params.length + 1}`;
      params.push(req.query.company_id);
    }

    if (req.query.category) {
      query += ` AND al.category = $${params.length + 1}`;
      params.push(req.query.category);
    }

    if (req.query.action) {
      query += ` AND al.action = $${params.length + 1}`;
      params.push(req.query.action);
    }

    if (req.query.from) {
      query += ` AND al.created_at >= $${params.length + 1}`;
      params.push(req.query.from);
    }

    if (req.query.to) {
      query += ` AND al.created_at <= $${params.length + 1}`;
      params.push(req.query.to);
    }

    const limit = Math.min(parseInt(req.query.limit as string) || 100, 1000);
    const offset = parseInt(req.query.offset as string) || 0;

    query += ` ORDER BY al.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const { rows } = await pool.query(query, params);

    // Total count
    let countQuery = `SELECT count(*) as total FROM audit_logs al WHERE 1=1`;
    const countParams: any[] = [];

    if (req.user!.role !== "superadmin") {
      countQuery += ` AND al.company_id = $1`;
      countParams.push(req.user!.company_id);
    } else if (req.query.company_id) {
      countQuery += ` AND al.company_id = $1`;
      countParams.push(req.query.company_id);
    }

    const { rows: countRows } = await pool.query(countQuery, countParams);

    res.json({ data: rows, total: parseInt(countRows[0].total), limit, offset });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// GET /api/audit/login-attempts (superadmin only)
// ============================================
router.get("/login-attempts", requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 100, 1000);
    const { rows } = await pool.query(
      `SELECT * FROM login_attempts ORDER BY created_at DESC LIMIT $1`,
      [limit]
    );
    res.json(rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export { router as auditRouter };
