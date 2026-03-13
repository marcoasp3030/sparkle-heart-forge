import { Router, Request, Response } from "express";
import { exec } from "child_process";
import { promisify } from "util";
import { readFileSync, existsSync } from "fs";
import path from "path";
import { requireSuperAdmin } from "../middleware/permissions";
import { pool } from "../config/database";

const execAsync = promisify(exec);
const router = Router();

// Diretório raiz do projeto (onde está o docker-compose.yml)
const PROJECT_ROOT = process.env.PROJECT_ROOT || "/app";
const COMPOSE_DIR = process.env.COMPOSE_DIR || path.resolve(PROJECT_ROOT, "..");

// ============================================
// GET /api/system/version - Versão atual
// ============================================
router.get("/version", async (_req: Request, res: Response) => {
  try {
    const pkgPath = path.resolve(PROJECT_ROOT, "package.json");
    let version = "0.0.0";
    if (existsSync(pkgPath)) {
      const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
      version = pkg.version || "0.0.0";
    }

    // Pega o commit atual
    let commitHash = "unknown";
    let commitDate = "";
    let commitMessage = "";
    try {
      const { stdout: hash } = await execAsync("git rev-parse --short HEAD", { cwd: PROJECT_ROOT });
      commitHash = hash.trim();
      const { stdout: date } = await execAsync('git log -1 --format=%ci', { cwd: PROJECT_ROOT });
      commitDate = date.trim();
      const { stdout: msg } = await execAsync('git log -1 --format=%s', { cwd: PROJECT_ROOT });
      commitMessage = msg.trim();
    } catch { /* ignore if not a git repo */ }

    res.json({
      version,
      commit: commitHash,
      commitDate,
      commitMessage,
      environment: process.env.NODE_ENV || "development",
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// GET /api/system/check-update - Verifica atualizações
// ============================================
router.get("/check-update", requireSuperAdmin, async (_req: Request, res: Response) => {
  try {
    // Fetch sem merge
    await execAsync("git fetch origin", { cwd: PROJECT_ROOT });

    // Compara local vs remoto
    const { stdout: localHash } = await execAsync("git rev-parse HEAD", { cwd: PROJECT_ROOT });
    const { stdout: remoteHash } = await execAsync("git rev-parse origin/main", { cwd: PROJECT_ROOT }).catch(() =>
      execAsync("git rev-parse origin/master", { cwd: PROJECT_ROOT })
    );

    const hasUpdate = localHash.trim() !== remoteHash.trim();

    let changelog: Array<{ hash: string; date: string; message: string; author: string }> = [];
    if (hasUpdate) {
      const { stdout: log } = await execAsync(
        'git log HEAD..origin/main --format="%h|%ci|%s|%an" --no-merges',
        { cwd: PROJECT_ROOT }
      ).catch(() =>
        execAsync(
          'git log HEAD..origin/master --format="%h|%ci|%s|%an" --no-merges',
          { cwd: PROJECT_ROOT }
        )
      );

      changelog = log
        .trim()
        .split("\n")
        .filter(Boolean)
        .map((line) => {
          const [hash, date, message, author] = line.split("|");
          return { hash, date, message, author };
        });
    }

    // Busca versão remota do package.json
    let remoteVersion = "";
    if (hasUpdate) {
      try {
        const branch = await execAsync("git rev-parse --abbrev-ref origin/HEAD", { cwd: PROJECT_ROOT })
          .then(r => r.stdout.trim().replace("origin/", ""))
          .catch(() => "main");
        const { stdout: remotePkg } = await execAsync(
          `git show origin/${branch}:package.json`,
          { cwd: PROJECT_ROOT }
        );
        remoteVersion = JSON.parse(remotePkg).version || "";
      } catch { /* ignore */ }
    }

    res.json({
      hasUpdate,
      currentCommit: localHash.trim().substring(0, 7),
      remoteCommit: remoteHash.trim().substring(0, 7),
      remoteVersion,
      changelog,
      checkedAt: new Date().toISOString(),
    });
  } catch (err: any) {
    res.status(500).json({ error: `Erro ao verificar atualizações: ${err.message}` });
  }
});

// ============================================
// POST /api/system/update - Executar atualização
// ============================================
router.post("/update", requireSuperAdmin, async (req: Request, res: Response) => {
  const userId = req.user!.user_id;

  try {
    // Salva commit atual para rollback
    const { stdout: currentCommit } = await execAsync("git rev-parse HEAD", { cwd: PROJECT_ROOT });
    const rollbackCommit = currentCommit.trim();

    // Log de início
    await pool.query(
      `INSERT INTO audit_logs (user_id, action, resource_type, category, details)
       VALUES ($1, 'system_update_started', 'system', 'admin', $2)`,
      [userId, JSON.stringify({ rollback_commit: rollbackCommit })]
    );

    // 1. Git pull
    const { stdout: pullOutput } = await execAsync("git pull origin", { cwd: PROJECT_ROOT });

    // 2. Rebuild containers com Docker Compose
    let buildOutput = "";
    try {
      const { stdout } = await execAsync(
        "docker-compose up -d --build --no-deps backend frontend 2>&1",
        { cwd: COMPOSE_DIR, timeout: 300000 } // 5 min timeout
      );
      buildOutput = stdout;
    } catch (buildErr: any) {
      // ROLLBACK: reverte ao commit anterior
      console.error("Build falhou, iniciando rollback...", buildErr.message);
      await execAsync(`git reset --hard ${rollbackCommit}`, { cwd: PROJECT_ROOT });
      await execAsync("docker-compose up -d --build --no-deps backend frontend 2>&1", {
        cwd: COMPOSE_DIR,
        timeout: 300000,
      });

      await pool.query(
        `INSERT INTO audit_logs (user_id, action, resource_type, category, details)
         VALUES ($1, 'system_update_rollback', 'system', 'admin', $2)`,
        [userId, JSON.stringify({ error: buildErr.message, rolled_back_to: rollbackCommit })]
      );

      return res.status(500).json({
        error: "Build falhou. Rollback automático executado.",
        details: buildErr.message,
        rolledBackTo: rollbackCommit.substring(0, 7),
      });
    }

    // Pega nova versão
    const pkgPath = path.resolve(PROJECT_ROOT, "package.json");
    let newVersion = "0.0.0";
    if (existsSync(pkgPath)) {
      // Limpa cache do require
      delete require.cache[require.resolve(pkgPath)];
      newVersion = JSON.parse(readFileSync(pkgPath, "utf-8")).version || "0.0.0";
    }

    const { stdout: newCommit } = await execAsync("git rev-parse --short HEAD", { cwd: PROJECT_ROOT });

    // Log de sucesso
    await pool.query(
      `INSERT INTO audit_logs (user_id, action, resource_type, category, details)
       VALUES ($1, 'system_update_completed', 'system', 'admin', $2)`,
      [userId, JSON.stringify({
        from_commit: rollbackCommit.substring(0, 7),
        to_commit: newCommit.trim(),
        new_version: newVersion,
      })]
    );

    res.json({
      success: true,
      message: "Sistema atualizado com sucesso! Os containers estão sendo reiniciados.",
      version: newVersion,
      commit: newCommit.trim(),
      pullOutput: pullOutput.substring(0, 500),
      buildOutput: buildOutput.substring(0, 500),
    });
  } catch (err: any) {
    await pool.query(
      `INSERT INTO audit_logs (user_id, action, resource_type, category, details)
       VALUES ($1, 'system_update_failed', 'system', 'admin', $2)`,
      [userId, JSON.stringify({ error: err.message })]
    );
    res.status(500).json({ error: `Erro na atualização: ${err.message}` });
  }
});

// ============================================
// GET /api/system/update-history - Histórico de atualizações
// ============================================
router.get("/update-history", requireSuperAdmin, async (_req: Request, res: Response) => {
  try {
    const { rows } = await pool.query(
      `SELECT a.*, p.full_name as updated_by_name
       FROM audit_logs a
       LEFT JOIN profiles p ON p.user_id = a.user_id
       WHERE a.action LIKE 'system_update%'
       ORDER BY a.created_at DESC
       LIMIT 20`
    );
    res.json(rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export { router as systemUpdateRouter };
