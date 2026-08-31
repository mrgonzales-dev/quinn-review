#!/usr/bin/env bun
/**
 * mcp-server.ts — Quinn MCP server.
 * Generates static HTML reports from PR data. No HTTP server required.
 * Uses stdio transport for AI agent communication via Model Context Protocol.
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
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

// ── MCP server ─────────────────────────────────────────────────

const server = new Server(
  { name: "quinn", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, () => ({
  tools: [
    {
      name: "quinn_generate_report",
      description:
        "Generate a static HTML report from PR data. Computes diffs from existing files on disk. " +
        "The report is a self-contained HTML file with inline CSS — no JavaScript, no interactivity. " +
        "Pass 'projectPath' so Quinn can read existing files and compute diffs. " +
        "Each file uses either 'content' (full new file text) or 'edits' (search/replace pairs). " +
        "Returns the filename and path of the generated report.",
      inputSchema: {
        type: "object",
        properties: {
          projectPath: {
            type: "string",
            description: "Filesystem root path for reading existing files to compute diffs.",
          },
          title: { type: "string", description: "Short summary of the proposed changes." },
          description: { type: "string", description: "Longer explanation of what and why." },
          branch: { type: "string", description: "Branch name with ai-proposal/ prefix." },
          label: { type: "string", description: "Short tag shown as a badge (optional)." },
          files: {
            type: "array",
            description: "Array of file objects. Each has path, status, content or edits, and explanation.",
            items: {
              type: "object",
              properties: {
                path: { type: "string" },
                status: { type: "string", enum: ["added", "modified", "deleted"] },
                content: { type: "string" },
                edits: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      search: { type: "string" },
                      replace: { type: "string" },
                    },
                  },
                },
                explanation: { type: "string" },
              },
            },
          },
        },
        required: ["title", "description", "branch", "files"],
      },
    },
    {
      name: "quinn_list_reports",
      description:
        "List all generated HTML reports. Returns filenames sorted by newest first. " +
        "Pass 'projectPath' to list reports for a specific project; otherwise lists reports in the current working directory.",
      inputSchema: {
        type: "object",
        properties: {
          projectPath: {
            type: "string",
            description: "Filesystem root path where reports/ is located. Optional.",
          },
        },
        required: [],
      },
    },
    {
      name: "quinn_get_report",
      description:
        "Read the full HTML content of a generated report by filename. " +
        "Returns the raw HTML string. " +
        "Pass 'projectPath' to read from a specific project's reports directory.",
      inputSchema: {
        type: "object",
        properties: {
          filename: { type: "string", description: "The report filename from quinn_list_reports." },
          projectPath: {
            type: "string",
            description: "Filesystem root path where reports/ is located. Optional.",
          },
        },
        required: ["filename"],
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "quinn_generate_report": {
        const projectPath = args?.projectPath as string | undefined;
        const pr: PRData = {
          title: args?.title as string,
          description: args?.description as string,
          branch: args?.branch as string,
          label: args?.label as string | undefined,
          files: args?.files as PRFile[],
        };

        const err = validatePR(pr, projectPath);
        if (err) {
          return { content: [{ type: "text", text: `Validation error: ${err}` }], isError: true };
        }

        const result = writeReport(pr, projectPath);
        return {
          content: [{
            type: "text",
            text: `Report generated successfully.\nFilename: ${result.filename}\nPath: ${result.path}`,
          }],
        };
      }

      case "quinn_list_reports": {
        const projectPath = args?.projectPath as string | undefined;
        const files = listReportFiles(projectPath);
        if (files.length === 0) {
          return { content: [{ type: "text", text: "No reports found." }] };
        }
        return {
          content: [{
            type: "text",
            text: `Reports (${files.length}):\n${files.map(f => `  - ${f}`).join("\n")}`,
          }],
        };
      }

      case "quinn_get_report": {
        const filename = args?.filename as string;
        if (!filename) {
          return { content: [{ type: "text", text: "filename is required" }], isError: true };
        }
        const projectPath = args?.projectPath as string | undefined;
        const content = readReportContent(filename, projectPath);
        if (content === null) {
          return { content: [{ type: "text", text: `Report '${filename}' not found` }], isError: true };
        }
        return { content: [{ type: "text", text: content }] };
      }

      default:
        return { content: [{ type: "text", text: `Unknown tool: ${name}` }], isError: true };
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { content: [{ type: "text", text: `Error: ${message}` }], isError: true };
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
