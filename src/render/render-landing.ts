export function renderLanding(mcpPath: string): string {
  return `    <div class="landing-overlay" id="landing-overlay">
      <div class="landing-modal">
        <img src="/quinn-logo.png" alt="Quinn" class="landing-logo" />
        <h1 class="landing-title">Welcome to Quinn</h1>
        <p class="landing-subtitle">AI code review — see proposed changes before they land</p>

        <div class="landing-steps">
          <div class="landing-step">
            <span class="landing-step-num">1</span>
            <div class="landing-step-content">
              <div class="landing-step-title">Install Bun</div>
              <div class="landing-step-desc">Quinn runs on the Bun runtime. Install it if you do not have it.</div>
              <div class="landing-code" onclick="copyLandingCode(this)">curl -fsSL https://bun.sh/install | bash<span class="copy-hint">click to copy</span></div>
            </div>
          </div>

          <div class="landing-step">
            <span class="landing-step-num">2</span>
            <div class="landing-step-content">
              <div class="landing-step-title">Start the review server</div>
              <div class="landing-step-desc">Start Quinn with one command. The review server and MCP server both start together. The web UI opens at localhost:2400.</div>
              <div class="landing-code" onclick="copyLandingCode(this)">bun run server.ts<span class="copy-hint">click to copy</span></div>
            </div>
          </div>

          <div class="landing-step">
            <span class="landing-step-num">3</span>
            <div class="landing-step-content">
              <div class="landing-step-title">Connect your AI agent</div>
              <div class="landing-step-desc">Agents that support .mcp.json auto-detection (Claude Code, Cursor, Windsurf) will find Quinn automatically — just open this project. For manual setup, add this to your agent MCP config:</div>
              <div class="landing-code landing-code-block" onclick="copyLandingCode(this)">{
  "mcpServers": {
    "quinn": {
      "command": "bun",
      "args": ["run", "${mcpPath}"]
    }
  }
}<span class="copy-hint">click to copy</span></div>
            </div>
          </div>

          <div class="landing-step">
            <span class="landing-step-num">4</span>
            <div class="landing-step-content">
              <div class="landing-step-title">Give the agent a task</div>
              <div class="landing-step-desc">Ask your AI agent to make changes. The agent sends proposed PRs to this server. They appear here for your review.</div>
            </div>
          </div>

          <div class="landing-step">
            <span class="landing-step-num">5</span>
            <div class="landing-step-content">
              <div class="landing-step-title">Review and decide</div>
              <div class="landing-step-desc">Approve or reject each file. The agent applies only what you approve. Nothing gets written until you say yes.</div>
            </div>
          </div>
        </div>

        <div class="landing-waiting">
          <span class="landing-spinner"></span>
          <span>Waiting for the agent to send proposed changes...</span>
        </div>
      </div>
    </div>`;
}
