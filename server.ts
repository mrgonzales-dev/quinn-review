#!/usr/bin/env bun
/**
 * server.ts — Quinn review server.
 * Serves the PR review page and provides API endpoints for project management,
 * PR management, and review decisions.
 *
 * Usage: bun run server.ts [path-to-quinn-data.json]
 * Default: ./quinn-data.json
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { execSync, spawn } from "node:child_process";
import type { PRData, PRFile, DiffLine, QuinnData, Project, ReviewEntry } from "./src/types.ts";
import { renderPage } from "./src/render/render-page.ts";
import { computeDiff, computeAddedDiff, computeDeletedDiff } from "./src/diff.ts";

const dataPath = resolve(process.env.QUINN_DATA ?? process.argv[2] ?? "./quinn-data.json");
const PORT = parseInt(process.env.QUINN_PORT ?? "2400", 10);
const MAX_BODY_SIZE = 10 * 1024 * 1024; // 10 MB

const VALID_THEMES = ["blue", "green", "purple", "orange", "red", "teal"];

// ── Data layer ─────────────────────────────────────────────────

function slugify(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

function loadData(): QuinnData {
  if (!existsSync(dataPath)) {
    return { settings: { firstTimeSeen: false }, projects: [] };
  }
  try {
    const raw = readFileSync(dataPath, "utf-8");
    const parsed = JSON.parse(raw);

    // New format: { settings, projects }
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed) && Array.isArray(parsed.projects)) {
      return {
        settings: parsed.settings && typeof parsed.settings === "object"
          ? { firstTimeSeen: !!parsed.settings.firstTimeSeen }
          : { firstTimeSeen: false },
        projects: parsed.projects,
      };
    }

    return { settings: { firstTimeSeen: false }, projects: [] };
  } catch {
    return { settings: { firstTimeSeen: false }, projects: [] };
  }
}

function saveData(data: QuinnData): void {
  writeFileSync(dataPath, JSON.stringify(data, null, 2), "utf-8");
}

function findProject(data: QuinnData, id: string): Project | undefined {
  return data.projects.find(p => p.id === id);
}

// ── Validation ─────────────────────────────────────────────────

function readOldFile(projectPath: string | undefined, filePath: string): string {
  if (!projectPath) return "";
  const absPath = join(projectPath, filePath);
  if (!existsSync(absPath)) return "";
  try {
    return readFileSync(absPath, "utf-8");
  } catch {
    return "";
  }
}

export function validateFile(file: unknown, projectPath?: string): string | null {
  if (typeof file !== "object" || file === null) return "File must be an object";
  const f = file as Record<string, unknown>;
  if (typeof f.path !== "string" || !f.path) return "File path must be a non-empty string";
  if (f.status !== "added" && f.status !== "modified" && f.status !== "deleted") {
    return "File status must be 'added', 'modified', or 'deleted'";
  }
  if (typeof f.explanation !== "string" || !f.explanation) {
    return "File explanation must be a non-empty string";
  }

  const hasContent = typeof f.content === "string";
  const hasEdits = Array.isArray(f.edits);

  if (!hasContent && !hasEdits) {
    return "File must have a 'content' string or an 'edits' array";
  }
  if (hasContent && hasEdits) {
    return "File must have 'content' or 'edits', not both";
  }

  // Build the new content string
  let content: string;

  if (hasEdits) {
    // edits-based: read old content from disk, apply each search/replace
    if (f.status === "added") {
      return "Cannot use 'edits' with status 'added' — use 'content' instead";
    }
    if (f.status === "deleted") {
      return "Cannot use 'edits' with status 'deleted' — use 'content' instead";
    }

    const oldContent = readOldFile(projectPath, f.path);
    if (!oldContent) {
      return `Cannot apply edits to '${f.path}': file does not exist in project directory`;
    }

    content = oldContent;
    for (let i = 0; i < f.edits!.length; i++) {
      const edit = f.edits![i] as { search: unknown; replace: unknown };
      if (typeof edit.search !== "string" || typeof edit.replace !== "string") {
        return `Edit ${i}: 'search' and 'replace' must be strings`;
      }
      const occurrences = content.split(edit.search).length - 1;
      if (occurrences === 0) {
        return `Edit ${i}: search string not found in '${f.path}'`;
      }
      if (occurrences > 1) {
        return `Edit ${i}: search string found ${occurrences} times in '${f.path}' — must be unique`;
      }
      content = content.replace(edit.search, edit.replace);
    }

    // Store the computed content so the client can see it
    f.content = content;
  } else {
    content = f.content as string;
  }

  if (f.status === "added") {
    f.diff = computeAddedDiff(content);
  } else if (f.status === "deleted") {
    // For deleted files, read old content from disk
    const oldContent = readOldFile(projectPath, f.path);
    if (!oldContent) {
      return `Cannot delete '${f.path}': file does not exist in project directory`;
    }
    f.diff = computeDeletedDiff(oldContent);
  } else {
    // modified — read old content from disk
    const oldContent = readOldFile(projectPath, f.path);
    if (!oldContent) {
      // File doesn't exist on disk — treat as added
      f.status = "added";
      f.diff = computeAddedDiff(content);
    } else {
      f.diff = computeDiff(oldContent, content);
    }
  }

  if (f.diff.length === 0) {
    return "Computed diff is empty — content is identical to existing file";
  }

  const addedCount = (f.diff as DiffLine[]).filter(d => d.type === "added").length;
  const removedCount = (f.diff as DiffLine[]).filter(d => d.type === "removed").length;
  f.additions = addedCount;
  f.deletions = removedCount;
  return null;
}

export function validatePR(pr: unknown, projectPath?: string): string | null {
  if (typeof pr !== "object" || pr === null) return "PR must be an object";
  const p = pr as Record<string, unknown>;
  if (typeof p.title !== "string" || !p.title) return "PR title must be a non-empty string";
  if (typeof p.description !== "string" || !p.description) {
    return "PR description must be a non-empty string";
  }
  if (typeof p.branch !== "string" || !p.branch) return "PR branch must be a non-empty string";
  if (p.label !== undefined && typeof p.label !== "string") return "PR label must be a string";
  if (!Array.isArray(p.files) || p.files.length === 0) {
    return "PR files must be a non-empty array";
  }
  for (let i = 0; i < p.files.length; i++) {
    const err = validateFile(p.files[i], projectPath);
    if (err) return `File ${i} (${(p.files[i] as PRFile)?.path ?? "unknown"}): ${err}`;
  }
  const paths = p.files.map((f: unknown) => (f as PRFile).path);
  const seen = new Set<string>();
  for (const path of paths) {
    if (seen.has(path)) return `Duplicate file path: ${path}`;
    seen.add(path);
  }
  return null;
}

// ── Helpers ────────────────────────────────────────────────────

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function rekeyReviews(reviews: Record<string, ReviewEntry>, deletedIndex: number): Record<string, ReviewEntry> {
  const rekeyed: Record<string, ReviewEntry> = {};
  for (const [key, val] of Object.entries(reviews)) {
    const m = key.match(/^(\d+)-(\d+)$/);
    if (!m) continue;
    const prIdx = parseInt(m[1], 10);
    const fileIdx = parseInt(m[2], 10);
    if (prIdx === deletedIndex) continue;
    if (prIdx > deletedIndex) {
      rekeyed[`${prIdx - 1}-${fileIdx}`] = val;
    } else {
      rekeyed[key] = val;
    }
  }
  return rekeyed;
}

let serverInstance: ReturnType<typeof Bun.serve> | null = null;

export function stop(): void {
  if (serverInstance) {
    serverInstance.stop();
    serverInstance = null;
  }
}

export function main() {
  serverInstance = Bun.serve({
    port: PORT,
    async fetch(req) {
      const url = new URL(req.url);
      const path = url.pathname;

      // Serve the review page
      if (path === "/" || path === "/index.html") {
        const data = loadData();
        const mcpPath = resolve(import.meta.dir, "src/mcp-server.ts");
        const selectedProject = url.searchParams.get("project") ?? "";
        const html = renderPage(data, mcpPath, selectedProject);

        return new Response(html, {
          headers: { "Content-Type": "text/html; charset=utf-8" },
        });
      }

      // ── Health check ──────────────────────────────────────────

      if (path === "/api/health" && req.method === "GET") {
        const data = loadData();
        return json({ ok: true, projects: data.projects.length });
      }

      // ── Settings ──────────────────────────────────────────────

      if (path === "/api/settings" && req.method === "GET") {
        const data = loadData();
        return json(data.settings);
      }

      if (path === "/api/settings" && req.method === "POST") {
        try {
          const body = await req.json();
          if (typeof body.firstTimeSeen !== "boolean") {
            return json({ error: "firstTimeSeen must be a boolean" }, 400);
          }
          const data = loadData();
          data.settings = { firstTimeSeen: body.firstTimeSeen };
          saveData(data);
          return json({ ok: true });
        } catch {
          return json({ error: "Bad request body" }, 400);
        }
      }

      // ── Project CRUD ──────────────────────────────────────────

      if (path === "/api/projects" && req.method === "GET") {
        const data = loadData();
        return json(data.projects.map(p => ({
          id: p.id,
          name: p.name,
          theme: p.theme,
          prs: p.prs.length,
        })));
      }

      if (path === "/api/project" && req.method === "POST") {
        try {
          const body = await req.json();
          if (typeof body.name !== "string" || !body.name) {
            return json({ error: "Project name must be a non-empty string" }, 400);
          }
          const theme = body.theme ?? "blue";
          if (!VALID_THEMES.includes(theme)) {
            return json({ error: `Invalid theme. Must be one of: ${VALID_THEMES.join(", ")}` }, 400);
          }
          const projectPath = typeof body.path === "string" && body.path
            ? resolve(body.path)
            : undefined;
          const id = slugify(body.name);
          const data = loadData();
          if (findProject(data, id)) {
            return json({ error: `Project '${id}' already exists` }, 400);
          }
          const project: Project = { id, name: body.name, theme, path: projectPath, prs: [], reviews: {} };
          data.projects.push(project);
          saveData(data);
          return json({ ok: true, id, name: body.name, theme, path: projectPath });
        } catch {
          return json({ error: "Bad request body" }, 400);
        }
      }

      const projectGetMatch = path.match(/^\/api\/project\/([^/]+)$/);
      if (projectGetMatch && req.method === "GET") {
        const id = projectGetMatch[1];
        const data = loadData();
        const project = findProject(data, id);
        if (!project) return json({ error: "Project not found" }, 404);
        return json({
          id: project.id,
          name: project.name,
          theme: project.theme,
          prs: project.prs.length,
        });
      }

      if (projectGetMatch && req.method === "DELETE") {
        const id = projectGetMatch[1];
        const data = loadData();
        const idx = data.projects.findIndex(p => p.id === id);
        if (idx === -1) return json({ error: "Project not found" }, 404);
        data.projects.splice(idx, 1);
        saveData(data);
        return json({ ok: true });
      }

      // ── Project-scoped PR operations ──────────────────────────

      // POST /api/project/:id/pr — add a PR
      const prPostMatch = path.match(/^\/api\/project\/([^/]+)\/pr$/);
      if (prPostMatch && req.method === "POST") {
        const projectId = prPostMatch[1];
        const contentLength = parseInt(req.headers.get("content-length") ?? "0", 10);
        if (contentLength > MAX_BODY_SIZE) {
          return json({ error: "Request body too large (max 10 MB)" }, 413);
        }
        const data = loadData();
        const project = findProject(data, projectId);
        if (!project) return json({ error: "Project not found" }, 404);
        try {
          const body = await req.json();
          const err = validatePR(body, project.path);
          if (err) return json({ error: err }, 400);
          project.prs.push(body as PRData);
          saveData(data);
          return json({ ok: true, index: project.prs.length - 1, total: project.prs.length });
        } catch {
          return json({ error: "Bad request body" }, 400);
        }
      }

      // GET /api/project/:id/prs — list all PRs
      const prsGetMatch = path.match(/^\/api\/project\/([^/]+)\/prs$/);
      if (prsGetMatch && req.method === "GET") {
        const projectId = prsGetMatch[1];
        const data = loadData();
        const project = findProject(data, projectId);
        if (!project) return json({ error: "Project not found" }, 404);
        return json(project.prs);
      }

      // DELETE /api/project/:id/prs — clear all PRs and reviews
      if (prsGetMatch && req.method === "DELETE") {
        const projectId = prsGetMatch[1];
        const data = loadData();
        const project = findProject(data, projectId);
        if (!project) return json({ error: "Project not found" }, 404);
        project.prs = [];
        project.reviews = {};
        saveData(data);
        return json({ ok: true });
      }

      // POST /api/project/:id/prs/batch — add multiple PRs
      const batchMatch = path.match(/^\/api\/project\/([^/]+)\/prs\/batch$/);
      if (batchMatch && req.method === "POST") {
        const projectId = batchMatch[1];
        const contentLength = parseInt(req.headers.get("content-length") ?? "0", 10);
        if (contentLength > MAX_BODY_SIZE) {
          return json({ error: "Request body too large (max 10 MB)" }, 413);
        }
        const data = loadData();
        const project = findProject(data, projectId);
        if (!project) return json({ error: "Project not found" }, 404);
        try {
          const body = await req.json();
          if (!Array.isArray(body) || body.length === 0) {
            return json({ error: "Batch must be a non-empty array of PRs" }, 400);
          }
          if (body.length > 5) {
            return json({ error: "Batch must contain at most 5 PRs" }, 400);
          }
          const errors: string[] = [];
          for (let i = 0; i < body.length; i++) {
            const err = validatePR(body[i], project.path);
            if (err) errors.push(`PR ${i}: ${err}`);
          }
          if (errors.length > 0) {
            return json({ error: "Validation failed", details: errors }, 400);
          }
          const startIndex = project.prs.length;
          for (const pr of body) {
            project.prs.push(pr as PRData);
          }
          saveData(data);
          return json({ ok: true, startIndex, count: body.length, total: project.prs.length });
        } catch {
          return json({ error: "Bad request body" }, 400);
        }
      }

      // GET /api/project/:id/pr/:index — get single PR
      const prIdxMatch = path.match(/^\/api\/project\/([^/]+)\/pr\/(\d+)$/);
      if (prIdxMatch && req.method === "GET") {
        const projectId = prIdxMatch[1];
        const index = parseInt(prIdxMatch[2], 10);
        const data = loadData();
        const project = findProject(data, projectId);
        if (!project) return json({ error: "Project not found" }, 404);
        if (index < 0 || index >= project.prs.length) {
          return json({ error: "PR index out of range" }, 400);
        }
        return json(project.prs[index]);
      }

      // DELETE /api/project/:id/pr/:index — remove PR, rekey reviews
      if (prIdxMatch && req.method === "DELETE") {
        const projectId = prIdxMatch[1];
        const index = parseInt(prIdxMatch[2], 10);
        const data = loadData();
        const project = findProject(data, projectId);
        if (!project) return json({ error: "Project not found" }, 404);
        if (index < 0 || index >= project.prs.length) {
          return json({ error: "PR index out of range" }, 400);
        }
        project.prs.splice(index, 1);
        project.reviews = rekeyReviews(project.reviews, index);
        saveData(data);
        return json({ ok: true, total: project.prs.length });
      }

      // PUT /api/project/:id/pr/:index — replace PR, clear reviews, reset completed
      if (prIdxMatch && req.method === "PUT") {
        const projectId = prIdxMatch[1];
        const index = parseInt(prIdxMatch[2], 10);
        const contentLength = parseInt(req.headers.get("content-length") ?? "0", 10);
        if (contentLength > MAX_BODY_SIZE) {
          return json({ error: "Request body too large (max 10 MB)" }, 413);
        }
        const data = loadData();
        const project = findProject(data, projectId);
        if (!project) return json({ error: "Project not found" }, 404);
        try {
          const body = await req.json();
          const err = validatePR(body, project.path);
          if (err) return json({ error: err }, 400);
          if (index < 0 || index >= project.prs.length) {
            return json({ error: "PR index out of range" }, 400);
          }
          const updated = body as PRData;
          updated.completed = false;
          project.prs[index] = updated;
          const prefix = `${index}-`;
          let removed = 0;
          for (const key of Object.keys(project.reviews)) {
            if (key.startsWith(prefix)) {
              delete project.reviews[key];
              removed++;
            }
          }
          saveData(data);
          return json({ ok: true, index, reviewsCleared: removed });
        } catch {
          return json({ error: "Bad request body" }, 400);
        }
      }

      // ── Project-scoped review operations ──────────────────────

      // GET /api/project/:id/reviews — all reviews
      const reviewsGetMatch = path.match(/^\/api\/project\/([^/]+)\/reviews$/);
      if (reviewsGetMatch && req.method === "GET") {
        const projectId = reviewsGetMatch[1];
        const data = loadData();
        const project = findProject(data, projectId);
        if (!project) return json({ error: "Project not found" }, 404);
        return json(project.reviews);
      }

      // POST /api/project/:id/review — save a review
      const reviewPostMatch = path.match(/^\/api\/project\/([^/]+)\/review$/);
      if (reviewPostMatch && req.method === "POST") {
        const projectId = reviewPostMatch[1];
        const data = loadData();
        const project = findProject(data, projectId);
        if (!project) return json({ error: "Project not found" }, 404);
        try {
          const body = await req.json();
          const { idSuffix, action, comment } = body;
          if (!idSuffix || (action !== "approved" && action !== "rejected")) {
            return json({ error: "Invalid request. Need idSuffix and action ('approved' or 'rejected')" }, 400);
          }
          if (!/^\d+-\d+$/.test(idSuffix)) {
            return json({ error: "idSuffix must match format {prIndex}-{fileIndex}" }, 400);
          }
          if (comment !== undefined) {
            if (typeof comment !== "string") {
              return json({ error: "Comment must be a string" }, 400);
            }
            if (comment.length > 500) {
              return json({ error: "Comment too long (max 500 chars)" }, 400);
            }
          }
          const normalizedComment = comment && comment.length > 0 ? comment : null;
          project.reviews[idSuffix] = { verdict: action, comment: normalizedComment };
          saveData(data);
          return json({ ok: true });
        } catch {
          return json({ error: "Bad request body" }, 400);
        }
      }

      // DELETE /api/project/:id/review/:idSuffix — remove a review
      const reviewDelMatch = path.match(/^\/api\/project\/([^/]+)\/review\/(\d+-\d+)$/);
      if (reviewDelMatch && req.method === "DELETE") {
        const projectId = reviewDelMatch[1];
        const idSuffix = reviewDelMatch[2];
        const data = loadData();
        const project = findProject(data, projectId);
        if (!project) return json({ error: "Project not found" }, 404);
        if (!(idSuffix in project.reviews)) {
          return json({ error: "Review not found" }, 404);
        }
        delete project.reviews[idSuffix];
        saveData(data);
        return json({ ok: true });
      }

      // ── Project-scoped complete ───────────────────────────────

      // POST /api/project/:id/complete — mark PR completed
      const completePostMatch = path.match(/^\/api\/project\/([^/]+)\/complete$/);
      if (completePostMatch && req.method === "POST") {
        const projectId = completePostMatch[1];
        const data = loadData();
        const project = findProject(data, projectId);
        if (!project) return json({ error: "Project not found" }, 404);
        try {
          const body = await req.json();
          const { prIndex } = body;
          if (typeof prIndex !== "number" || prIndex < 0) {
            return json({ error: "Invalid request. Need prIndex (non-negative number)" }, 400);
          }
          if (prIndex >= project.prs.length) {
            return json({ error: "PR index out of range" }, 400);
          }
          project.prs[prIndex].completed = true;
          saveData(data);
          return json({ ok: true, prIndex });
        } catch {
          return json({ error: "Bad request body" }, 400);
        }
      }

      // DELETE /api/project/:id/complete/:prIndex — unmark PR
      const completeDelMatch = path.match(/^\/api\/project\/([^/]+)\/complete\/(\d+)$/);
      if (completeDelMatch && req.method === "DELETE") {
        const projectId = completeDelMatch[1];
        const prIndex = parseInt(completeDelMatch[2], 10);
        const data = loadData();
        const project = findProject(data, projectId);
        if (!project) return json({ error: "Project not found" }, 404);
        if (prIndex < 0 || prIndex >= project.prs.length) {
          return json({ error: "PR index out of range" }, 400);
        }
        project.prs[prIndex].completed = false;
        saveData(data);
        return json({ ok: true, prIndex });
      }

      // ── Update check / apply ──────────────────────────────────

      if (path === "/api/update-check" && req.method === "GET") {
        try {
          const currentSha = execSync("git rev-parse HEAD", { encoding: "utf-8" }).trim();
          const ghRes = await fetch("https://api.github.com/repos/mrgonzales-dev/quinn-review/commits/main", {
            headers: { "User-Agent": "quinn-review" },
          });
          if (!ghRes.ok) {
            return json({ error: `GitHub API returned ${ghRes.status}` }, 502);
          }
          const ghData = await ghRes.json() as { sha: string };
          const latestSha = ghData.sha;
          const updateAvailable = currentSha !== latestSha;
          return json({ updateAvailable, currentSha, latestSha });
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          return json({ error: `Update check failed: ${message}` }, 500);
        }
      }

      if (path === "/api/update" && req.method === "POST") {
        try {
          const output = execSync("git pull origin main", { encoding: "utf-8", stderr: "pipe" });
          return json({ ok: true, output: output.trim() });
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          return json({ error: `Update failed: ${message}` }, 500);
        }
      }

      // ── Static icons ──────────────────────────────────────────

      const iconMatch = path.match(/^\/(favicon\.ico|favicon-16\.png|favicon-32\.png|apple-touch-icon\.png|icon-192\.png|icon-512\.png|quinn-logo\.png)$/);
      if (iconMatch) {
        try {
          const iconPath = resolve(dirname(new URL(import.meta.url).pathname), "src", "assets", iconMatch[1]);
          const file = readFileSync(iconPath);
          const ext = iconMatch[1].endsWith(".ico") ? "image/x-icon" : "image/png";
          return new Response(file, {
            headers: { "Content-Type": ext, "Cache-Control": "public, max-age=3600" },
          });
        } catch {
          return new Response("Icon not found", { status: 404 });
        }
      }

      return new Response("Not found", { status: 404 });
    },
  });

  const data = loadData();
  console.log("\n  Quinn — review server running\n");
  console.log(`  Projects: ${data.projects.length}`);
  console.log(`  URL: http://localhost:${serverInstance.port}`);
  console.log(`  Data: ${dataPath}\n`);

  const mcpPath = resolve(import.meta.dir, "src/mcp-server.ts");
  const mcp = spawn("bun", ["run", mcpPath], {
    stdio: ["pipe", "pipe", "inherit"],
  });
  mcp.on("exit", (code) => {
    console.log(`  MCP server exited (code ${code})`);
  });
  console.log(`  MCP: bun run ${mcpPath}\n`);
}

// Only start when run directly, not when imported by tests
const isMainModule = import.meta.path === process.argv[1] || import.meta.main;
if (isMainModule) {
  main();
}
