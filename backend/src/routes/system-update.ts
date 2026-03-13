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

const ensureGitRepository = async () => {
  try {
    await execAsync("git rev-parse --is-inside-work-tree", { cwd: PROJECT_ROOT });
  } catch {
    throw new Error(
      `Repositório Git não encontrado em ${PROJECT_ROOT}. Configure PROJECT_ROOT para o diretório do projeto montado com a pasta .git.`
    );
  }
};

const resolveRemoteRef = async (): Promise<{ remoteRef: string; branch: string }> => {
  try {
    const { stdout } = await execAsync("git symbolic-ref --quiet refs/remotes/origin/HEAD", {
      cwd: PROJECT_ROOT,
    });
    const remoteRef = stdout.trim().replace("refs/remotes/", "");
    const branch = remoteRef.replace("origin/", "");
    return { remoteRef, branch };
  } catch {
    try {
      await execAsync("git rev-parse --verify origin/main", { cwd: PROJECT_ROOT });
      return { remoteRef: "origin/main", branch: "main" };
    } catch {
      return { remoteRef: "origin/master", branch: "master" };
    }
  }
};

const checkDockerAccess = async (): Promise<{ ok: boolean; details: string[] }> => {
  const details: string[] = [];
  
  // Check docker socket
  try {
    const { existsSync } = require("fs");
    if (!existsSync("/var/run/docker.sock")) {
      details.push("❌ /var/run/docker.sock não encontrado. Monte o socket no docker-compose.yml: /var/run/docker.sock:/var/run/docker.sock");
    } else {
      details.push("✅ Docker socket encontrado");
    }
  } catch { details.push("⚠️ Não foi possível verificar docker.sock"); }

  // Check docker CLI
  try {
    await execAsync("docker --version");
    details.push("✅ Docker CLI disponível");
  } catch {
    details.push("❌ Docker CLI não encontrado. Instale no Dockerfile: apk add docker-cli");
  }

  // Check docker compose
  try {
    await execAsync("docker compose version");
    details.push("✅ Docker Compose (plugin) disponível");
  } catch {
    try {
      await execAsync("docker-compose --version");
      details.push("✅ Docker Compose (standalone) disponível");
    } catch {
      details.push("❌ Docker Compose não encontrado. Instale: apk add docker-cli-compose");
    }
  }

  // Check compose file exists
  try {
    const composePath = path.resolve(COMPOSE_DIR, "docker-compose.yml");
    const { existsSync } = require("fs");
    if (existsSync(composePath)) {
      details.push(`✅ docker-compose.yml encontrado em ${COMPOSE_DIR}`);
    } else {
      details.push(`❌ docker-compose.yml NÃO encontrado em ${COMPOSE_DIR}. Verifique COMPOSE_DIR`);
    }
  } catch { /* ignore */ }

  // Check docker connectivity
  try {
    await execAsync("docker ps", { timeout: 10000 });
    details.push("✅ Conexão com Docker daemon OK");
  } catch (err: any) {
    details.push(`❌ Não foi possível conectar ao Docker daemon: ${err.message?.substring(0, 100)}`);
  }

  const ok = !details.some((d) => d.startsWith("❌"));
  return { ok, details };
};

