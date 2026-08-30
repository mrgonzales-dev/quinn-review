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

export function slugify(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

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

export function mergePrsWithReviews(
  prs: Array<{ title: string; description: string; branch: string; label?: string; files: Array<{ path: string }>; completed?: boolean }>,
  reviews: Record<string, { verdict: string; comment: string | null }>,
): Array<{
  index: number;
  label: string | null;
  title: string;
  branch: string;
  completed: boolean;
  files: Array<{ path: string; verdict: string; comment: string | null }>;
}> {
  return prs.map((pr, i) => ({
    index: i,
    label: pr.label ?? null,
    title: pr.title,
    branch: pr.branch,
    completed: pr.completed ?? false,
    files: pr.files.map((file, fi) => {
      const key = `${i}-${fi}`;
      const entry = reviews[key];
      const verdict = entry?.verdict ?? "pending";
      return {
        path: file.path,
        verdict,
        comment: verdict === "pending" ? null : (entry?.comment ?? null),
      };
    }),
  }));
}

const server = new Server(
  { name: "quinn", version: "1.0.0" },
  { capabilities: { tools: {}, prompts: {} } },
);

const QUINN_GUIDE = `# Quinn — AI Code Review Skill

Quinn lets you send proposed code changes to a human reviewer. The reviewer sees a GitHub-style PR page in their browser and approves or rejects each file.

Quinn supports multiple projects. Each project is a separate folder with its own PRs and reviews. Create a project with quinn_create_project, then use the returned projectId for all other tools.

## Workflow

1. Call quinn_start to verify the review server is running.
2. Call quinn_list_projects to see existing projects. If none exist or you need a new one, call quinn_create_project with a name and optional theme (blue, green, purple, orange, red, teal).
3. Call quinn_clear to reset any old PRs in the project from a previous session.
4. Make your changes in the codebase.
5. Build PRs from your changes. Call quinn_send_pr for a single PR, or quinn_send_batch for up to 5 PRs at once. Pass the projectId for the project you want to send to. Give each PR a short label (e.g. "bugfix", "feature", "refactor") so the user can identify it easily. You do not need to count additions or deletions — the server computes them from the diff array.
6. Tell the user to review the changes at http://localhost:2400.
7. Call quinn_list_prs with the projectId to see all PRs with their indices, labels, and per-file review verdicts (approved/rejected/pending). Call quinn_get_pr to see full content of a specific PR. Call quinn_reviews to get the raw review map.
8. If the user requested changes to a PR, call quinn_update_pr with the projectId, prIndex, and updated content. This clears old reviews and puts the PR back up for review.
9. If a PR was sent by mistake, call quinn_delete_pr with the projectId and prIndex to remove it.
10. Apply only the approved changes. Skip rejected files.

## How to format diffs

Break each file change into separate diff hunks. One hunk per logical change. Do NOT lump all changes into one giant block.

Bad: one hunk with 50 lines covering 7 different fixes.
Good: 7 hunks, each with 2-3 lines of context around the change.

Each diff line has a type:
- "context": unchanged line (both oldNumber and newNumber set)
- "added": new line (oldNumber is null, newNumber set)
- "removed": deleted line (oldNumber set, newNumber is null)

Include 1-3 context lines before and after each change so the reviewer can see where the change sits.

## How to group PRs

Group related changes into one PR. One PR per goal or feature, not one PR per file or per fix.

Examples:
- Four zoom-related bug fixes → one PR titled "Fix zoom bugs" with 4 files
- One new feature spanning 3 files → one PR with 3 files
- Unrelated changes (a bug fix and a separate feature) → two PRs

Do NOT split changes that share a common goal into separate PRs. If all the fixes target the same feature or subsystem, put them in one PR.

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
        "Full instructions on how to use Quinn tools, format diffs, group PRs, and batch requests. Read this before using Quinn tools.",
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
        "Returns health status including project count. " +
        "If the server is not running, tell the user to start it with: bun run server.ts",
      inputSchema: { type: "object", properties: {}, required: [] },
    },
    {
      name: "quinn_create_project",
      description:
        "Create a new project folder on the review server. " +
        "Each project holds its own set of PRs and reviews. " +
        "The project ID is auto-generated from the name (slugified). " +
        "Use this when working on a different codebase or feature set that should be reviewed separately. " +
        "Themes: blue, green, purple, orange, red, teal. Defaults to blue.",
      inputSchema: {
        type: "object",
        properties: {
          name: { type: "string", description: "Project name (e.g. 'My Cool App')" },
          theme: { type: "string", enum: ["blue", "green", "purple", "orange", "red", "teal"], description: "Color theme for the project folder. Defaults to blue." },
        },
        required: ["name"],
      },
    },
    {
      name: "quinn_list_projects",
      description:
        "List all projects on the review server. " +
        "Returns each project's id, name, theme, and PR count. " +
        "Use this to find the projectId for other Quinn tools.",
      inputSchema: { type: "object", properties: {}, required: [] },
    },
    {
      name: "quinn_send_pr",
      description:
        "Send a single proposed pull request for human review. " +
        "The PR contains a title, description, branch name, and files with diffs and explanations. " +
        "The user reviews it in their browser at http://localhost:2400. " +
        "\n\n" +
        "PREFERRED FORMAT — content-based (saves tokens): " +
        "Send the full new file content as a 'content' string. " +
        "For modified files, also send 'oldContent' (the original file text). " +
        "The server computes the diff automatically. " +
        "This avoids writing per-line JSON diff objects. " +
        "\n\n" +
        "ALTERNATIVE FORMAT — diff-based: " +
        "Send a 'diff' array with line-by-line objects (type, oldNumber, newNumber, content). " +
        "Include 1-3 context lines around each change. " +
        "\n\n" +
        "Group related changes into one PR. One PR per goal or feature, not one PR per fix. " +
        "Each file needs a specific explanation of what changed and why. " +
        "\n\n" +
        "Sample (content-based):\n" +
        '{\n' +
        '  "title": "Fix path traversal in /api/tree",\n' +
        '  "description": "Resolve path relative to PTY root. Use realpathSync for symlink safety.",\n' +
        '  "branch": "fix/path-traversal",\n' +
        '  "files": [{\n' +
        '    "path": "server.js",\n' +
        '    "status": "modified",\n' +
        '    "content": "full new file text here",\n' +
        '    "oldContent": "full old file text here",\n' +
        '    "explanation": "Resolve relative to PTY root, not server cwd. Use realpathSync for symlink safety."\n' +
        '  }]\n' +
        '}',
      inputSchema: {
        type: "object",
        properties: {
          projectId: { type: "string", description: "Project ID (slugified project name). Use quinn_list_projects to find it." },
          title: { type: "string", description: "PR title — short, focused on the change" },
          description: { type: "string", description: "PR description — what changed and why" },
          branch: { type: "string", description: "Branch name for the PR" },
          label: { type: "string", description: "Short label for the PR (e.g. 'bugfix', 'feature', 'refactor'). Shown as a badge in the sidebar so the user can identify PRs easily." },
          files: {
            type: "array",
            description: "List of files in the PR. Each file needs either 'content' (preferred) or 'diff' array, plus an explanation.",
            items: {
              type: "object",
              properties: {
                path: { type: "string", description: "File path" },
                status: { type: "string", enum: ["added", "modified", "deleted"], description: "File change status" },
                content: {
                  type: "string",
                  description:
                    "PREFERRED: Full new file content as a string. Server computes the diff automatically. " +
                    "For 'added' files, only this is needed. For 'modified' files, also send 'oldContent'. " +
                    "For 'deleted' files, send 'content' with the old file text or use 'oldContent'.",
                },
                oldContent: {
                  type: "string",
                  description:
                    "Original file content (before changes). Used with 'content' for 'modified' status. " +
                    "The server diffs oldContent against content to produce the review diff.",
                },
                additions: { type: "number", description: "Number of added lines (optional — server auto-computes)" },
                deletions: { type: "number", description: "Number of removed lines (optional — server auto-computes)" },
                diff: {
                  type: "array",
                  description:
                    "ALTERNATIVE: Line-by-line diff. Split into separate hunks per logical change. " +
                    "Include 1-3 context lines around each change. " +
                    "Each line: type (context/added/removed), oldNumber, newNumber, content. " +
                    "Use 'content' instead to save tokens.",
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
              required: ["path", "status", "explanation"],
            },
          },
        },
        required: ["projectId", "title", "description", "branch", "files"],
      },
    },
    {
      name: "quinn_list_prs",
      description:
        "List all PRs in a project with per-file review verdicts and comments. " +
        "Returns an array of PRs with their index, label, title, branch, completed status, and files. " +
        "Each file shows its path, verdict ('approved', 'rejected', or 'pending'), and comment (null if none). " +
        "Use this to see the full review state in one call. " +
        "Call quinn_get_pr to see full diff content of a specific PR.",
      inputSchema: {
        type: "object",
        properties: {
          projectId: { type: "string", description: "Project ID (slugified project name)" },
        },
        required: ["projectId"],
      },
    },
    {
      name: "quinn_update_pr",
      description:
        "Update an existing PR by index. Replaces the PR content (title, description, branch, files). " +
        "Clears all review decisions for that PR and resets completed status, putting it back up for review. " +
        "Use this when the user requested changes to a PR you already submitted. " +
        "Same format as quinn_send_pr: prefer 'content' over 'diff' to save tokens.",
      inputSchema: {
        type: "object",
        properties: {
          projectId: { type: "string", description: "Project ID (slugified project name)" },
          prIndex: { type: "number", description: "Index of the PR to update" },
          title: { type: "string", description: "PR title — short, focused on the change" },
          description: { type: "string", description: "PR description — what changed and why" },
          branch: { type: "string", description: "Branch name for the PR" },
          label: { type: "string", description: "Short label for the PR (e.g. 'bugfix', 'feature', 'refactor'). Shown as a badge in the sidebar so the user can identify PRs easily." },
          files: {
            type: "array",
            description: "List of files in the PR. Each file needs either 'content' (preferred) or 'diff' array, plus an explanation.",
            items: {
              type: "object",
              properties: {
                path: { type: "string", description: "File path" },
                status: { type: "string", enum: ["added", "modified", "deleted"], description: "File change status" },
                content: {
                  type: "string",
                  description:
                    "PREFERRED: Full new file content as a string. Server computes the diff automatically. " +
                    "For 'modified' files, also send 'oldContent'.",
                },
                oldContent: {
                  type: "string",
                  description: "Original file content (before changes). Used with 'content' for 'modified' status.",
                },
                additions: { type: "number", description: "Number of added lines (optional — server auto-computes)" },
                deletions: { type: "number", description: "Number of removed lines (optional — server auto-computes)" },
                diff: {
                  type: "array",
                  description:
                    "ALTERNATIVE: Line-by-line diff. Include 1-3 context lines around each change. " +
                    "Use 'content' instead to save tokens.",
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
              required: ["path", "status", "explanation"],
            },
          },
        },
        required: ["projectId", "prIndex", "title", "description", "branch", "files"],
      },
    },
    {
      name: "quinn_send_batch",
      description:
        "Send up to 5 PRs in a single call. Faster than calling quinn_send_pr multiple times. " +
        "Each PR follows the same format as quinn_send_pr. " +
        "Use this when you have 2-5 PRs ready to review. " +
        "\n\n" +
        "Prefer 'content' over 'diff' to save tokens. Write specific explanations.",
      inputSchema: {
        type: "object",
        properties: {
          projectId: { type: "string", description: "Project ID (slugified project name)" },
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
                      content: {
                        type: "string",
                        description: "PREFERRED: Full new file content. Server computes diff. For 'modified', also send 'oldContent'.",
                      },
                      oldContent: {
                        type: "string",
                        description: "Original file content. Used with 'content' for 'modified' status.",
                      },
                      additions: { type: "number" },
                      deletions: { type: "number" },
                      diff: {
                        type: "array",
                        description: "ALTERNATIVE: Line-by-line diff. Use 'content' instead to save tokens.",
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
                    required: ["path", "status", "explanation"],
                  },
                },
              },
              required: ["title", "description", "branch", "files"],
            },
          },
        },
        required: ["projectId", "prs"],
      },
    },
    {
      name: "quinn_reviews",
      description:
        "Get all review decisions from the user for a project. " +
        "Returns a map of file IDs (format: {prIndex}-{fileIndex}) to objects with verdict ('approved' or 'rejected') and comment (string or null). " +
        "Call this after the user has reviewed the PR in their browser. " +
        "Only apply changes that the user approved. Skip rejected files.",
      inputSchema: {
        type: "object",
        properties: {
          projectId: { type: "string", description: "Project ID (slugified project name)" },
        },
        required: ["projectId"],
      },
    },
    {
      name: "quinn_clear",
      description:
        "Delete all PRs and reviews from a project. " +
        "Call this before sending new PRs for a fresh review session.",
      inputSchema: {
        type: "object",
        properties: {
          projectId: { type: "string", description: "Project ID (slugified project name)" },
        },
        required: ["projectId"],
      },
    },
    {
      name: "quinn_delete_pr",
      description:
        "Delete a single PR by index from a project. " +
        "Use this when a PR was sent by mistake (duplicate, wrong file, bad idea). " +
        "This removes the PR and shifts all subsequent PR indices down by one.",
      inputSchema: {
        type: "object",
        properties: {
          projectId: { type: "string", description: "Project ID (slugified project name)" },
          prIndex: { type: "number", description: "Index of the PR to delete" },
        },
        required: ["projectId", "prIndex"],
      },
    },
    {
      name: "quinn_get_pr",
      description:
        "Get full content of a single PR by index from a project. " +
        "Returns title, description, branch, label, and all files with their diffs and explanations. " +
        "Use this to verify what is stored on the server before updating or completing a PR.",
      inputSchema: {
        type: "object",
        properties: {
          projectId: { type: "string", description: "Project ID (slugified project name)" },
          prIndex: { type: "number", description: "Index of the PR to retrieve" },
        },
        required: ["projectId", "prIndex"],
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

      case "quinn_create_project": {
        const result = await apiPost("/api/project", { name: args?.name, theme: args?.theme });
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }

      case "quinn_list_projects": {
        const result = await apiGet("/api/projects");
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }

      case "quinn_list_prs": {
        const projectId = args?.projectId;
        const [prsResult, reviewsResult] = await Promise.all([
          apiGet(`/api/project/${projectId}/prs`),
          apiGet(`/api/project/${projectId}/reviews`),
        ]);
        const prs = prsResult as Array<{ title: string; description: string; branch: string; label?: string; files: Array<{ path: string }>; completed?: boolean }>;
        const reviews = reviewsResult as Record<string, { verdict: string; comment: string | null }>;
        const summary = mergePrsWithReviews(prs, reviews);
        return { content: [{ type: "text", text: JSON.stringify(summary, null, 2) }] };
      }

      case "quinn_send_pr": {
        const { projectId, ...prBody } = args ?? {};
        const result = await apiPost(`/api/project/${projectId}/pr`, prBody);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }

      case "quinn_update_pr": {
        const { projectId, prIndex, ...prBody } = args ?? {};
        const result = await apiPut(`/api/project/${projectId}/pr/${prIndex}`, prBody);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }

      case "quinn_send_batch": {
        const projectId = args?.projectId;
        const result = await apiPost(`/api/project/${projectId}/prs/batch`, args?.prs ?? []);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }

      case "quinn_reviews": {
        const result = await apiGet(`/api/project/${args?.projectId}/reviews`);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }

      case "quinn_clear": {
        const result = await apiDelete(`/api/project/${args?.projectId}/prs`);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }

      case "quinn_delete_pr": {
        const result = await apiDelete(`/api/project/${args?.projectId}/pr/${args?.prIndex}`);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }

      case "quinn_get_pr": {
        const result = await apiGet(`/api/project/${args?.projectId}/pr/${args?.prIndex}`);
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
