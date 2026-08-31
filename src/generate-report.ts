#!/usr/bin/env bun
/**
 * generate-report.ts — Quinn CLI entry point.
 * Reads PR JSON from stdin, computes diffs from existing files on disk,
 * and writes a self-contained HTML report file.
 *
 * Usage:
 *   echo '{"projectPath":"...","title":"...","files":[...]}' | bun run src/generate-report.ts
 *
 * Output (stdout): the full path to the generated report file.
 * Errors are written to stderr and the process exits with code 1.
 */

import { readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync } from "node:fs";
import { resolve, join } from "node:path";
import type { PRData, PRFile, DiffLine } from "./types.ts";
import { computeDiff, computeAddedDiff, computeDeletedDiff } from "./diff.ts";
import { renderReport } from "./render/render-report.ts";

export function slugify(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

// ── File reading ───────────────────────────────────────────────

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

// ── Validation ─────────────────────────────────────────────────

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

  let content: string;

  if (hasEdits) {
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

    f.content = content;
  } else {
    content = f.content as string;
  }

  if (f.status === "added") {
    f.diff = computeAddedDiff(content);
  } else if (f.status === "deleted") {
    const oldContent = readOldFile(projectPath, f.path);
    if (!oldContent) {
      return `Cannot delete '${f.path}': file does not exist in project directory`;
    }
    f.diff = computeDeletedDiff(oldContent);
  } else {
    const oldContent = readOldFile(projectPath, f.path);
    if (!oldContent) {
      f.status = "added";
      f.diff = computeAddedDiff(content);
    } else {
      f.diff = computeDiff(oldContent, content);
    }
  }

  if ((f.diff as DiffLine[]).length === 0) {
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

// ── Report storage ─────────────────────────────────────────────

export function getReportsDir(projectPath?: string): string {
  const base = projectPath ? projectPath : process.cwd();
  return resolve(base, "reports");
}

function ensureReportsDir(dir: string): void {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

function generateReportFilename(pr: PRData): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const slug = slugify(pr.title).slice(0, 60) || "report";
  return `${timestamp}-${slug}.html`;
}

export function writeReport(pr: PRData, projectPath?: string): { filename: string; path: string } {
  const dir = getReportsDir(projectPath);
  ensureReportsDir(dir);
  const filename = generateReportFilename(pr);
  const filepath = join(dir, filename);
  const generatedAt = new Date().toLocaleString();
  const html = renderReport(pr, generatedAt);
  writeFileSync(filepath, html, "utf-8");
  return { filename, path: filepath };
}

export function listReportFiles(projectPath?: string): string[] {
  const dir = getReportsDir(projectPath);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter(f => f.endsWith(".html"))
    .sort()
    .reverse();
}

export function readReportContent(filename: string, projectPath?: string): string | null {
  const dir = getReportsDir(projectPath);
  const filepath = join(dir, filename);
  if (!existsSync(filepath)) return null;
  return readFileSync(filepath, "utf-8");
}

// ── CLI entry point ────────────────────────────────────────────

async function main(): Promise<void> {
  const stdin = readFileSync(0, "utf-8");

  if (!stdin) {
    process.stderr.write("No input provided. Pipe PR JSON to stdin.\n");
    process.exit(1);
  }

  let pr: unknown;
  try {
    pr = JSON.parse(stdin);
  } catch {
    process.stderr.write("Invalid JSON input.\n");
    process.exit(1);
  }

  const projectPath = (pr as Record<string, unknown>)?.projectPath as string | undefined;

  const err = validatePR(pr, projectPath);
  if (err) {
    process.stderr.write(`Validation error: ${err}\n`);
    process.exit(1);
  }

  const result = writeReport(pr as PRData, projectPath);
  process.stdout.write(`${result.path}\n`);
}

// Run CLI only when executed directly (not when imported by tests)
if (import.meta.main) {
  await main();
}