const runComposeRebuild = async () => {
  // Pre-check docker access
  const dockerCheck = await checkDockerAccess();
  if (!dockerCheck.ok) {
    throw new Error(
      `Docker não está acessível no container backend.\n\nDiagnóstico:\n${dockerCheck.details.join("\n")}\n\nSoluções:\n1. Verifique se o volume docker.sock está montado: /var/run/docker.sock:/var/run/docker.sock\n2. Verifique se COMPOSE_DIR (${COMPOSE_DIR}) aponta para o diretório com docker-compose.yml\n3. Verifique as permissões do socket Docker`
    );
  }

  const commands = [
    "docker compose up -d --build --no-deps backend frontend 2>&1",
    "docker-compose up -d --build --no-deps backend frontend 2>&1",
  ];

  let lastError: any = null;

  for (const command of commands) {
    try {
      const { stdout, stderr } = await execAsync(command, {
        cwd: COMPOSE_DIR,
        timeout: 300000,
      });
      return `${stdout}${stderr ? `\n${stderr}` : ""}`.trim();
    } catch (err: any) {
      lastError = err;
    }
  }

  throw new Error(
    `Falha ao executar Docker Compose em ${COMPOSE_DIR}. Erro: ${lastError?.message || "desconhecido"}`
  );
};

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
      const { stdout: date } = await execAsync("git log -1 --format=%ci", { cwd: PROJECT_ROOT });
      commitDate = date.trim();
      const { stdout: msg } = await execAsync("git log -1 --format=%s", { cwd: PROJECT_ROOT });
      commitMessage = msg.trim();
    } catch {
      /* ignore if not a git repo */
    }

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
// Helper: parse CHANGELOG.md content
// ============================================
function parseChangelogContent(content: string) {
  const versions: Array<{ version: string; date: string; categories: Record<string, string[]> }> = [];
  let current: { version: string; date: string; categories: Record<string, string[]> } | null = null;
  let currentCategory = "";

  for (const line of content.split("\n")) {
    const versionMatch = line.match(/^## \[(.+?)\]\s*-?\s*([\d-]*)/);
    if (versionMatch) {
      if (current) versions.push(current);
      current = { version: versionMatch[1], date: versionMatch[2] || "", categories: {} };
      continue;
    }
    if (!current) continue;
    const catMatch = line.match(/^### (.+)/);
    if (catMatch) {
      currentCategory = catMatch[1].trim();
      if (!current.categories[currentCategory]) current.categories[currentCategory] = [];
      continue;
    }
    const itemMatch = line.match(/^- (.+)/);
    if (itemMatch && currentCategory) {
      current.categories[currentCategory].push(itemMatch[1].trim());
    }
  }
  if (current) versions.push(current);
  return versions;
}

// ============================================
// GET /api/system/check-update - Verifica atualizações
// ============================================
router.get("/check-update", requireSuperAdmin, async (_req: Request, res: Response) => {
  try {
    await ensureGitRepository();

    await execAsync("git fetch origin", { cwd: PROJECT_ROOT });

    const { remoteRef } = await resolveRemoteRef();

    const { stdout: localHash } = await execAsync("git rev-parse HEAD", { cwd: PROJECT_ROOT });
    const { stdout: remoteHash } = await execAsync(`git rev-parse ${remoteRef}`, { cwd: PROJECT_ROOT });

    const hasUpdate = localHash.trim() !== remoteHash.trim();

    let changelog: Array<{ hash: string; date: string; message: string; author: string }> = [];
    let releaseNotes: Array<{ version: string; date: string; categories: Record<string, string[]> }> = [];
    let remoteVersion = "";

    if (hasUpdate) {
      // Raw git commits (kept for technical details)
      const { stdout: log } = await execAsync(
        `git log HEAD..${remoteRef} --format=\"%h|%ci|%s|%an\" --no-merges`,
        { cwd: PROJECT_ROOT }
      );
      changelog = log
        .trim()
        .split("\n")
        .filter(Boolean)
        .map((line) => {
          const [hash, date, message, author] = line.split("|");
          return { hash, date, message, author };
        });

      // Remote package.json version
      try {
        const { stdout: remotePkg } = await execAsync(`git show ${remoteRef}:package.json`, { cwd: PROJECT_ROOT });
        remoteVersion = JSON.parse(remotePkg).version || "";
      } catch { /* ignore */ }

      // Parse remote CHANGELOG.md for user-friendly release notes
      try {
        const { stdout: remoteChangelog } = await execAsync(`git show ${remoteRef}:CHANGELOG.md`, { cwd: PROJECT_ROOT });
        const allVersions = parseChangelogContent(remoteChangelog);

        // Get current local version
        const pkgPath = path.resolve(PROJECT_ROOT, "package.json");
        let currentVersion = "0.0.0";
        if (existsSync(pkgPath)) {
          currentVersion = JSON.parse(readFileSync(pkgPath, "utf-8")).version || "0.0.0";
        }

        // Filter only versions newer than current
        releaseNotes = allVersions.filter((v) => v.version > currentVersion);

        // If no version filtering works, show all that differ
        if (releaseNotes.length === 0 && allVersions.length > 0) {
          releaseNotes = allVersions.slice(0, 3);
        }
      } catch { /* CHANGELOG.md may not exist in remote */ }
    }

    res.json({
      hasUpdate,
      currentCommit: localHash.trim().substring(0, 7),
      remoteCommit: remoteHash.trim().substring(0, 7),
      remoteVersion,
      changelog,
      releaseNotes,
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
    await ensureGitRepository();
    await execAsync("git fetch origin", { cwd: PROJECT_ROOT });
    const { branch } = await resolveRemoteRef();

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
    const { stdout: pullOutputStdout, stderr: pullOutputStderr } = await execAsync(
      `git pull --ff-only origin ${branch}`,
      { cwd: PROJECT_ROOT }
    );
    const pullOutput = `${pullOutputStdout}${pullOutputStderr ? `\n${pullOutputStderr}` : ""}`.trim();

    // 2. Rebuild containers com Docker Compose
    let buildOutput = "";
    try {
      buildOutput = await runComposeRebuild();
    } catch (buildErr: any) {
      // ROLLBACK: reverte ao commit anterior
      console.error("Build falhou, iniciando rollback...", buildErr.message);
      await execAsync(`git reset --hard ${rollbackCommit}`, { cwd: PROJECT_ROOT });
      await runComposeRebuild();

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
      [
        userId,
        JSON.stringify({
          from_commit: rollbackCommit.substring(0, 7),
          to_commit: newCommit.trim(),
          new_version: newVersion,
        }),
      ]
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
