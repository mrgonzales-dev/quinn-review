import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { writeFileSync, existsSync, unlinkSync, mkdirSync, rmSync, readdirSync } from "node:fs";
import { resolve, join } from "node:path";
import { slugify, validateFile, validatePR, getReportsDir, writeReport, listReportFiles, readReportContent } from "../src/generate-report.ts";
import { renderReport } from "../src/render/render-report.ts";
import type { PRData, PRFile } from "../src/types.ts";
import { computeDiff, computeAddedDiff, computeDeletedDiff } from "../src/diff.ts";

const TEST_PROJECT_DIR = resolve(import.meta.dir, "test-project");

function cleanupProject(): void {
  if (existsSync(TEST_PROJECT_DIR)) rmSync(TEST_PROJECT_DIR, { recursive: true, force: true });
}

function setupProject(): void {
  cleanupProject();
  mkdirSync(TEST_PROJECT_DIR, { recursive: true });
  mkdirSync(resolve(TEST_PROJECT_DIR, "src"), { recursive: true });
  writeFileSync(resolve(TEST_PROJECT_DIR, "src", "main.ts"), "const x = 1;\nconst y = 2;\n", "utf-8");
  writeFileSync(resolve(TEST_PROJECT_DIR, "src", "utils.ts"), "export function add(a, b) {\n  return a + b;\n}\n", "utf-8");
}

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

// ── validateFile ───────────────────────────────────────────────

describe("validateFile", () => {
  beforeAll(setupProject);
  afterAll(cleanupProject);

  it("accepts a valid added file with content", () => {
    const file = {
      path: "src/new.ts",
      status: "added",
      content: "const z = 3;\n",
      explanation: "Add new file",
    };
    expect(validateFile(file, TEST_PROJECT_DIR)).toBeNull();
  });

  it("rejects file without path", () => {
    const file = { status: "added", content: "x", explanation: "test" };
    expect(validateFile(file, TEST_PROJECT_DIR)).toBe("File path must be a non-empty string");
  });

  it("rejects file with invalid status", () => {
    const file = { path: "a.ts", status: "unknown", content: "x", explanation: "test" };
    expect(validateFile(file, TEST_PROJECT_DIR)).toBe("File status must be 'added', 'modified', or 'deleted'");
  });

  it("rejects file without explanation", () => {
    const file = { path: "a.ts", status: "added", content: "x" };
    expect(validateFile(file, TEST_PROJECT_DIR)).toBe("File explanation must be a non-empty string");
  });

  it("rejects file with neither content nor edits", () => {
    const file = { path: "a.ts", status: "added", explanation: "test" };
    expect(validateFile(file, TEST_PROJECT_DIR)).toBe("File must have a 'content' string or an 'edits' array");
  });

  it("rejects file with both content and edits", () => {
    const file = {
      path: "src/main.ts",
      status: "modified",
      content: "x",
      edits: [{ search: "a", replace: "b" }],
      explanation: "test",
    };
    expect(validateFile(file, TEST_PROJECT_DIR)).toBe("File must have 'content' or 'edits', not both");
  });

  it("rejects edits on added file", () => {
    const file = {
      path: "src/new.ts",
      status: "added",
      edits: [{ search: "a", replace: "b" }],
      explanation: "test",
    };
    expect(validateFile(file, TEST_PROJECT_DIR)).toBe("Cannot use 'edits' with status 'added' — use 'content' instead");
  });

  it("rejects edits on deleted file", () => {
    const file = {
      path: "src/main.ts",
      status: "deleted",
      edits: [{ search: "a", replace: "b" }],
      explanation: "test",
    };
    expect(validateFile(file, TEST_PROJECT_DIR)).toBe("Cannot use 'edits' with status 'deleted' — use 'content' instead");
  });

  it("rejects edits on non-existent file", () => {
    const file = {
      path: "src/nonexistent.ts",
      status: "modified",
      edits: [{ search: "a", replace: "b" }],
      explanation: "test",
    };
    expect(validateFile(file, TEST_PROJECT_DIR)).toContain("file does not exist in project directory");
  });

  it("applies edits and computes diff for modified file", () => {
    const file = {
      path: "src/main.ts",
      status: "modified",
      edits: [{ search: "const x = 1;", replace: "const x = 42;" }],
      explanation: "Change x value",
    };
    expect(validateFile(file, TEST_PROJECT_DIR)).toBeNull();
    expect(file.content).toBe("const x = 42;\nconst y = 2;\n");
    expect(file.additions).toBe(1);
    expect(file.deletions).toBe(1);
  });

  it("rejects edit with search string not found", () => {
    const file = {
      path: "src/main.ts",
      status: "modified",
      edits: [{ search: "NONEXISTENT", replace: "x" }],
      explanation: "test",
    };
    expect(validateFile(file, TEST_PROJECT_DIR)).toContain("search string not found");
  });

  it("rejects edit with non-unique search string", () => {
    writeFileSync(resolve(TEST_PROJECT_DIR, "src", "dup.ts"), "line\nline\n", "utf-8");
    const file = {
      path: "src/dup.ts",
      status: "modified",
      edits: [{ search: "line", replace: "other" }],
      explanation: "test",
    };
    expect(validateFile(file, TEST_PROJECT_DIR)).toContain("must be unique");
  });

  it("computes diff for deleted file", () => {
    const file = {
      path: "src/utils.ts",
      status: "deleted",
      content: "",
      explanation: "Remove utils",
    };
    expect(validateFile(file, TEST_PROJECT_DIR)).toBeNull();
    expect(file.deletions).toBeGreaterThan(0);
  });

  it("rejects deleted file that does not exist on disk", () => {
    const file = {
      path: "src/nonexistent.ts",
      status: "deleted",
      content: "",
      explanation: "test",
    };
    expect(validateFile(file, TEST_PROJECT_DIR)).toContain("file does not exist in project directory");
  });

  it("treats modified file without disk file as added", () => {
    const file = {
      path: "src/brand-new.ts",
      status: "modified",
      content: "const z = 99;\n",
      explanation: "New file",
    };
    expect(validateFile(file, TEST_PROJECT_DIR)).toBeNull();
    expect(file.status).toBe("added");
  });

  it("rejects file with empty diff (identical content)", () => {
    const file = {
      path: "src/main.ts",
      status: "modified",
      content: "const x = 1;\nconst y = 2;\n",
      explanation: "No change",
    };
    expect(validateFile(file, TEST_PROJECT_DIR)).toContain("diff is empty");
  });
});

