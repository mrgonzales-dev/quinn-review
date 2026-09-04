# Contributing to Quinn

Thanks for your interest in Quinn. This project is open source and welcomes contributions of all kinds.

## Ways to contribute

- **Report bugs** — Open an issue with steps to reproduce.
- **Suggest features** — Open an issue and describe the problem you want to solve.
- **Improve the UI** — The report page is rendered from `src/render/` files. All CSS lives in `src/styles.ts`.
- **Improve the CLI** — `src/generate-report.ts` handles stdin input, validation, diff computation, and report writing.
- **Fix bugs** — Pick an open issue and submit a pull request.

## Setup

1. Install [Bun](https://bun.sh).
2. Clone the repo.
3. Test the CLI:

```bash
echo '{"projectPath":".","title":"Test","description":"Test","branch":"test","files":[{"path":"src/test.ts","status":"added","content":"const x = 1;\n","explanation":"test"}]}' | bun run src/generate-report.ts
```

## Code style

- TypeScript throughout. No build step — Bun runs `.ts` files directly.
- Keep functions small and focused.
- Follow the existing patterns in `src/` for rendering and escaping.
- All HTML output must pass through `escapeHtml` from `src/escape.ts` to prevent XSS.

## Pull requests

1. Fork the repo and create a branch from `main`.
2. Make your changes.
3. Test locally — run `bun test` and pipe a test PR JSON to the CLI.
4. Open a pull request with a clear description of what changed and why.

## CLI

If you add new CLI features in `src/generate-report.ts`:

1. Add the logic to the appropriate function.
2. Document the feature in `skills/quinn/SKILL.md`.
3. Add tests in `test/generate-report.test.ts`.
4. Run `bun test` to confirm all tests pass.

## Project structure

```
src/
  generate-report.ts   # CLI entry point (stdin → report → stdout)
  diff.ts              # LCS-based line diff computation
  types.ts             # TypeScript types
  styles.ts            # All CSS
  escape.ts            # HTML escaping
  render/
    render-report.ts   # Full HTML report renderer
    render-diff.ts     # Diff table renderer
skills/quinn/SKILL.md  # Skill documentation for AI agents
test/generate-report.test.ts  # Test suite
```

## Questions

Open an issue on [GitHub](https://github.com/mrgonzales-dev/quinn-review/issues).
