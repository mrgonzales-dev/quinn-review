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
          <button class="project-folder-delete" onclick="event.stopPropagation(); deleteProject('${encodeURIComponent(p.id)}', this)" title="Delete project" aria-label="Delete project">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
          </button>
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
      <div class="div3">
        <button class="div3-instructions-btn" onclick="showLanding()">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          <span>Setup Instructions</span>
        </button>
      </div>
    </div>
    <div class="delete-modal-overlay" id="delete-modal" style="display:none;">
      <div class="delete-modal">
        <div class="delete-modal-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
        </div>
        <h2 class="delete-modal-title">Delete project?</h2>
        <p class="delete-modal-text" id="delete-modal-name"></p>
        <p class="delete-modal-warning">All PRs and reviews in this project will be removed.</p>
        <div class="delete-modal-actions">
          <button class="btn btn-secondary" onclick="cancelDeleteProject()">Cancel</button>
          <button class="btn btn-danger" id="delete-modal-confirm" onclick="confirmDeleteProject()">Delete</button>
        </div>
      </div>
    </div>`;
}
