#!/usr/bin/env bun
/**
 * mcp-server.ts — Quinn MCP server.
 * Exposes Quinn review tools to AI agents via Model Context Protocol.
 * Uses stdio transport. Each tool maps to an HTTP endpoint on the review server.
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

const SERVER = "http://localhost:2400";

async function apiGet(path: string): Promise<unknown> {
  const res = await fetch(`${SERVER}${path}`);
  return res.json();
}

async function apiPost(path: string, body: unknown): Promise<unknown> {
  const res = await fetch(`${SERVER}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json();
}

async function apiDelete(path: string): Promise<unknown> {
  const res = await fetch(`${SERVER}${path}`, { method: "DELETE" });
  return res.json();
}

async function apiPut(path: string, body: unknown): Promise<unknown> {
  const res = await fetch(`${SERVER}${path}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json();
}

const server = new Server(
  { name: "quinn", version: "1.0.0" },
  { capabilities: { tools: {}, prompts: {} } },
);

const QUINN_GUIDE = `# Quinn — AI Code Review Skill

Quinn lets you send proposed code changes to a human reviewer. The reviewer sees a GitHub-style PR page in their browser and approves or rejects each file.

## Workflow

1. Call quinn_start to verify the review server is running.
2. Call quinn_clear to reset any old PRs from a previous session.
3. Make your changes in the codebase.
4. Build PRs from your changes. Call quinn_send_pr for a single PR, or quinn_send_batch for up to 5 PRs at once. Give each PR a short label (e.g. "bugfix", "feature", "refactor") so the user can identify it easily.
5. Tell the user to review the changes at http://localhost:2400.
6. Call quinn_reviews to check which files the user approved or rejected. Call quinn_list_prs to see all PRs and their indices.
7. If the user requested changes to a PR, call quinn_update_pr with the updated content. This clears old reviews and puts the PR back up for review.
8. Apply only the approved changes. Skip rejected files.
9. Call quinn_complete to mark the PR as done.

## How to format diffs

Dissect each file change into separate diff hunks. One hunk per logical change. Do NOT lump all changes into one giant block.

Bad: one hunk with 50 lines covering 7 different fixes.
Good: 7 hunks, each with 2-3 lines of context around the change.

Each diff line has a type:
- "context": unchanged line (both oldNumber and newNumber set)
- "added": new line (oldNumber is null, newNumber set)
- "removed": deleted line (oldNumber set, newNumber is null)

Include 1-3 context lines before and after each change so the reviewer can see where the change sits.

## How to split PRs

One PR per logical unit of work. Examples:
- One PR per bug fix
- One PR per feature
- One PR per file if the changes are unrelated

If a file has multiple independent fixes, split them into separate PRs. Each PR should have a focused title and description.

## How to write explanations

Each file in a PR has an explanation field. Write what changed and why. Be specific:
- Bad: "Fixed bugs in server.js"
- Good: "Added fs.realpathSync to path containment check to prevent symlink-based path traversal (SERVER_BUG_002)"

## Batching

Use quinn_send_batch when you have 2-5 PRs ready. This is faster than calling quinn_send_pr multiple times. Maximum 5 PRs per batch.

## Sample PR

{
  "title": "Fix path traversal in /api/tree endpoint",
  "description": "Resolves requestedPath relative to PTY root instead of server cwd. Uses fs.realpathSync for symlink-safe containment check.",
  "branch": "fix/path-traversal",
  "files": [
    {
      "path": "server.js",
      "status": "modified",
      "additions": 3,
      "deletions": 1,
      "diff": [
        { "type": "context", "oldNumber": 45, "newNumber": 45, "content": "  const target = requestedPath" },
        { "type": "removed", "oldNumber": 46, "newNumber": null, "content": "    ? path.resolve(requestedPath)" },
        { "type": "added", "oldNumber": null, "newNumber": 46, "content": "    ? fs.realpathSync(path.resolve(root, requestedPath))" },
        { "type": "context", "oldNumber": 47, "newNumber": 47, "content": "    : root;" }
      ],
      "explanation": "Resolve requestedPath relative to PTY root, not server cwd. Use realpathSync for symlink safety."
    }
  ]
}
`;

server.setRequestHandler(ListPromptsRequestSchema, () => ({
  prompts: [
    {
      name: "quinn_guide",
      description:
        "Full instructions on how to use Quinn tools, format diffs, split PRs, and batch requests. Read this before using Quinn tools.",
      arguments: [],
    },
  ],
}));

server.setRequestHandler(GetPromptRequestSchema, (request) => {
  if (request.params.name === "quinn_guide") {
    return {
      messages: [
        {
          role: "user",
          content: { type: "text", text: QUINN_GUIDE },
        },
      ],
    };
  }
  return {
    isError: true,
    messages: [
      {
        role: "user",
        content: { type: "text", text: `Unknown prompt: ${request.params.name}` },
      },
    ],
  };
});

server.setRequestHandler(ListToolsRequestSchema, () => ({
  tools: [
    {
      name: "quinn_start",
      description:
        "Check if the Quinn review server is running. Call this first before sending any PRs. " +
        "Returns health status including PR count and review count. " +
        "If the server is not running, tell the user to start it with: bun run server.ts",
      inputSchema: { type: "object", properties: {}, required: [] },
    },
    {
      name: "quinn_send_pr",
      description:
        "Send a single proposed pull request for human review. " +
        "The PR contains a title, description, branch name, and files with line-by-line diffs and explanations. " +
        "The user reviews it in their browser at http://localhost:2400. " +
        "\n\n" +
        "IMPORTANT: Dissect each file's changes into separate diff hunks — one hunk per logical change. " +
        "Do NOT lump all changes into one giant block. " +
        "Include 1-3 context lines around each change so the reviewer understands where it sits. " +
        "\n\n" +
        "One PR per logical unit of work. If a file has multiple independent fixes, split them into separate PRs. " +
        "Each file needs a specific explanation of what changed and why. " +
        "\n\n" +
        "Sample:\n" +
        '{\n' +
        '  "title": "Fix path traversal in /api/tree",\n' +
        '  "description": "Resolve path relative to PTY root. Use realpathSync for symlink safety.",\n' +
        '  "branch": "fix/path-traversal",\n' +
        '  "files": [{\n' +
        '    "path": "server.js",\n' +
        '    "status": "modified",\n' +
        '    "additions": 3,\n' +
        '    "deletions": 1,\n' +
        '    "diff": [\n' +
        '      {"type":"context","oldNumber":45,"newNumber":45,"content":"  const target = requestedPath"},\n' +
        '      {"type":"removed","oldNumber":46,"newNumber":null,"content":"    ? path.resolve(requestedPath)"},\n' +
        '      {"type":"added","oldNumber":null,"newNumber":46,"content":"    ? fs.realpathSync(path.resolve(root, requestedPath))"},\n' +
        '      {"type":"context","oldNumber":47,"newNumber":47,"content":"    : root;"}\n' +
        '    ],\n' +
        '    "explanation": "Resolve relative to PTY root, not server cwd. Use realpathSync for symlink safety."\n' +
        '  }]\n' +
        '}',
      inputSchema: {
        type: "object",
        properties: {
          title: { type: "string", description: "PR title — short, focused on the change" },
          description: { type: "string", description: "PR description — what changed and why" },
          branch: { type: "string", description: "Branch name for the PR" },
          label: { type: "string", description: "Short label for the PR (e.g. 'bugfix', 'feature', 'refactor'). Shown as a badge in the sidebar so the user can identify PRs easily." },
          files: {
            type: "array",
            description: "List of files in the PR. Each file has its own diff and explanation.",
            items: {
              type: "object",
              properties: {
                path: { type: "string", description: "File path" },
                status: { type: "string", enum: ["added", "modified", "deleted"], description: "File change status" },
                additions: { type: "number", description: "Number of added lines (must match actual added lines in diff)" },
                deletions: { type: "number", description: "Number of removed lines (must match actual removed lines in diff)" },
                diff: {
                  type: "array",
                  description:
                    "Line-by-line diff. Split into separate hunks per logical change. " +
                    "Include 1-3 context lines around each change. " +
                    "Each line: type (context/added/removed), oldNumber, newNumber, content.",
                  items: {
                    type: "object",
                    properties: {
                      type: { type: "string", enum: ["context", "added", "removed"] },
                      oldNumber: { type: ["number", "null"], description: "Old line number, null for added lines" },
                      newNumber: { type: ["number", "null"], description: "New line number, null for removed lines" },
                      content: { type: "string", description: "Line content" },
                    },
                    required: ["type", "oldNumber", "newNumber", "content"],
                  },
                },
                explanation: {
                  type: "string",
                  description:
                    "Why this file was changed. Be specific — name the bug ID, the function, the root cause. " +
                    "Bad: 'Fixed bugs'. Good: 'Added realpathSync to path containment check to prevent symlink traversal (BUG_002)'.",
                },
              },
              required: ["path", "status", "additions", "deletions", "diff", "explanation"],
            },
          },
        },
        required: ["title", "description", "branch", "files"],
      },
    },
    {
      name: "quinn_list_prs",
      description:
        "List all PRs on the review server. " +
        "Returns an array of PRs with their index, label, title, branch, file count, and completed status. " +
        "Use this to see which PRs exist and their indices before updating or completing them.",
      inputSchema: { type: "object", properties: {}, required: [] },
    },
    {
      name: "quinn_update_pr",
      description:
        "Update an existing PR by index. Replaces the PR content (title, description, branch, files). " +
        "Clears all review decisions for that PR and resets completed status, putting it back up for review. " +
        "Use this when the user requested changes to a PR you already submitted. " +
        "Same diff formatting rules apply: dissect into separate hunks per logical change, include context lines.",
      inputSchema: {
        type: "object",
        properties: {
          prIndex: { type: "number", description: "Index of the PR to update" },
          title: { type: "string", description: "PR title — short, focused on the change" },
          description: { type: "string", description: "PR description — what changed and why" },
          branch: { type: "string", description: "Branch name for the PR" },
          label: { type: "string", description: "Short label for the PR (e.g. 'bugfix', 'feature', 'refactor'). Shown as a badge in the sidebar so the user can identify PRs easily." },
          files: {
            type: "array",
            description: "List of files in the PR. Each file has its own diff and explanation.",
            items: {
              type: "object",
              properties: {
                path: { type: "string", description: "File path" },
                status: { type: "string", enum: ["added", "modified", "deleted"], description: "File change status" },
                additions: { type: "number", description: "Number of added lines (must match actual added lines in diff)" },
                deletions: { type: "number", description: "Number of removed lines (must match actual removed lines in diff)" },
                diff: {
                  type: "array",
                  description:
                    "Line-by-line diff. Split into separate hunks per logical change. " +
                    "Include 1-3 context lines around each change. " +
                    "Each line: type (context/added/removed), oldNumber, newNumber, content.",
                  items: {
                    type: "object",
                    properties: {
                      type: { type: "string", enum: ["context", "added", "removed"] },
                      oldNumber: { type: ["number", "null"], description: "Old line number, null for added lines" },
                      newNumber: { type: ["number", "null"], description: "New line number, null for removed lines" },
                      content: { type: "string", description: "Line content" },
                    },
                    required: ["type", "oldNumber", "newNumber", "content"],
                  },
                },
                explanation: {
                  type: "string",
                  description:
                    "Why this file was changed. Be specific — name the bug ID, the function, the root cause. " +
                    "Bad: 'Fixed bugs'. Good: 'Added realpathSync to path containment check to prevent symlink traversal (BUG_002)'.",
                },
              },
              required: ["path", "status", "additions", "deletions", "diff", "explanation"],
            },
          },
        },
        required: ["prIndex", "title", "description", "branch", "files"],
      },
    },
    {
      name: "quinn_send_batch",
      description:
        "Send up to 5 PRs in a single call. Faster than calling quinn_send_pr multiple times. " +
        "Each PR follows the same format as quinn_send_pr. " +
        "Use this when you have 2-5 PRs ready to review. " +
        "\n\n" +
        "Same rules apply: dissect diffs into separate hunks per logical change, include context lines, write specific explanations.",
      inputSchema: {
        type: "object",
        properties: {
          prs: {
            type: "array",
            description: "Array of PR objects (max 5). Each has title, description, branch, files.",
            maxItems: 5,
            items: {
              type: "object",
              properties: {
                title: { type: "string" },
                description: { type: "string" },
                branch: { type: "string" },
                label: { type: "string", description: "Short label for the PR (e.g. 'bugfix', 'feature', 'refactor')" },
                files: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      path: { type: "string" },
                      status: { type: "string", enum: ["added", "modified", "deleted"] },
                      additions: { type: "number" },
                      deletions: { type: "number" },
                      diff: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            type: { type: "string", enum: ["context", "added", "removed"] },
                            oldNumber: { type: ["number", "null"] },
                            newNumber: { type: ["number", "null"] },
                            content: { type: "string" },
                          },
                          required: ["type", "oldNumber", "newNumber", "content"],
                        },
                      },
                      explanation: { type: "string" },
                    },
                    required: ["path", "status", "additions", "deletions", "diff", "explanation"],
                  },
                },
              },
              required: ["title", "description", "branch", "files"],
            },
          },
        },
        required: ["prs"],
      },
    },
    {
      name: "quinn_reviews",
      description:
        "Get all review decisions from the user. " +
        "Returns a map of file IDs (format: {prIndex}-{fileIndex}) to 'approved' or 'rejected'. " +
        "Call this after the user has reviewed the PR in their browser. " +
        "Only apply changes that the user approved. Skip rejected files.",
      inputSchema: { type: "object", properties: {}, required: [] },
    },
    {
      name: "quinn_clear",
      description:
        "Delete all PRs from the review server. " +
        "Call this before sending new PRs for a fresh review session.",
      inputSchema: { type: "object", properties: {}, required: [] },
    },
    {
      name: "quinn_complete",
      description:
        "Mark a PR as completed (done reviewing). " +
        "Call this after you have applied the approved changes and the review is finished.",
      inputSchema: {
        type: "object",
        properties: {
          prIndex: { type: "number", description: "Index of the PR to mark complete" },
        },
        required: ["prIndex"],
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "quinn_start": {
        const result = await apiGet("/api/health");
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }

      case "quinn_list_prs": {
        const result = await apiGet("/api/prs");
        const prs = result as Array<{ title: string; branch: string; label?: string; files: unknown[]; completed?: boolean }>;
        const summary = prs.map((pr, i) => ({
          index: i,
          label: pr.label ?? null,
          title: pr.title,
          branch: pr.branch,
          files: pr.files.length,
          completed: pr.completed ?? false,
        }));
        return { content: [{ type: "text", text: JSON.stringify(summary, null, 2) }] };
      }

      case "quinn_send_pr": {
        const result = await apiPost("/api/pr", args);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }

      case "quinn_update_pr": {
        const prIndex = args?.prIndex;
        const { prIndex: _, ...prBody } = args ?? {};
        const result = await apiPut(`/api/pr/${prIndex}`, prBody);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }

      case "quinn_send_batch": {
        const result = await apiPost("/api/prs/batch", args?.prs ?? []);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }

      case "quinn_reviews": {
        const result = await apiGet("/api/reviews");
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }

      case "quinn_clear": {
        const result = await apiDelete("/api/prs");
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }

      case "quinn_complete": {
        const result = await apiPost("/api/complete", args);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
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
