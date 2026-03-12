/**
 * Waitlist notification route - migrated from waitlist-notify Edge Function.
 * Notifies the first person in the waitlist when a door becomes available.
 */
import { Router, Request, Response } from "express";
import { pool } from "../config/database";
import axios from "axios";

const router = Router();

// POST /api/waitlist-notify
router.post("/", async (req: Request, res: Response) => {
  try {
    const { lockerId, companyId, doorLabel, doorNumber, lockerName } = req.body;

    if (!lockerId || !companyId) {
      return res.status(400).json({ error: "lockerId and companyId required" });
    }

    // Check if waitlist feature is enabled
    const { rows: permRows } = await pool.query(
      `SELECT enabled FROM company_permissions WHERE company_id = $1 AND permission = 'waitlist_enabled' LIMIT 1`,
      [companyId]
    );
    if (!permRows[0]?.enabled) {
      return res.json({ success: false, reason: "waitlist_disabled" });
    }

    // Get first person waiting
    const { rows: waitRows } = await pool.query(
      `SELECT lw.*, fc.nome, fc.telefone, fc.email 
       FROM locker_waitlist lw 
       JOIN funcionarios_clientes fc ON fc.id = lw.person_id
       WHERE lw.locker_id = $1 AND lw.status = 'waiting' 
       ORDER BY lw.created_at ASC LIMIT 1`,
      [lockerId]
    );
    const waitEntry = waitRows[0];

    if (!waitEntry) {
      return res.json({ success: false, reason: "no_one_waiting" });
    }

    // Mark as notified
    await pool.query(
      `UPDATE locker_waitlist SET status = 'notified', notified_at = NOW() WHERE id = $1`,
      [waitEntry.id]
    );

    const apiBaseUrl = `http://localhost:${process.env.PORT || 3001}/api`;

    // Send WhatsApp notification (internal call)
    if (waitEntry.telefone) {
      try {
        await axios.post(`${apiBaseUrl}/whatsapp-notify`, {
          type: "waitlist_available",
          companyId,
          personId: waitEntry.person_id,
          personName: waitEntry.nome,
          doorLabel, doorNumber, lockerName,
        }, {
          headers: { Authorization: req.headers.authorization || "" },
        });
      } catch (e) {
        console.log("WhatsApp waitlist notify failed:", e);
      }
    }

    // Send Email notification (internal call)
    if (waitEntry.email) {
      try {
        await axios.post(`${apiBaseUrl}/email-notify`, {
          type: "waitlist_available",
          companyId,
          personId: waitEntry.person_id,
          personName: waitEntry.nome,
          doorLabel, doorNumber, lockerName,
        }, {
          headers: { Authorization: req.headers.authorization || "" },
        });
      } catch (e) {
        console.log("Email waitlist notify failed:", e);
      }
    }

    res.json({
      success: true,
      notifiedPerson: { id: waitEntry.person_id, name: waitEntry.nome },
    });
  } catch (error: any) {
    console.error("waitlist-notify error:", error.message);
    res.status(500).json({ error: error.message });
  }
});

export { router as waitlistNotifyRouter };
