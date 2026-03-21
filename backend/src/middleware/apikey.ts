import { Request, Response, NextFunction } from "express";
import { pool } from "../config/database";

/**
 * Middleware de autenticação por API Key para endpoints IoT (fechaduras).
 *
 * Aceita o token via:
 *   - Header: X-API-Key: <token>
 *   - Header: Authorization: Bearer <token>
 *   - Query param: ?api_key=<token>
 *
 * O token é validado contra a tabela platform_settings (key = 'fechaduras_api_key').
 * Se nenhuma chave estiver configurada no banco, o acesso é LIBERADO (fase inicial).
 */
export async function apiKeyMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    // Buscar a API key configurada
    const { rows } = await pool.query(
      `SELECT value FROM platform_settings WHERE key = 'fechaduras_api_key' LIMIT 1`
    );

    const storedRaw = rows[0]?.value;

    // Se não há chave configurada, libera acesso (modo aberto / fase inicial)
    if (!storedRaw) {
      return next();
    }

    // Extrair o valor string do JSON
    const storedKey =
      typeof storedRaw === "string"
        ? storedRaw
        : typeof storedRaw === "object" && storedRaw !== null
        ? (storedRaw as any).key || JSON.stringify(storedRaw)
        : String(storedRaw);

    if (!storedKey || storedKey === "{}" || storedKey === '""') {
      return next(); // Chave vazia → acesso liberado
    }

    // Extrair token do request
    const tokenFromHeader =
      req.headers["x-api-key"] as string | undefined;
    const tokenFromAuth =
      req.headers.authorization?.startsWith("Bearer ")
        ? req.headers.authorization.slice(7)
        : undefined;
    const tokenFromQuery = req.query.api_key as string | undefined;

    const token = tokenFromHeader || tokenFromAuth || tokenFromQuery;

    if (!token) {
      return res.status(401).json({
        success: false,
        error: "API Key não fornecida. Envie via header X-API-Key, Authorization Bearer ou query param api_key.",
      });
    }

    // Comparação segura (timing-safe seria ideal, mas para API keys simples é aceitável)
    if (token !== storedKey) {
      return res.status(403).json({
        success: false,
        error: "API Key inválida.",
      });
    }

    next();
  } catch (err: any) {
    console.error("[API-KEY] Erro ao validar API Key:", err);
    // Em caso de falha no banco, negar acesso por segurança
    return res.status(500).json({
      success: false,
      error: "Erro interno ao validar autenticação.",
    });
  }
}
