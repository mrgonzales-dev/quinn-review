#!/usr/bin/env bun
/**
 * server.ts — Quinn review server.
 * Serves the PR review page and provides API endpoints for PR management
 * and review decisions.
 *
 * Usage: bun run server.ts [path-to-pr-data.json]
 * Default: ./pr-data.json
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { execSync, spawn } from "node:child_process";
import type { PRData, PRFile, DiffLine } from "./src/types.ts";
import { renderPage } from "./src/render/render-page.ts";

const inputPath = resolve(process.env.QUINN_DATA ?? process.argv[2] ?? "./pr-data.json");
const reviewsPath = resolve(dirname(inputPath), "reviews.json");
const commentsPath = resolve(dirname(inputPath), "comments.json");
const PORT = parseInt(process.env.QUINN_PORT ?? "2400", 10);
const MAX_BODY_SIZE = 10 * 1024 * 1024; // 10 MB

function loadPRData(): PRData[] {
  if (!existsSync(inputPath)) return [];
  try {
    const raw = readFileSync(inputPath, "utf-8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    return [];
  }
}

function savePRData(data: PRData[]): void {
  writeFileSync(inputPath, JSON.stringify(data, null, 2), "utf-8");
}

function loadReviews(): Record<string, string> {
  if (!existsSync(reviewsPath)) return {};
  try {
    return JSON.parse(readFileSync(reviewsPath, "utf-8"));
  } catch {
    return {};
  }
}

function saveReviews(reviews: Record<string, string>): void {
  writeFileSync(reviewsPath, JSON.stringify(reviews, null, 2), "utf-8");
}

function loadComments(): Record<string, string | null> {
  if (!existsSync(commentsPath)) return {};
  try {
    return JSON.parse(readFileSync(commentsPath, "utf-8"));
  } catch {
    return {};
  }
}

function saveComments(comments: Record<string, string | null>): void {
  writeFileSync(commentsPath, JSON.stringify(comments, null, 2), "utf-8");
}

export function validateDiffLine(line: unknown): string | null {
  if (typeof line !== "object" || line === null) return "Diff line must be an object";
  const l = line as Record<string, unknown>;
  if (l.type !== "context" && l.type !== "added" && l.type !== "removed") {
    return "Diff line type must be 'context', 'added', or 'removed'";
  }
  if (l.oldNumber !== null && typeof l.oldNumber !== "number") {
    return "Diff line oldNumber must be a number or null";
  }
  if (l.newNumber !== null && typeof l.newNumber !== "number") {
    return "Diff line newNumber must be a number or null";
  }
  if (typeof l.content !== "string") {
    return "Diff line content must be a string";
  }
  if (l.type === "added" && l.oldNumber !== null) {
    return "Diff line oldNumber must be null for added lines";
  }
  if (l.type === "removed" && l.newNumber !== null) {
    return "Diff line newNumber must be null for removed lines";
  }
  return null;
}

export function validateFile(file: unknown): string | null {
  if (typeof file !== "object" || file === null) return "File must be an object";
  const f = file as Record<string, unknown>;
  if (typeof f.path !== "string" || !f.path) return "File path must be a non-empty string";
  if (f.status !== "added" && f.status !== "modified" && f.status !== "deleted") {
    return "File status must be 'added', 'modified', or 'deleted'";
  }
  if (f.additions !== undefined && (typeof f.additions !== "number" || f.additions < 0)) {
    return "File additions must be a non-negative number";
  }
  if (f.deletions !== undefined && (typeof f.deletions !== "number" || f.deletions < 0)) {
    return "File deletions must be a non-negative number";
  }
  if (!Array.isArray(f.diff) || f.diff.length === 0) {
    return "File diff must be a non-empty array";
  }
  for (let i = 0; i < f.diff.length; i++) {
    const err = validateDiffLine(f.diff[i]);
    if (err) return `Diff line ${i}: ${err}`;
  }
  if (typeof f.explanation !== "string" || !f.explanation) {
    return "File explanation must be a non-empty string";
  }
  const addedCount = (f.diff as DiffLine[]).filter(d => d.type === "added").length;
  const removedCount = (f.diff as DiffLine[]).filter(d => d.type === "removed").length;
  if (f.additions !== undefined && addedCount !== f.additions) {
    return `File additions (${f.additions}) does not match actual added lines (${addedCount})`;
  }
  if (f.deletions !== undefined && removedCount !== f.deletions) {
    return `File deletions (${f.deletions}) does not match actual removed lines (${removedCount})`;
  }
  // Auto-compute additions/deletions from diff array
  f.additions = addedCount;
  f.deletions = removedCount;
  return null;
}

export function validatePR(pr: unknown): string | null {
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
    const err = validateFile(p.files[i]);
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

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
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
        const data = loadPRData();
        const mcpPath = resolve(import.meta.dir, "src/mcp-server.ts");
        const html = renderPage(data, mcpPath);

        return new Response(html, {
          headers: { "Content-Type": "text/html; charset=utf-8" },
        });
      }

      // Health check
      if (path === "/api/health" && req.method === "GET") {
        const data = loadPRData();
        const reviews = loadReviews();
        const completed = data.filter(d => d.completed).length;
        const comments = loadComments();
        return json({ ok: true, prs: data.length, reviews: Object.keys(reviews).length, comments: Object.keys(comments).length, completed });
      }

      // GET all PRs
      if (path === "/api/prs" && req.method === "GET") {
        return json(loadPRData());
      }

      // POST a new PR (validate + append)
      if (path === "/api/pr" && req.method === "POST") {
        const contentLength = parseInt(req.headers.get("content-length") ?? "0", 10);
        if (contentLength > MAX_BODY_SIZE) {
          return json({ error: "Request body too large (max 10 MB)" }, 413);
        }
        try {
          const body = await req.json();
          const err = validatePR(body);
          if (err) return json({ error: err }, 400);
          const data = loadPRData();
          data.push(body as PRData);
          savePRData(data);
          return json({ ok: true, index: data.length - 1, total: data.length });
        } catch {
          return json({ error: "Bad request body" }, 400);
        }
      }

      // DELETE all PRs
      if (path === "/api/prs" && req.method === "DELETE") {
        savePRData([]);
        return json({ ok: true });
      }

      // POST a batch of PRs (up to 5)
      if (path === "/api/prs/batch" && req.method === "POST") {
        const contentLength = parseInt(req.headers.get("content-length") ?? "0", 10);
        if (contentLength > MAX_BODY_SIZE) {
          return json({ error: "Request body too large (max 10 MB)" }, 413);
        }
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
            const err = validatePR(body[i]);
            if (err) errors.push(`PR ${i}: ${err}`);
          }
          if (errors.length > 0) {
            return json({ error: "Validation failed", details: errors }, 400);
          }
          const data = loadPRData();
          const startIndex = data.length;
          for (const pr of body) {
            data.push(pr as PRData);
          }
          savePRData(data);
          return json({ ok: true, startIndex, count: body.length, total: data.length });
        } catch {
          return json({ error: "Bad request body" }, 400);
        }
      }

      // GET a single PR by index
      const prGetMatch = path.match(/^\/api\/pr\/(\d+)$/);
      if (prGetMatch && req.method === "GET") {
        const index = parseInt(prGetMatch[1], 10);
        const data = loadPRData();
        if (index < 0 || index >= data.length) {
          return json({ error: "PR index out of range" }, 400);
        }
        return json(data[index]);
      }

      // DELETE a single PR by index
      if (prGetMatch && req.method === "DELETE") {
        const index = parseInt(prGetMatch[1], 10);
        const data = loadPRData();
        if (index < 0 || index >= data.length) {
          return json({ error: "PR index out of range" }, 400);
        }
        data.splice(index, 1);
        savePRData(data);
        return json({ ok: true, total: data.length });
      }

      // PUT (update) a single PR by index — replaces PR, clears reviews, resets completed
      if (prGetMatch && req.method === "PUT") {
        const index = parseInt(prGetMatch[1], 10);
        const contentLength = parseInt(req.headers.get("content-length") ?? "0", 10);
        if (contentLength > MAX_BODY_SIZE) {
          return json({ error: "Request body too large (max 10 MB)" }, 413);
        }
        try {
          const body = await req.json();
          const err = validatePR(body);
          if (err) return json({ error: err }, 400);
          const data = loadPRData();
          if (index < 0 || index >= data.length) {
            return json({ error: "PR index out of range" }, 400);
          }
          const updated = body as PRData;
          updated.completed = false;
          data[index] = updated;
          savePRData(data);
          // Remove all reviews for this PR
          const reviews = loadReviews();
          const prefix = `${index}-`;
          let removed = 0;
          for (const key of Object.keys(reviews)) {
            if (key.startsWith(prefix)) {
              delete reviews[key];
              removed++;
            }
          }
          saveReviews(reviews);
          // Remove all comments for this PR
          const comments = loadComments();
          for (const key of Object.keys(comments)) {
            if (key.startsWith(prefix)) {
              delete comments[key];
            }
          }
          saveComments(comments);
          return json({ ok: true, index, reviewsCleared: removed });
        } catch {
          return json({ error: "Bad request body" }, 400);
        }
      }

      // GET all reviews
      if (path === "/api/reviews" && req.method === "GET") {
        return json(loadReviews());
      }

      // POST a review decision
      if (path === "/api/review" && req.method === "POST") {
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
          const reviews = loadReviews();
          reviews[idSuffix] = action;
          saveReviews(reviews);
          const comments = loadComments();
          comments[idSuffix] = normalizedComment;
          saveComments(comments);
          return json({ ok: true });
        } catch {
          return json({ error: "Bad request body" }, 400);
        }
      }

      // DELETE a single review by idSuffix
      const reviewDelMatch = path.match(/^\/api\/review\/(\d+-\d+)$/);
      if (reviewDelMatch && req.method === "DELETE") {
        const idSuffix = reviewDelMatch[1];
        const reviews = loadReviews();
        if (!(idSuffix in reviews)) {
          return json({ error: "Review not found" }, 404);
        }
        delete reviews[idSuffix];
        saveReviews(reviews);
        const comments = loadComments();
        delete comments[idSuffix];
        saveComments(comments);
        return json({ ok: true });
      }

      // GET all comments
      if (path === "/api/comments" && req.method === "GET") {
        return json(loadComments());
      }

      // POST complete a PR (mark as done)
      if (path === "/api/complete" && req.method === "POST") {
        try {
          const body = await req.json();
          const { prIndex } = body;
          if (typeof prIndex !== "number" || prIndex < 0) {
            return json({ error: "Invalid request. Need prIndex (non-negative number)" }, 400);
          }
          const data = loadPRData();
          if (prIndex >= data.length) {
            return json({ error: "PR index out of range" }, 400);
          }
          data[prIndex].completed = true;
          savePRData(data);
          return json({ ok: true, prIndex });
        } catch {
          return json({ error: "Bad request body" }, 400);
        }
      }

      // DELETE complete status from a PR (unmark)
      const completeDelMatch = path.match(/^\/api\/complete\/(\d+)$/);
      if (completeDelMatch && req.method === "DELETE") {
        const prIndex = parseInt(completeDelMatch[1], 10);
        const data = loadPRData();
        if (prIndex < 0 || prIndex >= data.length) {
          return json({ error: "PR index out of range" }, 400);
        }
        data[prIndex].completed = false;
        savePRData(data);
        return json({ ok: true, prIndex });
      }

      // Check for updates — compare local HEAD with GitHub remote main
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

      // Apply update — git pull origin main
      if (path === "/api/update" && req.method === "POST") {
        try {
          const output = execSync("git pull origin main", { encoding: "utf-8", stderr: "pipe" });
          return json({ ok: true, output: output.trim() });
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          return json({ error: `Update failed: ${message}` }, 500);
        }
      }

      // Serve static icons (favicon, apple-touch-icon, etc.)
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

  const data = loadPRData();
  console.log("\n  Quinn — review server running\n");
  console.log(`  PRs: ${data.length}`);
  console.log(`  URL: http://localhost:${serverInstance.port}`);
  console.log(`  Data: ${inputPath}`);
  console.log(`  Reviews: ${reviewsPath}`);
  console.log(`  Comments: ${commentsPath}\n`);

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
