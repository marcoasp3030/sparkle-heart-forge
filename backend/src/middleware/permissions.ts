import { Request, Response, NextFunction } from "express";

export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: "Acesso não autorizado" });
    }
    next();
  };
}

export function requireSuperAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.user || req.user.role !== "superadmin") {
    return res.status(403).json({ error: "Acesso restrito ao superadministrador" });
  }
  next();
}

export function requireAdminOrAbove(req: Request, res: Response, next: NextFunction) {
  if (!req.user || !["admin", "superadmin"].includes(req.user.role)) {
    return res.status(403).json({ error: "Acesso restrito a administradores" });
  }
  next();
}

/**
 * Verifica se o usuário tem acesso à empresa especificada.
 * Superadmins têm acesso a todas as empresas.
 * Admins e users só acessam dados da sua empresa.
 */
export function companyScope(companyIdField: string = "company_id") {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ error: "Não autenticado" });
    if (req.user.role === "superadmin") return next();

    const companyId =
      req.params.companyId ||
      req.body[companyIdField] ||
      req.query[companyIdField];

    if (companyId && companyId !== req.user.company_id) {
      return res.status(403).json({ error: "Acesso restrito à sua empresa" });
    }

    next();
  };
}

/**
 * Injeta company_id nas queries para isolamento multi-tenant
 */
export function getCompanyFilter(user: Express.Request["user"]): {
  clause: string;
  params: string[];
} {
  if (!user) return { clause: "", params: [] };
  if (user.role === "superadmin") return { clause: "", params: [] };
  return { clause: "AND company_id = $", params: [user.company_id || ""] };
}
