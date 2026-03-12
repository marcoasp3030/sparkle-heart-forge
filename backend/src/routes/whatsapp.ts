import { Router, Request, Response } from "express";

const router = Router();

const UAZAPI_URL = process.env.UAZAPI_URL || "";
const UAZAPI_TOKEN = process.env.UAZAPI_TOKEN || "";

// ============================================
// POST /api/whatsapp/proxy
// ============================================
router.post("/proxy", async (req: Request, res: Response) => {
  if (!UAZAPI_URL || !UAZAPI_TOKEN) {
    return res.status(503).json({ error: "WhatsApp não configurado" });
  }

  try {
    const { endpoint, method, body } = req.body;

    const response = await fetch(`${UAZAPI_URL}${endpoint}`, {
      method: method || "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${UAZAPI_TOKEN}`,
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    const data = await response.json();
    res.status(response.status).json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// POST /api/whatsapp/send
// ============================================
router.post("/send", async (req: Request, res: Response) => {
  if (!UAZAPI_URL || !UAZAPI_TOKEN) {
    return res.status(503).json({ error: "WhatsApp não configurado" });
  }

  try {
    const { phone, message } = req.body;

    if (!phone || !message) {
      return res.status(400).json({ error: "Campos phone e message são obrigatórios" });
    }

    const response = await fetch(`${UAZAPI_URL}/sendMessage`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${UAZAPI_TOKEN}`,
      },
      body: JSON.stringify({
        phone: phone.replace(/\D/g, ""),
        message,
      }),
    });

    const data = await response.json();
    res.status(response.status).json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export { router as whatsappRouter };
