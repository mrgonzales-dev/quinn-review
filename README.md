# Quinn

**Quinn turns AI code proposals into a review page you can understand.**

When an AI agent suggests changes to your code, you want to see exactly what it plans to do before anything gets written. Quinn makes that possible. It takes proposed changes and renders them as a clean, GitHub-style pull request page in your browser. You review the diffs, approve or reject each file, and only the approved changes get applied.

No surprises. No blind trust. Just clear, visual review.

---

## How it works

1. You give the AI a task — anything from "fix the login bug" to "add dark mode."
2. The AI reads your code and figures out what needs to change.
3. Quinn starts a local review server and sends the proposed changes to it.
4. You open `http://localhost:2400` in your browser.
5. You see a sidebar listing each proposed pull request. Click one to view its files.
6. Each file shows a color-coded diff — green for additions, red for deletions.
7. You approve or reject each file individually. Your decisions save automatically.
8. The AI reads your decisions and applies only what you approved.

You stay in control the entire time. Nothing gets written to your project until you say yes.

---

## What you see

- **Sidebar** — Lists every proposed pull request with branch name, file count, and line stats.
- **Diff view** — Side-by-side line numbers with color-coded additions and deletions.
- **File explanations** — Each file includes a short note explaining why the change was made.
- **Approve / Reject buttons** — One click per file. Decisions save instantly.
- **Complete button** — Mark a PR as done when you finish reviewing it.
- **Dark theme** — Easy on the eyes. GitHub-inspired colors throughout.

---

## Getting started

### Prerequisites

You need [Bun](https://bun.sh) installed. If you don't have it:

```bash
curl -fsSL https://bun.sh/install | bash
```

### Install

Clone the repository and install dependencies:

```bash
git clone https://github.com/mrgonzales-dev/quinn-review.git
cd quinn-review
bun install
```

### Run the server

```bash
bun run server.ts
```

Then open `http://localhost:2400` in your browser.

That's it. The server runs locally. No cloud. No account. No data leaves your machine.

### Update

Quinn checks for updates automatically when you open the review page. If a new version is available on GitHub, a yellow badge appears in the sidebar. Click **Update now** to pull the latest changes.

You can also update manually:

```bash
git pull origin main
```

---

## Using Quinn with an AI agent

Quinn is designed to work with AI coding agents like Claude, Cursor, or any tool that can make HTTP requests. The agent follows this flow:

1. Start the review server.
2. Clear any old PRs.
3. Send proposed changes as PR data via the API.
4. Tell you to open the review page.
5. Wait for your review decisions.
6. Apply only the approved changes.

The agent handles all the technical work. You just review and decide.

---

## Project structure

```
quinn-review/
├── server.ts              # Local review server
├── send-pr.ts             # Helper script for sending PRs
├── skills/quinn/SKILL.md  # Full skill documentation for AI agents
├── AGENTS.md              # Agent behavior rules
├── plugin.json            # Agent auto-discovery manifest
├── .mcp.json              # MCP server config
├── package.json           # Project metadata
├── src/
│   ├── render-page.ts     # Full HTML page renderer
│   ├── render-sidebar.ts  # Sidebar with PR list
│   ├── render-file.ts     # File card with diff
│   ├── render-diff.ts     # Diff table renderer
│   ├── styles.ts          # All CSS styles
│   ├── types.ts           # TypeScript types
│   ├── escape.ts          # HTML escaping utility
│   └── quinn-logo.png     # Quinn logo
└── pr-data.json           # Runtime data (auto-created, gitignored)
```

---

## Why Quinn?

Code review exists for a reason. When someone proposes changes, you want to see them before they land. AI agents are no different. Quinn brings that same review workflow to AI-generated code.

Instead of trusting the AI to make changes directly, you get a visual checkpoint. You catch mistakes. You reject bad ideas. You approve the good stuff. The AI becomes a collaborator, not a loose cannon.

---

## License

MIT
