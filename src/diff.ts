import type { DiffLine } from "./types.ts";

/**
 * Compute a line-level diff between two strings using LCS.
 * Returns DiffLine[] with context, added, and removed lines.
 * Includes up to 3 lines of context around each change.
 */
export function computeDiff(oldContent: string, newContent: string): DiffLine[] {
  const oldLines = oldContent.length > 0 ? oldContent.replace(/\n$/, "").split("\n") : [];
  const newLines = newContent.length > 0 ? newContent.replace(/\n$/, "").split("\n") : [];

  // Build LCS table
  const m = oldLines.length;
  const n = newLines.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));

  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      if (oldLines[i] === newLines[j]) {
        dp[i][j] = dp[i + 1][j + 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i + 1][j], dp[i][j + 1]);
      }
    }
  }

  // Backtrack to produce raw diff (no context yet)
  type RawEntry = { type: "context" | "added" | "removed"; oldIdx: number; newIdx: number; content: string };
  const raw: RawEntry[] = [];
  let i = 0;
  let j = 0;
  while (i < m && j < n) {
    if (oldLines[i] === newLines[j]) {
      raw.push({ type: "context", oldIdx: i, newIdx: j, content: oldLines[i] });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      raw.push({ type: "removed", oldIdx: i, newIdx: j, content: oldLines[i] });
      i++;
    } else {
      raw.push({ type: "added", oldIdx: i, newIdx: j, content: newLines[j] });
      j++;
    }
  }
  while (i < m) {
    raw.push({ type: "removed", oldIdx: i, newIdx: j, content: oldLines[i] });
    i++;
  }
  while (j < n) {
    raw.push({ type: "added", oldIdx: i, newIdx: j, content: newLines[j] });
    j++;
  }

  // Mark which raw entries are changes (non-context)
  const isChange = raw.map(e => e.type !== "context");

  // Determine which context lines to keep (within 3 lines of a change)
  const CONTEXT = 3;
  const keep = new Array(raw.length).fill(false);
  for (let k = 0; k < raw.length; k++) {
    if (isChange[k]) {
      for (let c = Math.max(0, k - CONTEXT); c <= Math.min(raw.length - 1, k + CONTEXT); c++) {
        keep[c] = true;
      }
    }
  }

  // Build final DiffLine[] from kept entries
  const result: DiffLine[] = [];
  for (let k = 0; k < raw.length; k++) {
    const e = raw[k];
    if (!keep[k]) continue;

    // Line numbers come from the raw indices (0-based → 1-based)
    // For context lines: oldIdx and newIdx are both valid
    // For removed lines: oldIdx is valid, newNumber is null
    // For added lines: newIdx is valid, oldNumber is null
    if (e.type === "context") {
      result.push({
        type: "context",
        oldNumber: e.oldIdx + 1,
        newNumber: e.newIdx + 1,
        content: e.content,
      });
    } else if (e.type === "removed") {
      result.push({
        type: "removed",
        oldNumber: e.oldIdx + 1,
        newNumber: null,
        content: e.content,
      });
    } else {
      result.push({
        type: "added",
        oldNumber: null,
        newNumber: e.newIdx + 1,
        content: e.content,
      });
    }
  }

  return result;
}

/**
 * Compute diff for a file that was added (no old content).
 * All lines are "added" with context limited to none.
 */
export function computeAddedDiff(newContent: string): DiffLine[] {
  if (!newContent) return [];
  const lines = newContent.replace(/\n$/, "").split("\n");
  return lines.map((content, idx) => ({
    type: "added" as const,
    oldNumber: null,
    newNumber: idx + 1,
    content,
  }));
}

/**
 * Compute diff for a file that was deleted (no new content).
 * All lines are "removed".
 */
export function computeDeletedDiff(oldContent: string): DiffLine[] {
  if (!oldContent) return [];
  const lines = oldContent.replace(/\n$/, "").split("\n");
  return lines.map((content, idx) => ({
    type: "removed" as const,
    oldNumber: idx + 1,
    newNumber: null,
    content,
  }));
}
