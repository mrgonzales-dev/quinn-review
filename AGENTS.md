# AGENTS.md — AI Development Behavior Rules

This file defines how any AI agent must behave when doing development work in this project.

## Communication Standard — ASD-STE100

All AI-generated text (chat, reports, code comments, documentation, explanations) must obey ASD-STE100 Simplified Technical English rules:

- **Approved words only.** Use the STE100 approved-word list. Do not use synonyms — one word has one meaning (e.g., use "start" not "commence", "show" not "display" unless "display" is the approved verb).
- **IT and computer jargon is permitted.** Technical terms not in the STE100 word list (e.g., "database", "endpoint", "middleware", "module", "template", "test runner", "refactor", "deployment") are allowed and treated as approved nouns/verbs within their domain.
- **Maximum 20 words per sentence.** Break long sentences into two or more.
- **One topic per sentence.** Do not combine unrelated ideas.
- **Active voice only.** Do not use passive voice (e.g., write "the function returns a value" not "a value is returned by the function").
- **Imperative mood for instructions and procedures.** (e.g., "Write test" not "write test".)
- **Present tense for facts and descriptions.** Do not use past tense for procedures.
- **Articles before nouns.** Use "the", "a", or "an" before nouns where applicable.
- **No -ing verb forms for instructions.** (e.g., "Remove file" not "Removing file".)
- **Short words over long words.** If two words mean same thing, use shorter one.
- **No hidden verbs.** (e.g., write "decide" not "make decision", "test" not "perform test".)
- **No redundant pairs.** (e.g., not "each", not "first and foremost".)

## Code Review Preferences

- **Be brutal and thorough.** Double-check code changes, especially when modifying existing patterns. Look for hidden complexity before making changes, not after. When in doubt, ask and confirm.
- **Review all connected files first.** Before planning any change, read every file that touches or depends on code you are about to modify. Trace function calls, imports, shared state, and route handlers. Do not plan change until you have read and understood full chain of affected files.
- **Double-check all connected files after planning.** Once you have plan, re-read connected files to confirm plan does not break existing calculations, return structures, side effects, or assumptions made by callers. If connected file relies on behavior you are about to change, flag it before proceeding.

## Development

- **Use Test Driven Development (TDD).** Write tests before implementation code. Cycle: write test, present to user for review, get approval, write code, run test, fix until passing.
- **Write tests first for every new feature or behavior change.** Tests define expected behavior. Implementation follows tests, not the reverse.
- **One test file per module.** Place test files in `test/` directory. Name file after module it tests (e.g., `test/server.test.ts` tests `server.ts`).
- **Run tests after each change.** Use `bun test`. Do not skip this step.
- **Do not write implementation code without a failing test.** If no test exists for the behavior, write the test first.

## Test Policy

- **Golden rule:** When making tests, maintain 1:1 logic with code being tested. Test must verify exact behavior of code, not approximation.
- **Test-driven development for new modules.** When building new module, write tests first. Tests define expected behavior. Then write code to make tests pass. Cycle is: write test, present to user for review, get approval, write code, run test, fix until passing.
- Use Bun test runner (`bun test`). Follow existing test structure in `test/` directory.
- After writing tests, present them to user for review before running them. Do not run tests until user approves test code.
- Do not edit existing tests unless user explicitly says so.
- Do not run test suite unless user explicitly says so.

## Commit Format

Use Conventional Commits. Every commit message must follow this format:

```
<type>(<scope>): <subject>

<body>
```

### Type

Pick one type per commit:

| Type | Use when |
|------|----------|
| `feat` | New feature or capability added |
| `fix` | Bug fix |
| `refactor` | Code restructure with no behavior change |
| `docs` | Documentation only (README, SKILL.md, CONTRIBUTING.md) |
| `style` | Formatting, whitespace, CSS changes with no logic change |
| `test` | Adding or changing tests |
| `chore` | Build config, dependencies, tooling, gitignore |
| `perf` | Performance improvement |
| `ci` | CI/CD pipeline changes |
| `revert` | Reverting a previous commit |

### Scope

Optional. Use the module or area name: `server`, `mcp`, `render`, `diff`, `styles`, `types`, `skill`, `api`.

### Subject

- Imperative mood: "add tool" not "added tool" or "adds tool".
- Lowercase, no period at end.
- Max 50 characters.
- No emoji.

### Body

- Wrap at 72 characters.
- Explain what changed and why. Not how.
- One change per line, prefixed with `- `.
- Separate subject and body with one blank line.

### Rules

- One logical change per commit. Do not mix features, fixes, and refactors in same commit.
- Never use `--no-verify` to skip hooks.
- Never use `--amend` on pushed commits.
- Stage specific files. Do not use `git add -A`.
- Write commit message with heredoc, not inline flags.

### Examples

```
feat(mcp): add quinn_complete tool

- Add tool definition to ListToolsRequestSchema handler
- Add tool handler to CallToolRequestSchema handler
- Maps to POST /api/complete endpoint on review server
```

```
fix(render): escape file path in diff header

- File paths with HTML characters caused broken rendering
- Pass path through escapeHtml before inserting into template
```

```
docs: update README with MCP setup instructions

- Add MCP server section to getting started guide
- Add .mcp.json to project structure diagram
```

## Explanation and Reporting

- **Always use behavior table.** When explaining or reporting on code, logic, calculations, or comparisons, present information in table format with columns for behavior, condition, and result. Do not use long paragraphs where table communicates same information more clearly.
- **Always include technical explanation and layman explanation.** Every report or explanation must have both. Technical explanation describes code, logic, and data flow. Layman explanation describes what it means in plain language without jargon.
- **Always end with 💡 summary.** At end of both technical section and layman section, add a line that starts with 💡 and summarizes the point. This line must stand alone and make sense without reading rest of section.
