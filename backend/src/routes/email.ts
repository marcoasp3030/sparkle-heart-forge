import { Router, Request, Response } from "express";
import { pool } from "../config/database";
import { sendEmail, testSmtpConnection } from "../services/email.service";
import { requireAdminOrAbove } from "../middleware/permissions";

const router = Router();

// ============================================
// POST /api/email/send
// ============================================
router.post("/send", requireAdminOrAbove, async (req: Request, res: Response) => {
  try {
    const { to, subject, html } = req.body;

    if (!to || !subject || !html) {
      return res.status(400).json({ error: "Campos to, subject e html são obrigatórios" });
    }

    const success = await sendEmail({ to, subject, html });
    if (success) {
      res.json({ message: "E-mail enviado com sucesso" });
    } else {
      res.status(500).json({ error: "Falha ao enviar e-mail" });
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// POST /api/email/test
// ============================================
router.post("/test", requireAdminOrAbove, async (req: Request, res: Response) => {
  try {
    const result = await testSmtpConnection();
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export { router as emailRouter };
