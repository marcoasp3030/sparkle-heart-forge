import { Router, Request, Response } from "express";
import { pool } from "../config/database";

const router = Router();

// ============================================
// GET /api/notifications
// ============================================
router.get("/", async (req: Request, res: Response) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50`,
      [req.user!.user_id]
    );
    res.json(rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// GET /api/notifications/unread-count
// ============================================
router.get("/unread-count", async (req: Request, res: Response) => {
  try {
    const { rows } = await pool.query(
      `SELECT count(*) as count FROM notifications WHERE user_id = $1 AND read = false`,
      [req.user!.user_id]
    );
    res.json({ count: parseInt(rows[0].count) });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// PUT /api/notifications/:id/read
// ============================================
router.put("/:id/read", async (req: Request, res: Response) => {
  try {
    await pool.query(
      `UPDATE notifications SET read = true WHERE id = $1 AND user_id = $2`,
      [req.params.id, req.user!.user_id]
    );
    res.json({ message: "Notificação marcada como lida" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// PUT /api/notifications/read-all
// ============================================
router.put("/read-all", async (req: Request, res: Response) => {
  try {
    await pool.query(
      `UPDATE notifications SET read = true WHERE user_id = $1 AND read = false`,
      [req.user!.user_id]
    );
    res.json({ message: "Todas notificações marcadas como lidas" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export { router as notificationsRouter };
