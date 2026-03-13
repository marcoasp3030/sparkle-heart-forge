import { Router, Request, Response } from "express";
import { exec } from "child_process";
import { promisify } from "util";
import { readFileSync, existsSync } from "fs";
import path from "path";

const execAsync = promisify(exec);
const router = Router();

const PROJECT_ROOT = process.env.PROJECT_ROOT || "/app";

interface ChangelogVersion {
  version: string;
  date: string;
  categories: Record<string, string[]>;
}

/**
 * Parse CHANGELOG.md into structured data
 */
function parseChangelog(content: string): ChangelogVersion[] {
  const versions: ChangelogVersion[] = [];
  let current: ChangelogVersion | null = null;
  let currentCategory = "";

  for (const line of content.split("\n")) {
    // Match version header: ## [1.0.0] - 2025-01-15
    const versionMatch = line.match(/^## \[(.+?)\]\s*-?\s*([\d-]*)/);
    if (versionMatch) {
      if (current) versions.push(current);
      current = {
        version: versionMatch[1],
        date: versionMatch[2] || "",
        categories: {},
      };
      continue;
    }

    if (!current) continue;

    // Match category: ### Adicionado
    const catMatch = line.match(/^### (.+)/);
    if (catMatch) {
      currentCategory = catMatch[1].trim();
      if (!current.categories[currentCategory]) {
        current.categories[currentCategory] = [];
      }
      continue;
    }

    // Match item: - Something
    const itemMatch = line.match(/^- (.+)/);
    if (itemMatch && currentCategory) {
      current.categories[currentCategory].push(itemMatch[1].trim());
    }
  }

  if (current) versions.push(current);
  return versions;
}

/**
 * Get recent git commits as fallback changelog
 */
async function getGitCommits(limit = 50): Promise<Array<{ hash: string; date: string; message: string; author: string }>> {
  try {
    const { stdout } = await execAsync(
      `git log --format="%h|%ci|%s|%an" --no-merges -${limit}`,
      { cwd: PROJECT_ROOT }
    );
    return stdout
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        const [hash, date, message, author] = line.split("|");
        return { hash, date, message, author };
      });
  } catch {
    return [];
  }
}

// ============================================
// GET /api/changelog - Public changelog (no auth required)
// ============================================
router.get("/", async (_req: Request, res: Response) => {
  try {
    const changelogPath = path.resolve(PROJECT_ROOT, "CHANGELOG.md");
    let versions: ChangelogVersion[] = [];
    let raw = "";

    if (existsSync(changelogPath)) {
      raw = readFileSync(changelogPath, "utf-8");
      versions = parseChangelog(raw);
    }

    // Git commits as supplementary data
    const commits = await getGitCommits();

    // Current version from package.json
    let currentVersion = "0.0.0";
    const pkgPath = path.resolve(PROJECT_ROOT, "package.json");
    if (existsSync(pkgPath)) {
      currentVersion = JSON.parse(readFileSync(pkgPath, "utf-8")).version || "0.0.0";
    }

    res.json({
      currentVersion,
      versions,
      commits,
      hasChangelogFile: versions.length > 0,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export { router as changelogRouter };
