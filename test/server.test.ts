import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { readFileSync, writeFileSync, existsSync, unlinkSync } from "node:fs";
import { resolve, dirname } from "node:path";

const TEST_PORT = 2499;
const TEST_DATA = resolve(import.meta.dir, "test-pr-data.json");
const TEST_REVIEWS = resolve(dirname(TEST_DATA), "reviews.json");

// Clean up test files before and after
function cleanup(): void {
  if (existsSync(TEST_DATA)) unlinkSync(TEST_DATA);
  if (existsSync(TEST_REVIEWS)) unlinkSync(TEST_REVIEWS);
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

// Minimal valid PR without additions/deletions fields
function makePR(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    title: "Test PR",
    description: "Test description",
    branch: "test-branch",
    files: [
      {
        path: "src/main.ts",
        status: "modified",
        diff: [
          { type: "context", oldNumber: 1, newNumber: 1, content: "import { foo } from 'bar';" },
          { type: "removed", oldNumber: 2, newNumber: null, content: "const x = 1;" },
          { type: "added", oldNumber: null, newNumber: 2, content: "const x = 2;" },
        ],
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
    process.env.QUINN_PORT = String(TEST_PORT);
    process.env.QUINN_DATA = TEST_DATA;
    // Import server module and start it explicitly
    const mod = await import("../server.ts");
    mod.main();
    stopServer = mod.stop ?? (() => {});
  });

  afterAll(() => {
    if (stopServer) stopServer();
    cleanup();
  });

  describe("health check", () => {
    it("GET /api/health returns ok status", async () => {
      const result = await getJSON("/api/health") as { ok: boolean; prs: number };
      expect(result.ok).toBe(true);
      expect(result.prs).toBe(0);
    });
  });

  describe("POST /api/pr — auto-compute additions/deletions", () => {
    it("accepts PR without additions/deletions fields", async () => {
      const result = await postJSON("/api/pr", makePR()) as { ok: boolean; index: number };
      expect(result.ok).toBe(true);
      expect(result.index).toBe(0);
    });

    it("computes additions from diff array", async () => {
      const pr = await getJSON("/api/pr/0") as { files: Array<{ additions: number; deletions: number }> };
      expect(pr.files[0].additions).toBe(1);
    });

    it("computes deletions from diff array", async () => {
      const pr = await getJSON("/api/pr/0") as { files: Array<{ additions: number; deletions: number }> };
      expect(pr.files[0].deletions).toBe(1);
    });

    it("computes correct counts for multi-line diffs", async () => {
      const pr = makePR({
        title: "Multi-line PR",
        files: [
          {
            path: "src/utils.ts",
            status: "modified",
            diff: [
              { type: "context", oldNumber: 1, newNumber: 1, content: "line 1" },
              { type: "added", oldNumber: null, newNumber: 2, content: "new line a" },
              { type: "added", oldNumber: null, newNumber: 3, content: "new line b" },
              { type: "added", oldNumber: null, newNumber: 4, content: "new line c" },
              { type: "removed", oldNumber: 2, newNumber: null, content: "old line a" },
              { type: "removed", oldNumber: 3, newNumber: null, content: "old line b" },
              { type: "context", oldNumber: 4, newNumber: 5, content: "line 4" },
            ],
            explanation: "Multiple changes",
          },
        ],
      });
      const result = await postJSON("/api/pr", pr) as { ok: boolean; index: number };
      expect(result.ok).toBe(true);

      const stored = await getJSON(`/api/pr/${result.index}`) as { files: Array<{ additions: number; deletions: number }> };
      expect(stored.files[0].additions).toBe(3);
      expect(stored.files[0].deletions).toBe(2);
    });

    it("still accepts PR with explicit additions/deletions (backwards compat)", async () => {
      const pr = makePR({
        title: "Explicit counts PR",
        files: [
          {
            path: "src/legacy.ts",
            status: "modified",
            additions: 1,
            deletions: 1,
            diff: [
              { type: "context", oldNumber: 1, newNumber: 1, content: "line 1" },
              { type: "removed", oldNumber: 2, newNumber: null, content: "old" },
              { type: "added", oldNumber: null, newNumber: 2, content: "new" },
            ],
            explanation: "Legacy with explicit counts",
          },
        ],
      });
      const result = await postJSON("/api/pr", pr) as { ok: boolean };
      expect(result.ok).toBe(true);
    });

    it("rejects PR with wrong explicit additions count", async () => {
      const pr = makePR({
        title: "Wrong counts PR",
        files: [
          {
            path: "src/bad.ts",
            status: "modified",
            additions: 5,
            deletions: 1,
            diff: [
              { type: "context", oldNumber: 1, newNumber: 1, content: "line 1" },
              { type: "removed", oldNumber: 2, newNumber: null, content: "old" },
              { type: "added", oldNumber: null, newNumber: 2, content: "new" },
            ],
            explanation: "Bad counts",
          },
        ],
      });
      const result = await postJSON("/api/pr", pr) as { error: string };
      expect(result.error).toContain("additions");
    });
  });

  describe("DELETE /api/pr/:index — single PR deletion", () => {
    it("deletes a PR by index", async () => {
      // Add a PR to delete
      const addResult = await postJSON("/api/pr", makePR({ title: "To Delete" })) as { index: number };
      const idx = addResult.index;

      const delResult = await deleteJSON(`/api/pr/${idx}`) as { ok: boolean; total: number };
      expect(delResult.ok).toBe(true);

      // Verify it's gone
      const prResult = await getJSON(`/api/pr/${idx}`) as { error: string };
      expect(prResult.error).toContain("out of range");
    });

    it("returns error for out-of-range index", async () => {
      const result = await deleteJSON("/api/pr/999") as { error: string };
      expect(result.error).toContain("out of range");
    });
  });

  describe("GET /api/pr/:index — single PR retrieval", () => {
    it("returns full PR content by index", async () => {
      const addResult = await postJSON("/api/pr", makePR({ title: "Get This PR" })) as { index: number };
      const idx = addResult.index;

      const pr = await getJSON(`/api/pr/${idx}`) as {
        title: string;
        description: string;
        branch: string;
        files: Array<{ path: string; diff: unknown[]; explanation: string }>;
      };
      expect(pr.title).toBe("Get This PR");
      expect(pr.description).toBe("Test description");
      expect(pr.branch).toBe("test-branch");
      expect(pr.files[0].path).toBe("src/main.ts");
      expect(pr.files[0].diff.length).toBe(3);
      expect(pr.files[0].explanation).toBe("Changed x from 1 to 2");
    });

    it("returns error for out-of-range index", async () => {
      const result = await getJSON("/api/pr/999") as { error: string };
      expect(result.error).toContain("out of range");
    });
  });

  describe("PUT /api/pr/:index — update PR", () => {
    it("replaces PR content and clears reviews", async () => {
      const addResult = await postJSON("/api/pr", makePR({ title: "Original" })) as { index: number };
      const idx = addResult.index;

      // Add a review for a file
      await postJSON("/api/review", { idSuffix: `${idx}-0`, action: "approved" });

      // Update the PR
      const updated = makePR({ title: "Updated Title" });
      const putResult = await putJSON(`/api/pr/${idx}`, updated) as { ok: boolean; reviewsCleared: number };
      expect(putResult.ok).toBe(true);
      expect(putResult.reviewsCleared).toBe(1);

      // Verify title changed
      const pr = await getJSON(`/api/pr/${idx}`) as { title: string };
      expect(pr.title).toBe("Updated Title");

      // Verify review was cleared
      const reviews = await getJSON("/api/reviews") as Record<string, string>;
      expect(reviews[`${idx}-0`]).toBeUndefined();
    });
  });

  describe("POST /api/prs/batch — batch with auto-compute", () => {
    it("accepts batch PRs without additions/deletions", async () => {
      const batch = [
        makePR({ title: "Batch PR 1" }),
        makePR({ title: "Batch PR 2" }),
      ];
      const result = await postJSON("/api/prs/batch", batch) as { ok: boolean; count: number };
      expect(result.ok).toBe(true);
      expect(result.count).toBe(2);
    });
  });
});