// ── validatePR ─────────────────────────────────────────────────

describe("validatePR", () => {
  beforeAll(setupProject);
  afterAll(cleanupProject);

  it("accepts a valid PR", () => {
    const pr = {
      title: "Test PR",
      description: "Test description",
      branch: "test-branch",
      files: [
        {
          path: "src/new.ts",
          status: "added",
          content: "const z = 3;\n",
          explanation: "Add new file",
        },
      ],
    };
    expect(validatePR(pr, TEST_PROJECT_DIR)).toBeNull();
  });

  it("rejects PR without title", () => {
    const pr = { description: "d", branch: "b", files: [] };
    expect(validatePR(pr, TEST_PROJECT_DIR)).toBe("PR title must be a non-empty string");
  });

  it("rejects PR without description", () => {
    const pr = { title: "t", branch: "b", files: [] };
    expect(validatePR(pr, TEST_PROJECT_DIR)).toBe("PR description must be a non-empty string");
  });

  it("rejects PR without branch", () => {
    const pr = { title: "t", description: "d", files: [] };
    expect(validatePR(pr, TEST_PROJECT_DIR)).toBe("PR branch must be a non-empty string");
  });

  it("rejects PR with empty files array", () => {
    const pr = { title: "t", description: "d", branch: "b", files: [] };
    expect(validatePR(pr, TEST_PROJECT_DIR)).toBe("PR files must be a non-empty array");
  });

  it("rejects PR with duplicate file paths", () => {
    const pr = {
      title: "t",
      description: "d",
      branch: "b",
      files: [
        { path: "src/a.ts", status: "added", content: "x", explanation: "e" },
        { path: "src/a.ts", status: "added", content: "y", explanation: "e" },
      ],
    };
    expect(validatePR(pr, TEST_PROJECT_DIR)).toBe("Duplicate file path: src/a.ts");
  });

  it("rejects PR with invalid file inside", () => {
    const pr = {
      title: "t",
      description: "d",
      branch: "b",
      files: [
        { path: "", status: "added", content: "x", explanation: "e" },
      ],
    };
    expect(validatePR(pr, TEST_PROJECT_DIR)).toContain("File 0");
  });

  it("accepts optional label", () => {
    const pr = {
      title: "t",
      description: "d",
      branch: "b",
      label: "bugfix",
      files: [
        { path: "src/new.ts", status: "added", content: "x", explanation: "e" },
      ],
    };
    expect(validatePR(pr, TEST_PROJECT_DIR)).toBeNull();
  });

  it("rejects non-string label", () => {
    const pr = {
      title: "t",
      description: "d",
      branch: "b",
      label: 123,
      files: [
        { path: "src/new.ts", status: "added", content: "x", explanation: "e" },
      ],
    };
    expect(validatePR(pr, TEST_PROJECT_DIR)).toBe("PR label must be a string");
  });
});

