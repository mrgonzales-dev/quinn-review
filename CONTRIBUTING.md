# Contributing to Quinn

Thanks for your interest in Quinn. This project is open source and welcomes contributions of all kinds.

## Ways to contribute

- **Report bugs** — Open an issue with steps to reproduce.
- **Suggest features** — Open an issue and describe the problem you want to solve.
- **Improve the UI** — The review page is rendered from `src/render-*.ts` files. All CSS lives in `src/styles.ts`.
- **Add MCP tools** — `src/mcp-server.ts` defines the tools agents can call. Each tool maps to an HTTP endpoint on the review server.
- **Fix bugs** — Pick an open issue and submit a pull request.

## Setup

1. Install [Bun](https://bun.sh).
2. Clone the repo.
3. Install dependencies:

```bash
bun install
```

4. Start the review server:

```bash
bun run server.ts
```

5. Open `http://localhost:2400`.

## Code style

- TypeScript throughout. No build step — Bun runs `.ts` files directly.
- Keep functions small and focused.
- Follow the existing patterns in `src/` for rendering and escaping.
- All HTML output must pass through `escapeHtml` from `src/escape.ts` to prevent XSS.

## Pull requests

1. Fork the repo and create a branch from `main`.
2. Make your changes.
3. Test locally — start the server and send a test PR using `send-pr.ts`.
4. Open a pull request with a clear description of what changed and why.

## MCP tools

If you add a new MCP tool in `src/mcp-server.ts`:

1. Add the tool definition to the `tools/list` handler.
2. Add the tool handler to the `tools/call` handler.
3. Document the tool in `skills/quinn/SKILL.md`.
4. Make sure it maps to an existing HTTP endpoint on the review server.

## Project structure

```
server.ts              # HTTP review server (port 2400)
send-pr.ts             # Helper script for sending test PRs
src/
  mcp-server.ts        # MCP server (stdio transport)
  render-page.ts       # Full HTML page
  render-sidebar.ts    # PR list sidebar
  render-file.ts       # File card with diff
  render-diff.ts       # Diff table
  styles.ts            # All CSS
  types.ts             # TypeScript types
  escape.ts            # HTML escaping
skills/quinn/SKILL.md  # Skill documentation for AI agents
```

## Questions

Open an issue on [GitHub](https://github.com/mrgonzales-dev/quinn-review/issues).
