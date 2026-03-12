import { Router, Request, Response } from "express";
import { pool } from "../config/database";

const router = Router();

// ============================================
// GET /api/health
// ============================================
router.get("/", async (_req: Request, res: Response) => {
  const start = Date.now();

  try {
    await pool.query("SELECT 1");
    const dbLatency = Date.now() - start;

    res.json({
      status: "healthy",
      timestamp: new Date().toISOString(),
      services: {
        database: { status: "up", latency_ms: dbLatency },
        api: { status: "up" },
      },
    });
  } catch (err: any) {
    res.status(503).json({
      status: "unhealthy",
      timestamp: new Date().toISOString(),
      services: {
        database: { status: "down", error: err.message },
        api: { status: "up" },
      },
    });
  }
});

export { router as healthRouter };
