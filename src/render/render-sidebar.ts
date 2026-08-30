import type { PRData, Project } from "../types.ts";
import { escapeHtml } from "../escape.ts";

export function renderSidebar(project: Project, allProjects: Project[]): string {
  const items = project.prs
    .map((pr, index) => {
      const totalAdditions = pr.files.reduce((sum, f) => sum + f.additions, 0);
      const totalDeletions = pr.files.reduce((sum, f) => sum + f.deletions, 0);
      const fileCount = pr.files.length;
      const fileLabel = fileCount === 1 ? "file" : "files";

      return `      <li class="pr-item ${index === 0 ? "active" : ""}${pr.completed ? " completed" : ""}" id="pr-item-${index}" onclick="selectPR(${index})">
        <div class="pr-item-title">${escapeHtml(pr.title)}</div>
        <div class="pr-item-branch">${escapeHtml(pr.branch)}</div>
        <div class="pr-item-meta">
          <span class="pr-item-label">#${index}${pr.label ? ' · ' + escapeHtml(pr.label) : ''}</span>
          <span class="stat-additions">+${totalAdditions}</span>
          <span class="stat-deletions">-${totalDeletions}</span>
          <span>${fileCount} ${fileLabel}</span>
          ${pr.completed ? '<span class="pr-item-badge-completed">Done</span>' : ''}
        </div>
      </li>`;
    })
    .join("\n");

  return `    <div class="sidebar">
      <div class="sidebar-header">
        <div class="sidebar-brand">
          <img src="/quinn-logo.png" alt="Quinn" class="sidebar-logo" />
          <h1>Quinn</h1>
        </div>
        <span class="project-badge">${escapeHtml(project.name)}</span>
        <p>${project.prs.length} pull request${project.prs.length === 1 ? "" : "s"} for review</p>
        <div class="update-badge" id="update-badge" style="display:none;">
          <span class="update-badge-dot"></span>
          <span class="update-badge-text">Update available</span>
          <button class="update-btn" id="update-btn" onclick="applyUpdate()">Update now</button>
        </div>
      </div>
      <ul class="pr-list">
${items}
      </ul>
      <div class="sidebar-footer">
        <a class="back-to-projects" href="/">← All Projects</a>
      </div>
    </div>`;
}
