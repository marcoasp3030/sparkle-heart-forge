import { Request, Response, NextFunction } from "express";
import { pool } from "../config/database";

/**
 * Middleware de autenticação por API Key para endpoints IoT (fechaduras).
 *
 * Aceita o token via:
 *   - Header: X-API-Key: <token>
 *   - Query param: ?api_key=<token>
 *
 * IMPORTANTE: NÃO usa Authorization: Bearer para evitar conflito com JWT (authMiddleware).
 * O token é validado contra a tabela platform_settings (key = 'fechaduras_api_key').
 * Se nenhuma chave estiver configurada no banco, o acesso é LIBERADO (fase inicial).
 */
export async function apiKeyMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  // Se já autenticado via JWT (authMiddleware), pular validação de API Key
  if (req.user) {
    console.log(`[API-KEY] Skipping — req.user já definido (${req.user.email}, role=${req.user.role})`);
    return next();
  }

  try {
    // Buscar a API key configurada
    const { rows } = await pool.query(
      `SELECT value FROM platform_settings WHERE key = 'fechaduras_api_key' LIMIT 1`
    );

    const storedRaw = rows[0]?.value;

    // Se não há chave configurada, libera acesso (modo aberto / fase inicial)
    if (!storedRaw) {
      console.log("[API-KEY] Nenhuma chave configurada — acesso liberado (fase inicial)");
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
      console.log("[API-KEY] Chave vazia no banco — acesso liberado");
      return next(); // Chave vazia → acesso liberado
    }

    // Extrair token APENAS de X-API-Key header ou query param (NÃO de Authorization: Bearer)
    const tokenFromHeader = req.headers["x-api-key"] as string | undefined;
    const tokenFromQuery = req.query.api_key as string | undefined;

    const token = tokenFromHeader || tokenFromQuery;

    console.log(`[API-KEY] Rota: ${req.method} ${req.path} | X-API-Key presente: ${!!tokenFromHeader} | query api_key: ${!!tokenFromQuery} | Authorization header presente: ${!!req.headers.authorization}`);

    if (!token) {
      // Se tem Authorization: Bearer, provavelmente é uma requisição JWT que deveria
      // ter passado pelo authMiddleware primeiro — dar mensagem mais clara
      if (req.headers.authorization?.startsWith("Bearer ")) {
        console.warn(`[API-KEY] Requisição com JWT mas sem req.user — possível problema de ordenação de middleware. Rota: ${req.method} ${req.path}`);
        return res.status(401).json({
          success: false,
          error: "Autenticação inválida para esta rota. Use X-API-Key para endpoints IoT ou verifique seu token JWT.",
        });
      }

      return res.status(401).json({
        success: false,
        error: "API Key não fornecida. Envie via header X-API-Key ou query param api_key.",
      });
    }

    // Comparação
    if (token !== storedKey) {
      console.warn(`[API-KEY] Token inválido para rota ${req.method} ${req.path} (tamanho recebido: ${token.length}, tamanho esperado: ${storedKey.length})`);
      return res.status(403).json({
        success: false,
        error: "API Key inválida.",
      });
    }

    console.log(`[API-KEY] Autenticado com sucesso via API Key para ${req.method} ${req.path}`);
    next();
  } catch (err: any) {
    console.error("[API-KEY] Erro ao validar API Key:", err);
    return res.status(500).json({
      success: false,
      error: "Erro interno ao validar autenticação.",
    });
  }
}
