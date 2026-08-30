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

const server = new Server(
  { name: "quinn", version: "1.0.0" },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, () => ({
  tools: [
    {
      name: "quinn_start",
      description:
        "Check if the Quinn review server is running. Returns health status including PR count and review count.",
      inputSchema: { type: "object", properties: {}, required: [] },
    },
    {
      name: "quinn_send_pr",
      description:
        "Send a proposed pull request to the Quinn review server. The PR contains a title, description, branch name, and a list of files with diffs and explanations. The user reviews the PR in their browser at http://localhost:2400.",
      inputSchema: {
        type: "object",
        properties: {
          title: { type: "string", description: "PR title" },
          description: { type: "string", description: "PR description explaining the changes" },
          branch: { type: "string", description: "Branch name for the PR" },
          files: {
            type: "array",
            description: "List of files in the PR",
            items: {
              type: "object",
              properties: {
                path: { type: "string", description: "File path" },
                status: { type: "string", enum: ["added", "modified", "deleted"], description: "File change status" },
                additions: { type: "number", description: "Number of added lines" },
                deletions: { type: "number", description: "Number of removed lines" },
                diff: {
                  type: "array",
                  description: "Line-by-line diff",
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
                explanation: { type: "string", description: "Why this file was changed" },
              },
              required: ["path", "status", "additions", "deletions", "diff", "explanation"],
            },
          },
        },
        required: ["title", "description", "branch", "files"],
      },
    },
    {
      name: "quinn_reviews",
      description:
        "Get all review decisions from the user. Returns a map of file IDs to 'approved' or 'rejected'. Use this after the user has reviewed the PR in their browser.",
      inputSchema: { type: "object", properties: {}, required: [] },
    },
    {
      name: "quinn_clear",
      description: "Delete all PRs from the review server. Call this before sending new PRs for a fresh review session.",
      inputSchema: { type: "object", properties: {}, required: [] },
    },
    {
      name: "quinn_complete",
      description: "Mark a PR as completed (done reviewing). Pass the PR index.",
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

      case "quinn_send_pr": {
        const result = await apiPost("/api/pr", args);
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
