import { describe, it, expect } from "bun:test";
import { mergePrsWithReviews, slugify } from "../src/mcp-server.ts";

type PRData = {
  title: string;
  description: string;
  branch: string;
  label?: string;
  files: Array<{ path: string; additions: number; deletions: number }>;
  completed?: boolean;
};

type Reviews = Record<string, { verdict: string; comment: string | null }>;

// ── slugify ────────────────────────────────────────────────────

describe("slugify", () => {
  it("converts name to lowercase kebab-case", () => {
    expect(slugify("My Cool Project")).toBe("my-cool-project");
  });

  it("removes special characters", () => {
    expect(slugify("My Cool Project!")).toBe("my-cool-project");
  });

  it("handles multiple spaces", () => {
    expect(slugify("My   Spaced   Project")).toBe("my-spaced-project");
  });

  it("handles empty string", () => {
    expect(slugify("")).toBe("");
  });

  it("handles numbers in name", () => {
    expect(slugify("Project 42")).toBe("project-42");
  });

  it("handles leading and trailing spaces", () => {
    expect(slugify("  Trimmed  ")).toBe("trimmed");
  });
});

// ── mergePrsWithReviews ────────────────────────────────────────

describe("mergePrsWithReviews", () => {
  it("returns empty array for no PRs", () => {
    const result = mergePrsWithReviews([], {});
    expect(result).toEqual([]);
  });

  it("marks all files as pending when no reviews exist", () => {
    const prs: PRData[] = [
      {
        title: "PR 1",
        description: "desc",
        branch: "main",
        files: [
          { path: "a.ts", additions: 1, deletions: 0 },
          { path: "b.ts", additions: 2, deletions: 1 },
        ],
      },
    ];
    const result = mergePrsWithReviews(prs, {});
    expect(result).toHaveLength(1);
    expect(result[0].files).toEqual([
      { path: "a.ts", verdict: "pending", comment: null },
      { path: "b.ts", verdict: "pending", comment: null },
    ]);
  });

  it("marks files as approved when review exists", () => {
    const prs: PRData[] = [
      {
        title: "PR 1",
        description: "desc",
        branch: "main",
        files: [
          { path: "a.ts", additions: 1, deletions: 0 },
          { path: "b.ts", additions: 2, deletions: 1 },
        ],
      },
    ];
    const reviews: Reviews = { "0-0": { verdict: "approved", comment: null } };
    const result = mergePrsWithReviews(prs, reviews);
    expect(result[0].files).toEqual([
      { path: "a.ts", verdict: "approved", comment: null },
      { path: "b.ts", verdict: "pending", comment: null },
    ]);
  });

  it("marks files as rejected when review exists", () => {
    const prs: PRData[] = [
      {
        title: "PR 1",
        description: "desc",
        branch: "main",
        files: [
          { path: "a.ts", additions: 1, deletions: 0 },
          { path: "b.ts", additions: 2, deletions: 1 },
        ],
      },
    ];
    const reviews: Reviews = { "0-1": { verdict: "rejected", comment: null } };
    const result = mergePrsWithReviews(prs, reviews);
    expect(result[0].files).toEqual([
      { path: "a.ts", verdict: "pending", comment: null },
      { path: "b.ts", verdict: "rejected", comment: null },
    ]);
  });

  it("handles mixed verdicts across files in one PR", () => {
    const prs: PRData[] = [
      {
        title: "PR 1",
        description: "desc",
        branch: "main",
        files: [
          { path: "a.ts", additions: 1, deletions: 0 },
          { path: "b.ts", additions: 2, deletions: 1 },
          { path: "c.ts", additions: 0, deletions: 3 },
        ],
      },
    ];
    const reviews: Reviews = {
      "0-0": { verdict: "approved", comment: null },
      "0-2": { verdict: "rejected", comment: null },
    };
    const result = mergePrsWithReviews(prs, reviews);
    expect(result[0].files).toEqual([
      { path: "a.ts", verdict: "approved", comment: null },
      { path: "b.ts", verdict: "pending", comment: null },
      { path: "c.ts", verdict: "rejected", comment: null },
    ]);
  });

  it("handles multiple PRs with reviews", () => {
    const prs: PRData[] = [
      {
        title: "PR 1",
        description: "desc",
        branch: "main",
        label: "bugfix",
        files: [{ path: "a.ts", additions: 1, deletions: 0 }],
      },
      {
        title: "PR 2",
        description: "desc",
        branch: "feature",
        label: "feature",
        files: [
          { path: "b.ts", additions: 2, deletions: 1 },
          { path: "c.ts", additions: 0, deletions: 3 },
        ],
      },
    ];
    const reviews: Reviews = {
      "0-0": { verdict: "approved", comment: null },
      "1-0": { verdict: "rejected", comment: null },
      "1-1": { verdict: "approved", comment: null },
    };
    const result = mergePrsWithReviews(prs, reviews);
    expect(result).toHaveLength(2);
    expect(result[0].index).toBe(0);
    expect(result[0].title).toBe("PR 1");
    expect(result[0].label).toBe("bugfix");
    expect(result[0].files).toEqual([{ path: "a.ts", verdict: "approved", comment: null }]);
    expect(result[1].index).toBe(1);
    expect(result[1].title).toBe("PR 2");
    expect(result[1].label).toBe("feature");
    expect(result[1].files).toEqual([
      { path: "b.ts", verdict: "rejected", comment: null },
      { path: "c.ts", verdict: "approved", comment: null },
    ]);
  });

  it("includes completed status", () => {
    const prs: PRData[] = [
      {
        title: "PR 1",
        description: "desc",
        branch: "main",
        files: [{ path: "a.ts", additions: 1, deletions: 0 }],
        completed: true,
      },
    ];
    const result = mergePrsWithReviews(prs, {});
    expect(result[0].completed).toBe(true);
  });

  it("defaults completed to false when not set", () => {
    const prs: PRData[] = [
      {
        title: "PR 1",
        description: "desc",
        branch: "main",
        files: [{ path: "a.ts", additions: 1, deletions: 0 }],
      },
    ];
    const result = mergePrsWithReviews(prs, {});
    expect(result[0].completed).toBe(false);
  });

  it("includes label as null when not set", () => {
    const prs: PRData[] = [
      {
        title: "PR 1",
        description: "desc",
        branch: "main",
        files: [{ path: "a.ts", additions: 1, deletions: 0 }],
      },
    ];
    const result = mergePrsWithReviews(prs, {});
    expect(result[0].label).toBeNull();
  });

  it("ignores reviews for non-existent PR indices", () => {
    const prs: PRData[] = [
      {
        title: "PR 1",
        description: "desc",
        branch: "main",
        files: [{ path: "a.ts", additions: 1, deletions: 0 }],
      },
    ];
    const reviews: Reviews = {
      "5-0": { verdict: "approved", comment: null },
      "99-0": { verdict: "rejected", comment: null },
    };
    const result = mergePrsWithReviews(prs, reviews);
    expect(result[0].files).toEqual([{ path: "a.ts", verdict: "pending", comment: null }]);
  });

  it("includes comment when comment exists for a file", () => {
    const prs: PRData[] = [
      {
        title: "PR 1",
        description: "desc",
        branch: "main",
        files: [
          { path: "a.ts", additions: 1, deletions: 0 },
          { path: "b.ts", additions: 2, deletions: 1 },
        ],
      },
    ];
    const reviews: Reviews = {
      "0-0": { verdict: "rejected", comment: "fix off-by-one" },
      "0-1": { verdict: "approved", comment: null },
    };
    const result = mergePrsWithReviews(prs, reviews);
    expect(result[0].files).toEqual([
      { path: "a.ts", verdict: "rejected", comment: "fix off-by-one" },
      { path: "b.ts", verdict: "approved", comment: null },
    ]);
  });

  it("defaults comment to null when no review entry exists", () => {
    const prs: PRData[] = [
      {
        title: "PR 1",
        description: "desc",
        branch: "main",
        files: [{ path: "a.ts", additions: 1, deletions: 0 }],
      },
    ];
    const reviews: Reviews = { "0-0": { verdict: "approved", comment: null } };
    const result = mergePrsWithReviews(prs, reviews);
    expect(result[0].files[0].comment).toBeNull();
  });

  it("defaults comment to null for pending files", () => {
    const prs: PRData[] = [
      {
        title: "PR 1",
        description: "desc",
        branch: "main",
        files: [{ path: "a.ts", additions: 1, deletions: 0 }],
      },
    ];
    const result = mergePrsWithReviews(prs, {});
    expect(result[0].files[0].comment).toBeNull();
  });
});
