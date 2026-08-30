import type { Project } from "../types.ts";
import { escapeHtml } from "../escape.ts";

const THEME_COLORS: Record<string, string> = {
  blue: "#58a6ff",
  green: "#7ee787",
  purple: "#bc8cff",
  orange: "#ffa657",
  red: "#ff8182",
  teal: "#39c5cf",
};

function folderIcon(color: string): string {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
    <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z"/>
  </svg>`;
}

export function renderProjects(projects: Project[]): string {
  const hasProjects = projects.length > 0;

  const folders = hasProjects
    ? projects.map(p => {
        const color = THEME_COLORS[p.theme] ?? THEME_COLORS.blue;
        const prLabel = p.prs.length === 1 ? "PR" : "PRs";
        return `        <div class="project-folder theme-${p.theme}" onclick="window.location.href='/?project=${encodeURIComponent(p.id)}'">
          <div class="project-folder-icon">${folderIcon(color)}</div>
          <div class="project-folder-name">${escapeHtml(p.name)}</div>
          <div class="project-folder-meta">${p.prs.length} ${prLabel}</div>
        </div>`;
      }).join("\n")
    : `        <div class="projects-empty">No projects yet. Send a PR from your AI agent to get started.</div>`;

  return `    <div class="parent">
      <div class="div1 hero">
        <img src="/quinn-logo.png" alt="Quinn" class="hero-logo" />
        <div class="hero-text">
          <h1 class="hero-title">Quinn</h1>
          <p class="hero-subtitle">AI code review — see proposed changes before they land</p>
        </div>
        <span class="hero-badge">${projects.length} project${projects.length === 1 ? "" : "s"}</span>
      </div>
      <div class="div2 project-browser">
        <div class="project-browser-header">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z"/></svg>
          Projects
        </div>
        <div class="project-browser-grid">
${folders}
        </div>
      </div>
      <div class="div3">Reserved</div>
    </div>`;
}
