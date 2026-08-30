import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { writeFileSync, existsSync, unlinkSync, mkdirSync, rmSync } from "node:fs";
import { resolve } from "node:path";

const TEST_PORT = 2499;
const TEST_DATA = resolve(import.meta.dir, "quinn-data.json");
const TEST_PROJECT_DIR = resolve(import.meta.dir, "test-project");

function cleanup(): void {
  if (existsSync(TEST_DATA)) unlinkSync(TEST_DATA);
  if (existsSync(TEST_PROJECT_DIR)) rmSync(TEST_PROJECT_DIR, { recursive: true, force: true });
}

const BASE = `http://localhost:${TEST_PORT}`;

async function getJSON(path: string): Promise<unknown> {
  const res = await fetch(`${BASE}${path}`);
  return res.json();
}

async function postJSON(path: string, body: unknown): Promise<unknown> {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json();
}

async function deleteJSON(path: string): Promise<unknown> {
  const res = await fetch(`${BASE}${path}`, { method: "DELETE" });
  return res.json();
}

async function putJSON(path: string, body: unknown): Promise<unknown> {
  const res = await fetch(`${BASE}${path}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json();
}

function makePR(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    title: "Test PR",
    description: "Test description",
    branch: "test-branch",
    files: [
      {
        path: "src/main.ts",
        status: "added",
        content: "const x = 2;\n",
        explanation: "Changed x from 1 to 2",
      },
    ],
    ...overrides,
  };
}

describe("server endpoints", () => {
  let stopServer: () => void;

  beforeAll(async () => {
    cleanup();
    mkdirSync(TEST_PROJECT_DIR, { recursive: true });
    mkdirSync(resolve(TEST_PROJECT_DIR, "src"), { recursive: true });
    process.env.QUINN_PORT = String(TEST_PORT);
    process.env.QUINN_DATA = TEST_DATA;
    const mod = await import("../server.ts");
    mod.main();
    stopServer = mod.stop ?? (() => {});
  });

  afterAll(() => {
    if (stopServer) stopServer();
    cleanup();
  });

  // ── Health check ──────────────────────────────────────────────

  describe("health check", () => {
    it("GET /api/health returns ok status with project count", async () => {
      const result = await getJSON("/api/health") as { ok: boolean; projects: number };
      expect(result.ok).toBe(true);
      expect(result.projects).toBe(0);
    });
  });

  // ── Settings ──────────────────────────────────────────────────

  describe("settings", () => {
    it("GET /api/settings returns firstTimeSeen false by default", async () => {
      const result = await getJSON("/api/settings") as { firstTimeSeen: boolean };
      expect(result.firstTimeSeen).toBe(false);
    });

    it("POST /api/settings updates firstTimeSeen", async () => {
      const result = await postJSON("/api/settings", { firstTimeSeen: true }) as { ok: boolean };
      expect(result.ok).toBe(true);

      const settings = await getJSON("/api/settings") as { firstTimeSeen: boolean };
      expect(settings.firstTimeSeen).toBe(true);
    });

    it("POST /api/settings rejects non-boolean firstTimeSeen", async () => {
      const result = await postJSON("/api/settings", { firstTimeSeen: "yes" }) as { error: string };
      expect(result.error).toContain("boolean");
    });
  });

  // ── Project CRUD ──────────────────────────────────────────────

  describe("project management", () => {
    it("GET /api/projects returns empty array initially", async () => {
      const result = await getJSON("/api/projects") as Array<unknown>;
      expect(result).toEqual([]);
    });

    it("POST /api/project creates a project with name, theme, and path", async () => {
      const result = await postJSON("/api/project", { name: "My App", theme: "blue", path: TEST_PROJECT_DIR }) as {
        ok: boolean; id: string; name: string; theme: string; path: string;
      };
      expect(result.ok).toBe(true);
      expect(result.id).toBe("my-app");
      expect(result.name).toBe("My App");
      expect(result.theme).toBe("blue");
      expect(result.path).toBe(TEST_PROJECT_DIR);
    });

    it("GET /api/projects returns created project", async () => {
      const result = await getJSON("/api/projects") as Array<{ id: string; name: string; theme: string }>;
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("my-app");
      expect(result[0].name).toBe("My App");
      expect(result[0].theme).toBe("blue");
    });

    it("GET /api/project/:id returns project details", async () => {
      const result = await getJSON("/api/project/my-app") as {
        id: string; name: string; theme: string; prs: number;
      };
      expect(result.id).toBe("my-app");
      expect(result.name).toBe("My App");
      expect(result.theme).toBe("blue");
      expect(result.prs).toBe(0);
    });

    it("GET /api/project/:id returns 404 for unknown project", async () => {
      const result = await getJSON("/api/project/nonexistent") as { error: string };
      expect(result.error).toContain("not found");
    });

    it("POST /api/project rejects missing name", async () => {
      const result = await postJSON("/api/project", { theme: "red" }) as { error: string };
      expect(result.error).toContain("name");
    });

    it("POST /api/project rejects invalid theme", async () => {
      const result = await postJSON("/api/project", { name: "Bad Theme", theme: "pink" }) as { error: string };
      expect(result.error).toContain("theme");
    });

    it("POST /api/project defaults theme to blue when omitted", async () => {
      const result = await postJSON("/api/project", { name: "Default Theme App" }) as { theme: string };
      expect(result.theme).toBe("blue");
    });

    it("POST /api/project generates slug id from name", async () => {
      const result = await postJSON("/api/project", { name: "My Cool Project!" }) as { id: string };
      expect(result.id).toBe("my-cool-project");
    });

    it("POST /api/project rejects duplicate id", async () => {
      await postJSON("/api/project", { name: "Dup Test", theme: "green" });
      const result = await postJSON("/api/project", { name: "Dup Test", theme: "green" }) as { error: string };
      expect(result.error).toContain("already exists");
    });

    it("DELETE /api/project/:id removes a project", async () => {
      await postJSON("/api/project", { name: "Delete Me", theme: "orange" });
      const result = await deleteJSON("/api/project/delete-me") as { ok: boolean };
      expect(result.ok).toBe(true);

      const check = await getJSON("/api/project/delete-me") as { error: string };
      expect(check.error).toContain("not found");
    });

    it("DELETE /api/project/:id returns 404 for unknown project", async () => {
      const result = await deleteJSON("/api/project/nope") as { error: string };
      expect(result.error).toContain("not found");
    });
  });

  // ── Project-scoped PR operations ──────────────────────────────

  describe("project-scoped PR operations", () => {
    const PROJ = "pr-test-proj";

    async function ensureProject(): Promise<void> {
      await postJSON("/api/project", { name: "PR Test Proj", theme: "purple", path: TEST_PROJECT_DIR });
    }

    it("POST /api/project/:id/pr adds a PR to a project", async () => {
      await ensureProject();
      const result = await postJSON(`/api/project/${PROJ}/pr`, makePR()) as { ok: boolean; index: number };
      expect(result.ok).toBe(true);
      expect(result.index).toBe(0);
    });

    it("GET /api/project/:id/prs returns project PRs", async () => {
      const result = await getJSON(`/api/project/${PROJ}/prs`) as Array<{ title: string }>;
      expect(result).toHaveLength(1);
      expect(result[0].title).toBe("Test PR");
    });

    it("GET /api/project/:id/pr/:index returns a single PR", async () => {
      const pr = await getJSON(`/api/project/${PROJ}/pr/0`) as { title: string; files: Array<{ additions: number }> };
      expect(pr.title).toBe("Test PR");
      expect(pr.files[0].additions).toBe(1);
    });

    it("auto-computes additions and deletions from diff", async () => {
      const pr = await getJSON(`/api/project/${PROJ}/pr/0`) as { files: Array<{ additions: number; deletions: number }> };
      expect(pr.files[0].additions).toBe(1);
      expect(pr.files[0].deletions).toBe(0);
    });

    it("POST /api/project/:id/pr rejects invalid PR", async () => {
      const result = await postJSON(`/api/project/${PROJ}/pr`, { title: "Bad" }) as { error: string };
      expect(result.error).toBeDefined();
    });

    it("POST /api/project/:id/pr returns 404 for unknown project", async () => {
      const result = await postJSON("/api/project/nope/pr", makePR()) as { error: string };
      expect(result.error).toContain("not found");
    });

    it("POST /api/project/:id/prs/batch adds multiple PRs", async () => {
      const batch = [makePR({ title: "Batch A" }), makePR({ title: "Batch B" })];
      const result = await postJSON(`/api/project/${PROJ}/prs/batch`, batch) as { ok: boolean; count: number };
      expect(result.ok).toBe(true);
      expect(result.count).toBe(2);
    });

    it("POST /api/project/:id/prs/batch rejects over 5 PRs", async () => {
      const batch = Array.from({ length: 6 }, (_, i) => makePR({ title: `Over ${i}` }));
      const result = await postJSON(`/api/project/${PROJ}/prs/batch`, batch) as { error: string };
      expect(result.error).toContain("5");
    });

    it("PUT /api/project/:id/pr/:index replaces PR and clears reviews", async () => {
      await postJSON(`/api/project/${PROJ}/review`, { idSuffix: "0-0", action: "approved" });
      const result = await putJSON(`/api/project/${PROJ}/pr/0`, makePR({ title: "Replaced" })) as {
        ok: boolean; reviewsCleared: number;
      };
      expect(result.ok).toBe(true);
      expect(result.reviewsCleared).toBe(1);

      const pr = await getJSON(`/api/project/${PROJ}/pr/0`) as { title: string };
      expect(pr.title).toBe("Replaced");
    });

    it("DELETE /api/project/:id/pr/:index removes a PR", async () => {
      const addResult = await postJSON(`/api/project/${PROJ}/pr`, makePR({ title: "Delete This" })) as { index: number };
      const idx = addResult.index;
      const result = await deleteJSON(`/api/project/${PROJ}/pr/${idx}`) as { ok: boolean };
      expect(result.ok).toBe(true);

      const check = await getJSON(`/api/project/${PROJ}/pr/${idx}`) as { error: string };
      expect(check.error).toContain("out of range");
    });

    it("DELETE /api/project/:id/prs clears all PRs and reviews", async () => {
      await postJSON(`/api/project/${PROJ}/review`, { idSuffix: "0-0", action: "approved" });
      const result = await deleteJSON(`/api/project/${PROJ}/prs`) as { ok: boolean };
      expect(result.ok).toBe(true);

      const prs = await getJSON(`/api/project/${PROJ}/prs`) as Array<unknown>;
      expect(prs).toEqual([]);

      const reviews = await getJSON(`/api/project/${PROJ}/reviews`) as Record<string, unknown>;
      expect(Object.keys(reviews)).toHaveLength(0);
    });
  });

  // ── Content-based format with disk reads ──────────────────────

  describe("content-based PR format with disk reads", () => {
    const PROJ = "content-test-proj";

    beforeAll(async () => {
      await postJSON("/api/project", { name: "Content Test Proj", theme: "blue", path: TEST_PROJECT_DIR });
    });

    it("accepts content for added file and computes diff", async () => {
      const pr = {
        title: "Content Added",
        description: "Test content-based added file",
        branch: "test/content-added",
        files: [{
          path: "new-file.ts",
          status: "added",
          content: "const x = 1;\nconst y = 2;\n",
          explanation: "New file with two constants",
        }],
      };
      const result = await postJSON(`/api/project/${PROJ}/pr`, pr) as { ok: boolean; index: number };
      expect(result.ok).toBe(true);

      const fetched = await getJSON(`/api/project/${PROJ}/pr/${result.index}`) as {
        files: Array<{ diff: Array<{ type: string; content: string }>; additions: number; deletions: number }>;
      };
      expect(fetched.files[0].additions).toBe(2);
      expect(fetched.files[0].deletions).toBe(0);
      expect(fetched.files[0].diff.every(d => d.type === "added")).toBe(true);
    });

    it("computes diff for modified file by reading old content from disk", async () => {
      // Write an existing file to the project directory
      const filePath = resolve(TEST_PROJECT_DIR, "modified.ts");
      writeFileSync(filePath, "const x = 1;\nconst y = 2;\n", "utf-8");

      const pr = {
        title: "Content Modified",
        description: "Test content-based modified file with disk read",
        branch: "test/content-modified",
        files: [{
          path: "modified.ts",
          status: "modified",
          content: "const x = 2;\nconst y = 3;\n",
          explanation: "Changed x and y values",
        }],
      };
      const result = await postJSON(`/api/project/${PROJ}/pr`, pr) as { ok: boolean; index: number };
      expect(result.ok).toBe(true);

      const fetched = await getJSON(`/api/project/${PROJ}/pr/${result.index}`) as {
        files: Array<{ diff: Array<{ type: string; content: string }>; additions: number; deletions: number }>;
      };
      const diff = fetched.files[0].diff;
      const addedLines = diff.filter(d => d.type === "added");
      const removedLines = diff.filter(d => d.type === "removed");
      expect(addedLines.length).toBe(2);
      expect(removedLines.length).toBe(2);
      expect(addedLines.map(d => d.content)).toEqual(["const x = 2;", "const y = 3;"]);
      expect(removedLines.map(d => d.content)).toEqual(["const x = 1;", "const y = 2;"]);
    });

    it("rejects file with no content", async () => {
      const pr = {
        title: "No Content",
        description: "Should fail",
        branch: "test/none",
        files: [{
          path: "empty.ts",
          status: "modified",
          explanation: "Missing content",
        }],
      };
      const result = await postJSON(`/api/project/${PROJ}/pr`, pr) as { error: string };
      expect(result.error).toContain("content");
    });

    it("rejects modified file with identical content to disk", async () => {
      const filePath = resolve(TEST_PROJECT_DIR, "same.ts");
      writeFileSync(filePath, "const x = 1;\n", "utf-8");

      const pr = {
        title: "No Changes",
        description: "Should fail",
        branch: "test/identical",
        files: [{
          path: "same.ts",
          status: "modified",
          content: "const x = 1;\n",
          explanation: "No actual changes",
        }],
      };
      const result = await postJSON(`/api/project/${PROJ}/pr`, pr) as { error: string };
      expect(result.error).toContain("empty");
    });

    it("treats modified file as added when file does not exist on disk", async () => {
      const pr = {
        title: "Modified But New",
        description: "File does not exist on disk yet",
        branch: "test/modified-new",
        files: [{
          path: "does-not-exist.ts",
          status: "modified",
          content: "const z = 99;\n",
          explanation: "File is new but status was modified",
        }],
      };
      const result = await postJSON(`/api/project/${PROJ}/pr`, pr) as { ok: boolean; index: number };
      expect(result.ok).toBe(true);

      const fetched = await getJSON(`/api/project/${PROJ}/pr/${result.index}`) as {
        files: Array<{ status: string; additions: number; deletions: number }>;
      };
      expect(fetched.files[0].status).toBe("added");
      expect(fetched.files[0].additions).toBe(1);
      expect(fetched.files[0].deletions).toBe(0);
    });

    it("computes deleted diff by reading old content from disk", async () => {
      const filePath = resolve(TEST_PROJECT_DIR, "to-delete.ts");
      writeFileSync(filePath, "line1\nline2\nline3\n", "utf-8");

      const pr = {
        title: "Delete File",
        description: "Delete a file that exists on disk",
        branch: "test/delete",
        files: [{
          path: "to-delete.ts",
          status: "deleted",
          content: "",
          explanation: "Removing this file",
        }],
      };
      const result = await postJSON(`/api/project/${PROJ}/pr`, pr) as { ok: boolean; index: number };
      expect(result.ok).toBe(true);

      const fetched = await getJSON(`/api/project/${PROJ}/pr/${result.index}`) as {
        files: Array<{ diff: Array<{ type: string }>; additions: number; deletions: number }>;
      };
      expect(fetched.files[0].additions).toBe(0);
      expect(fetched.files[0].deletions).toBe(3);
      expect(fetched.files[0].diff.every(d => d.type === "removed")).toBe(true);
    });

    it("rejects deleted file that does not exist on disk", async () => {
      const pr = {
        title: "Delete Nonexistent",
        description: "Should fail",
        branch: "test/delete-nonexistent",
        files: [{
          path: "no-such-file.ts",
          status: "deleted",
          content: "",
          explanation: "File does not exist",
        }],
      };
      const result = await postJSON(`/api/project/${PROJ}/pr`, pr) as { error: string };
      expect(result.error).toContain("does not exist");
    });
  });

  // ── Diff computation unit tests ────────────────────────────────

  describe("diff computation", () => {
    const { computeDiff, computeAddedDiff, computeDeletedDiff } = require("../src/diff.ts");

    it("computeDiff produces correct added/removed lines", () => {
      const old = "a\nb\nc\n";
      const new_ = "a\nx\nc\n";
      const diff = computeDiff(old, new_);
      const types = diff.map((d: { type: string }) => d.type);
      expect(types).toContain("added");
      expect(types).toContain("removed");
      const added = diff.filter((d: { type: string }) => d.type === "added");
      const removed = diff.filter((d: { type: string }) => d.type === "removed");
      expect(added[0].content).toBe("x");
      expect(removed[0].content).toBe("b");
    });

    it("computeDiff includes context lines around changes", () => {
      const old = "line1\nline2\nline3\nline4\nline5\nline6\nline7\nline8\n";
      const new_ = "line1\nline2\nline3\nCHANGED\nline5\nline6\nline7\nline8\n";
      const diff = computeDiff(old, new_);
      const contextLines = diff.filter((d: { type: string }) => d.type === "context");
      expect(contextLines.length).toBeGreaterThan(0);
    });

    it("computeDiff returns empty for identical content", () => {
      const diff = computeDiff("same\ncontent\n", "same\ncontent\n");
      const changes = diff.filter((d: { type: string }) => d.type !== "context");
      expect(changes).toHaveLength(0);
    });

    it("computeAddedDiff marks all lines as added", () => {
      const diff = computeAddedDiff("a\nb\nc\n");
      expect(diff).toHaveLength(3);
      expect(diff.every((d: { type: string }) => d.type === "added")).toBe(true);
      expect(diff[0].newNumber).toBe(1);
      expect(diff[2].newNumber).toBe(3);
    });

    it("computeDeletedDiff marks all lines as removed", () => {
      const diff = computeDeletedDiff("a\nb\nc\n");
      expect(diff).toHaveLength(3);
      expect(diff.every((d: { type: string }) => d.type === "removed")).toBe(true);
      expect(diff[0].oldNumber).toBe(1);
      expect(diff[2].oldNumber).toBe(3);
    });

    it("computeAddedDiff returns empty for empty content", () => {
      const diff = computeAddedDiff("");
      expect(diff).toHaveLength(0);
    });

    it("computeDiff handles insertions at end", () => {
      const old = "a\nb\n";
      const new_ = "a\nb\nc\nd\n";
      const diff = computeDiff(old, new_);
      const added = diff.filter((d: { type: string }) => d.type === "added");
      expect(added).toHaveLength(2);
      expect(added[0].content).toBe("c");
      expect(added[1].content).toBe("d");
    });

    it("computeDiff handles deletions at start", () => {
      const old = "a\nb\nc\n";
      const new_ = "c\n";
      const diff = computeDiff(old, new_);
      const removed = diff.filter((d: { type: string }) => d.type === "removed");
      const added = diff.filter((d: { type: string }) => d.type === "added");
      expect(removed).toHaveLength(2);
      expect(added).toHaveLength(0);
    });
  });

  // ── Project-scoped review operations ──────────────────────────

  describe("project-scoped review operations", () => {
    const PROJ = "review-test-proj";

    async function ensureProject(): Promise<void> {
      await postJSON("/api/project", { name: "Review Test Proj", theme: "teal", path: TEST_PROJECT_DIR });
      await postJSON(`/api/project/${PROJ}/pr`, makePR({ title: "Review PR" }));
    }

    it("POST /api/project/:id/review saves verdict and comment", async () => {
      await ensureProject();
      const result = await postJSON(`/api/project/${PROJ}/review`, {
        idSuffix: "0-0",
        action: "approved",
        comment: "looks good",
      }) as { ok: boolean };
      expect(result.ok).toBe(true);

      const reviews = await getJSON(`/api/project/${PROJ}/reviews`) as Record<string, { verdict: string; comment: string | null }>;
      expect(reviews["0-0"].verdict).toBe("approved");
      expect(reviews["0-0"].comment).toBe("looks good");
    });

    it("POST /api/project/:id/review stores null for empty comment", async () => {
      await postJSON(`/api/project/${PROJ}/review`, {
        idSuffix: "0-0",
        action: "rejected",
        comment: "",
      });

      const reviews = await getJSON(`/api/project/${PROJ}/reviews`) as Record<string, { verdict: string; comment: string | null }>;
      expect(reviews["0-0"].comment).toBeNull();
    });

    it("POST /api/project/:id/review rejects comment over 500 chars", async () => {
      const result = await postJSON(`/api/project/${PROJ}/review`, {
        idSuffix: "0-0",
        action: "approved",
        comment: "x".repeat(501),
      }) as { error: string };
      expect(result.error).toContain("500");
    });

    it("POST /api/project/:id/review rejects invalid action", async () => {
      const result = await postJSON(`/api/project/${PROJ}/review`, {
        idSuffix: "0-0",
        action: "maybe",
      }) as { error: string };
      expect(result.error).toContain("approved");
    });

    it("DELETE /api/project/:id/review/:idSuffix removes a review", async () => {
      await postJSON(`/api/project/${PROJ}/review`, { idSuffix: "0-0", action: "approved" });
      const result = await deleteJSON(`/api/project/${PROJ}/review/0-0`) as { ok: boolean };
      expect(result.ok).toBe(true);

      const reviews = await getJSON(`/api/project/${PROJ}/reviews`) as Record<string, unknown>;
      expect(reviews["0-0"]).toBeUndefined();
    });

    it("DELETE /api/project/:id/review/:idSuffix returns 404 for missing review", async () => {
      const result = await deleteJSON(`/api/project/${PROJ}/review/9-9`) as { error: string };
      expect(result.error).toContain("not found");
    });

    it("POST /api/project/:id/review returns 404 for unknown project", async () => {
      const result = await postJSON("/api/project/nope/review", {
        idSuffix: "0-0",
        action: "approved",
      }) as { error: string };
      expect(result.error).toContain("not found");
    });
  });

  // ── Project-scoped complete ───────────────────────────────────

  describe("project-scoped complete", () => {
    const PROJ = "complete-test-proj";

    it("POST /api/project/:id/complete marks PR as completed", async () => {
      await postJSON("/api/project", { name: "Complete Test Proj", theme: "red", path: TEST_PROJECT_DIR });
      await postJSON(`/api/project/${PROJ}/pr`, makePR({ title: "Complete Me" }));

      const result = await postJSON(`/api/project/${PROJ}/complete`, { prIndex: 0 }) as { ok: boolean };
      expect(result.ok).toBe(true);

      const pr = await getJSON(`/api/project/${PROJ}/pr/0`) as { completed: boolean };
      expect(pr.completed).toBe(true);
    });

    it("DELETE /api/project/:id/complete/:prIndex unmarks PR", async () => {
      const result = await deleteJSON(`/api/project/${PROJ}/complete/0`) as { ok: boolean };
      expect(result.ok).toBe(true);

      const pr = await getJSON(`/api/project/${PROJ}/pr/0`) as { completed: boolean };
      expect(pr.completed).toBe(false);
    });

    it("POST /api/project/:id/complete rejects out-of-range index", async () => {
      const result = await postJSON(`/api/project/${PROJ}/complete`, { prIndex: 999 }) as { error: string };
      expect(result.error).toContain("out of range");
    });
  });

  // ── PR deletion rekeys reviews (project-scoped) ───────────────

  describe("DELETE /api/project/:id/pr/:index — rekeys reviews", () => {
    const PROJ = "rekey-test-proj";

    async function setupRekeyProject(): Promise<void> {
      await postJSON("/api/project", { name: "Rekey Test Proj", theme: "green", path: TEST_PROJECT_DIR });
      for (let i = 0; i < 3; i++) {
        await postJSON(`/api/project/${PROJ}/pr`, makePR({ title: `Rekey PR ${i}` }));
        await postJSON(`/api/project/${PROJ}/review`, {
          idSuffix: `${i}-0`,
          action: "approved",
          comment: `comment ${i}`,
        });
      }
    }

    it("removes reviews for deleted PR and rekeys higher indices", async () => {
      await setupRekeyProject();

      // Delete PR at index 1
      await deleteJSON(`/api/project/${PROJ}/pr/1`);

      const reviews = await getJSON(`/api/project/${PROJ}/reviews`) as Record<string, { verdict: string; comment: string | null }>;
      // PR 0 unchanged
      expect(reviews["0-0"].verdict).toBe("approved");
      expect(reviews["0-0"].comment).toBe("comment 0");
      // Old index 2 rekeyed to 1
      expect(reviews["1-0"].verdict).toBe("approved");
      expect(reviews["1-0"].comment).toBe("comment 2");
      // Old key "2-0" gone
      expect(reviews["2-0"]).toBeUndefined();
    });

    it("preserves reviews for PRs before deleted index", async () => {
      // Clear and re-setup
      await deleteJSON(`/api/project/${PROJ}/prs`);
      await setupRekeyProject();

      // Delete last PR (index 2)
      await deleteJSON(`/api/project/${PROJ}/pr/2`);

      const reviews = await getJSON(`/api/project/${PROJ}/reviews`) as Record<string, { verdict: string; comment: string | null }>;
      expect(reviews["0-0"].verdict).toBe("approved");
      expect(reviews["1-0"].verdict).toBe("approved");
      expect(reviews["2-0"]).toBeUndefined();
    });
  });

  // ── Isolation between projects ────────────────────────────────

  describe("project isolation", () => {
    it("PRs in one project do not appear in another", async () => {
      await postJSON("/api/project", { name: "Isolation A", theme: "blue", path: TEST_PROJECT_DIR });
      await postJSON("/api/project", { name: "Isolation B", theme: "red", path: TEST_PROJECT_DIR });

      await postJSON("/api/project/isolation-a/pr", makePR({ title: "Project A PR" }));
      await postJSON("/api/project/isolation-b/pr", makePR({ title: "Project B PR" }));

      const prsA = await getJSON("/api/project/isolation-a/prs") as Array<{ title: string }>;
      const prsB = await getJSON("/api/project/isolation-b/prs") as Array<{ title: string }>;

      expect(prsA).toHaveLength(1);
      expect(prsA[0].title).toBe("Project A PR");
      expect(prsB).toHaveLength(1);
      expect(prsB[0].title).toBe("Project B PR");
    });

    it("reviews in one project do not appear in another", async () => {
      await postJSON("/api/project/isolation-a/review", { idSuffix: "0-0", action: "approved" });
      await postJSON("/api/project/isolation-b/review", { idSuffix: "0-0", action: "rejected" });

      const reviewsA = await getJSON("/api/project/isolation-a/reviews") as Record<string, { verdict: string }>;
      const reviewsB = await getJSON("/api/project/isolation-b/reviews") as Record<string, { verdict: string }>;

      expect(reviewsA["0-0"].verdict).toBe("approved");
      expect(reviewsB["0-0"].verdict).toBe("rejected");
    });

    it("deleting a project does not affect other projects", async () => {
      await deleteJSON("/api/project/isolation-a");

      const prsB = await getJSON("/api/project/isolation-b/prs") as Array<{ title: string }>;
      expect(prsB).toHaveLength(1);
    });
  });

  // ── Backwards compatibility ───────────────────────────────────

  describe("backwards compatibility", () => {
    it("ignores old { prs, reviews } format and returns no projects", async () => {
      if (stopServer) stopServer();

      const oldData = {
        prs: [makePR({ title: "Legacy PR" })],
        reviews: { "0-0": { verdict: "approved", comment: "legacy" } },
      };
      writeFileSync(TEST_DATA, JSON.stringify(oldData, null, 2), "utf-8");

      const mod = await import("../server.ts");
      mod.main();
      stopServer = mod.stop ?? (() => {});

      const projects = await getJSON("/api/projects") as Array<{ id: string; name: string }>;
      expect(projects).toHaveLength(0);
    });

    it("ignores bare array format and returns no projects", async () => {
      if (stopServer) stopServer();

      const oldData = [makePR({ title: "Bare Array PR" })];
      writeFileSync(TEST_DATA, JSON.stringify(oldData, null, 2), "utf-8");

      const mod = await import("../server.ts");
      mod.main();
      stopServer = mod.stop ?? (() => {});

      const projects = await getJSON("/api/projects") as Array<{ id: string; name: string }>;
      expect(projects).toHaveLength(0);
    });
  });
});