// ── renderReport ───────────────────────────────────────────────

describe("renderReport", () => {
  it("generates valid HTML with PR title", () => {
    const diff = computeAddedDiff("const x = 1;\n");
    const pr: PRData = {
      title: "Add new feature",
      description: "This PR adds a new feature.",
      branch: "ai-proposal/add-feature",
      label: "feature",
      files: [
        {
          path: "src/feature.ts",
          status: "added",
          additions: 1,
          deletions: 0,
          diff,
          explanation: "Add feature file",
        },
      ],
    };
    const html = renderReport(pr, "2026-01-01 12:00:00");
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("Add new feature");
    expect(html).toContain("ai-proposal/add-feature");
    expect(html).toContain("feature");
    expect(html).toContain("src/feature.ts");
    expect(html).toContain("Add feature file");
    expect(html).toContain("Generated by Quinn");
  });

  it("generates HTML without label when label is absent", () => {
    const diff = computeAddedDiff("const x = 1;\n");
    const pr: PRData = {
      title: "Fix bug",
      description: "Fix a bug.",
      branch: "fix/bug",
      files: [
        {
          path: "src/fix.ts",
          status: "added",
          additions: 1,
          deletions: 0,
          diff,
          explanation: "Fix",
        },
      ],
    };
    const html = renderReport(pr, "2026-01-01");
    expect(html).not.toContain('class="pr-label"');
  });

  it("includes diff lines in output", () => {
    const oldContent = "const x = 1;\n";
    const newContent = "const x = 2;\n";
    const diff = computeDiff(oldContent, newContent);
    const pr: PRData = {
      title: "Change x",
      description: "Change x value.",
      branch: "fix/x",
      files: [
        {
          path: "src/main.ts",
          status: "modified",
          additions: 1,
          deletions: 1,
          diff,
          explanation: "Update x",
        },
      ],
    };
    const html = renderReport(pr, "2026-01-01");
    expect(html).toContain("diff-line-added");
    expect(html).toContain("diff-line-removed");
  });

  it("includes total additions and deletions in summary", () => {
    const diff1 = computeAddedDiff("line1\nline2\n");
    const pr: PRData = {
      title: "Add file",
      description: "Add a file.",
      branch: "add/file",
      files: [
        {
          path: "src/a.ts",
          status: "added",
          additions: 2,
          deletions: 0,
          diff: diff1,
          explanation: "New file",
        },
      ],
    };
    const html = renderReport(pr, "2026-01-01");
    expect(html).toContain("+2");
    expect(html).toContain("-0");
  });

  it("escapes HTML in file content", () => {
    const diff = computeAddedDiff("const x = '<script>alert(1)</script>';\n");
    const pr: PRData = {
      title: "Test",
      description: "Test.",
      branch: "test",
      files: [
        {
          path: "src/x.ts",
          status: "added",
          additions: 1,
          deletions: 0,
          diff,
          explanation: "Test",
        },
      ],
    };
    const html = renderReport(pr, "2026-01-01");
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;");
  });
});

// ── project-scoped reports directory ───────────────────────────

