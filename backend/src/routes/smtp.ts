/**
 * SMTP email routes - migrated from send-smtp-email and test-smtp Edge Functions.
 * Handles: sending emails via custom SMTP and testing SMTP connections.
 */
import { Router, Request, Response } from "express";
import { pool } from "../config/database";
import nodemailer from "nodemailer";
import net from "net";
import tls from "tls";

const router = Router();

async function getSmtpConfig(): Promise<Record<string, any> | null> {
  const { rows } = await pool.query(
    `SELECT value FROM platform_settings WHERE key = 'smtp_config' LIMIT 1`
  );
  return rows[0]?.value || null;
}

// POST /api/smtp/send - Send email via custom SMTP
router.post("/send", async (req: Request, res: Response) => {
  try {
    const { to, subject, html, useCustomSmtp } = req.body;

    if (!to || !html) {
      return res.status(400).json({ success: false, message: "Campos 'to' e 'html' são obrigatórios" });
    }

    const smtpConfig = await getSmtpConfig();

    if (!smtpConfig?.enabled && useCustomSmtp !== false) {
      return res.json({
        success: false,
        message: "SMTP personalizado não está ativado. Configure nas configurações de e-mail.",
        fallback: true,
      });
    }

    if (!smtpConfig?.host || !smtpConfig?.port) {
      return res.json({ success: false, message: "Configuração SMTP incompleta. Verifique host e porta." });
    }

    // Load email template
    const { rows: templateRows } = await pool.query(
      `SELECT value FROM platform_settings WHERE key = 'recovery_email_template' LIMIT 1`
    );
    const template = templateRows[0]?.value as Record<string, any> | null;

    const portNum = parseInt(smtpConfig.port, 10);
    const useTls = smtpConfig.encryption === "tls" || smtpConfig.encryption === "ssl";

    const transporter = nodemailer.createTransport({
      host: smtpConfig.host,
      port: portNum,
      secure: useTls && portNum === 465,
      auth: smtpConfig.user && smtpConfig.password
        ? { user: smtpConfig.user, pass: smtpConfig.password }
        : undefined,
      tls: useTls ? { rejectUnauthorized: false } : undefined,
    });

    const finalSubject = subject || template?.subject || "Recuperação de Senha";

    await transporter.sendMail({
      from: `${smtpConfig.from_name || "Sistema"} <${smtpConfig.from_email || smtpConfig.user}>`,
      to,
      subject: finalSubject,
      text: "Por favor, visualize este e-mail em um cliente que suporte HTML.",
      html,
    });

    res.json({ success: true, message: `E-mail enviado com sucesso para ${to}` });
  } catch (err: any) {
    res.status(500).json({ success: false, message: `Erro ao enviar e-mail: ${err.message}` });
  }
});

// POST /api/smtp/test - Test SMTP connection
router.post("/test", async (req: Request, res: Response) => {
  // Check admin role
  if (!["admin", "superadmin"].includes(req.user!.role)) {
    return res.status(403).json({ success: false, message: "Sem permissão" });
  }

  const { host, port, encryption } = req.body;

  if (!host || !port) {
    return res.status(400).json({ success: false, message: "Host e porta são obrigatórios" });
  }

  const portNum = parseInt(port, 10);
  const usesTls = encryption === "ssl" || (encryption === "tls" && portNum === 465);

  try {
    const details: string[] = [];

    await new Promise<void>((resolve, reject) => {
      const connectOptions = { host, port: portNum };
      
      const onConnect = (socket: net.Socket) => {
        let greeting = "";
        let ehloResponse = "";
        
        socket.once("data", (data) => {
          greeting = data.toString();
          if (greeting.startsWith("220")) details.push("Servidor respondeu corretamente");
          
          socket.write("EHLO test\r\n");
          socket.once("data", (ehloData) => {
            ehloResponse = ehloData.toString();
            if (ehloResponse.includes("250")) details.push("EHLO aceito");
            if (ehloResponse.includes("STARTTLS")) details.push("STARTTLS disponível");
            if (ehloResponse.includes("AUTH")) details.push("Autenticação suportada");
            
            socket.write("QUIT\r\n");
            socket.end();
            resolve();
          });
        });

        socket.on("error", reject);
        socket.setTimeout(10000, () => {
          socket.destroy();
          reject(new Error("Timeout de conexão"));
        });
      };

      if (usesTls) {
        const socket = tls.connect({ ...connectOptions, rejectUnauthorized: false }, () => onConnect(socket));
        socket.on("error", reject);
      } else {
        const socket = net.connect(connectOptions, () => onConnect(socket));
        socket.on("error", reject);
      }
    });

    res.json({
      success: true,
      message: "Conexão SMTP estabelecida com sucesso!",
      details,
    });
  } catch (connErr: any) {
    res.json({
      success: false,
      message: `Falha ao conectar: ${connErr.message}`,
      details: [`Host: ${host}`, `Porta: ${port}`, `Criptografia: ${encryption}`],
    });
  }
});

export { router as smtpRouter };