describe("project-scoped reports directory", () => {
  const TEST_REPORTS_PROJECT = resolve(import.meta.dir, "test-reports-project");

  function makePR(): PRData {
    const diff = computeAddedDiff("const x = 1;\n");
    return {
      title: "Test Report",
      description: "Test description.",
      branch: "test-branch",
      files: [
        {
          path: "src/main.ts",
          status: "added",
          additions: 1,
          deletions: 0,
          diff,
          explanation: "Test file",
        },
      ],
    };
  }

  beforeAll(() => {
    cleanupProject();
    mkdirSync(TEST_REPORTS_PROJECT, { recursive: true });
  });

  afterAll(() => {
    if (existsSync(TEST_REPORTS_PROJECT)) {
      rmSync(TEST_REPORTS_PROJECT, { recursive: true, force: true });
    }
  });

  it("getReportsDir uses projectPath when provided", () => {
    const dir = getReportsDir(TEST_REPORTS_PROJECT);
    expect(dir).toBe(resolve(TEST_REPORTS_PROJECT, "reports"));
  });

  it("getReportsDir falls back to process.cwd() when projectPath is absent", () => {
    const dir = getReportsDir(undefined);
    expect(dir).toBe(resolve(process.cwd(), "reports"));
  });

  it("writeReport writes to projectPath/reports/", () => {
    const pr = makePR();
    const result = writeReport(pr, TEST_REPORTS_PROJECT);
    expect(result.path).toContain(TEST_REPORTS_PROJECT);
    expect(existsSync(result.path)).toBe(true);
  });

  it("listReportFiles lists reports from projectPath", () => {
    const pr = makePR();
    writeReport(pr, TEST_REPORTS_PROJECT);
    const files = listReportFiles(TEST_REPORTS_PROJECT);
    expect(files.length).toBeGreaterThan(0);
    expect(files.every(f => f.endsWith(".html"))).toBe(true);
  });

  it("readReportContent reads from projectPath", () => {
    const pr = makePR();
    const result = writeReport(pr, TEST_REPORTS_PROJECT);
    const content = readReportContent(result.filename, TEST_REPORTS_PROJECT);
    expect(content).not.toBeNull();
    expect(content).toContain("<!DOCTYPE html>");
  });

  it("readReportContent returns null for missing file in projectPath", () => {
    const content = readReportContent("nonexistent.html", TEST_REPORTS_PROJECT);
    expect(content).toBeNull();
  });

  it("listReportFiles returns empty array for project with no reports dir", () => {
    const emptyProject = resolve(import.meta.dir, "test-empty-project");
    if (existsSync(emptyProject)) rmSync(emptyProject, { recursive: true, force: true });
    mkdirSync(emptyProject, { recursive: true });
    const files = listReportFiles(emptyProject);
    expect(files).toEqual([]);
    rmSync(emptyProject, { recursive: true, force: true });
  });
});

// ── CLI integration ───────────────────────────────────────────

describe("CLI integration", () => {
  const CLI_PROJECT = resolve(import.meta.dir, "test-cli-project");
  const SCRIPT = resolve(import.meta.dir, "..", "src", "generate-report.ts");

  beforeAll(() => {
    if (existsSync(CLI_PROJECT)) rmSync(CLI_PROJECT, { recursive: true, force: true });
    mkdirSync(CLI_PROJECT, { recursive: true });
    mkdirSync(resolve(CLI_PROJECT, "src"), { recursive: true });
    writeFileSync(resolve(CLI_PROJECT, "src", "main.ts"), "const x = 1;\n", "utf-8");
  });

  afterAll(() => {
    if (existsSync(CLI_PROJECT)) rmSync(CLI_PROJECT, { recursive: true, force: true });
  });

  function runCli(jsonStr: string): { exitCode: number; stdout: string; stderr: string } {
    const escaped = jsonStr.replace(/'/g, "'\\''");
    const proc = Bun.spawnSync(["sh", "-c", `printf '%s' '${escaped}' | bun run '${SCRIPT}'`], {
      stdout: "pipe",
      stderr: "pipe",
    });
    return {
      exitCode: proc.exitCode,
      stdout: proc.stdout.toString().trim(),
      stderr: proc.stderr.toString(),
    };
  }

  it("generates a report from stdin JSON and prints the path", () => {
    const prJson = JSON.stringify({
      projectPath: CLI_PROJECT,
      title: "CLI Test PR",
      description: "Test the CLI entry point.",
      branch: "test/cli",
      files: [
        {
          path: "src/main.ts",
          status: "modified",
          edits: [{ search: "const x = 1;", replace: "const x = 42;" }],
          explanation: "Update x value",
        },
      ],
    });

    const result = runCli(prJson);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain(CLI_PROJECT);
    expect(result.stdout).toContain(".html");
    expect(existsSync(result.stdout)).toBe(true);
  });

  it("exits with error on empty stdin", () => {
    const result = runCli("");
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("No input provided");
  });

  it("exits with error on invalid JSON", () => {
    const result = runCli("not json");
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("Invalid JSON");
  });

  it("exits with error on validation failure", () => {
    const prJson = JSON.stringify({
      projectPath: CLI_PROJECT,
      title: "",
      description: "d",
      branch: "b",
      files: [
        { path: "src/main.ts", status: "added", content: "x", explanation: "e" },
      ],
    });

    const result = runCli(prJson);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("Validation error");
  });
});
