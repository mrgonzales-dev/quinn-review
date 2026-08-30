import type { PRFile } from "../types.ts";
import { renderDiffLines } from "./render-diff.ts";
import { escapeHtml } from "../escape.ts";

export function renderFile(file: PRFile, fileIndex: number, prIndex: number): string {
  const statusLabel =
    file.status === "added"
      ? "added"
      : file.status === "deleted"
        ? "deleted"
        : "modified";

  const statusClass = `file-status file-status-${file.status}`;
  const idSuffix = `${prIndex}-${fileIndex}`;

  return `      <div class="file-card" id="file-${idSuffix}">
        <div class="file-header" onclick="toggleFile('${idSuffix}')">
          <span class="file-chevron" id="chevron-${idSuffix}">&#9660;</span>
          <span class="${statusClass}">${statusLabel}</span>
          <span class="file-path">${escapeHtml(file.path)}</span>
          <span class="file-stats">
            <span class="stat-additions">+${file.additions}</span>
            <span class="stat-deletions">-${file.deletions}</span>
          </span>
          <div class="file-actions">
            <button class="btn btn-sm" onclick="event.stopPropagation(); copyCode('${idSuffix}')">Copy Updated</button>
            <button class="btn btn-sm btn-approve" onclick="event.stopPropagation(); reviewFile('${idSuffix}', 'approved')">Approve</button>
            <button class="btn btn-sm btn-reject" onclick="event.stopPropagation(); reviewFile('${idSuffix}', 'rejected')">Reject</button>
          </div>
        </div>
        <div class="file-review-badge" id="badge-${idSuffix}"></div>
        <div class="file-diff" id="diff-${idSuffix}">
          <table class="diff-table">
            <tbody>
${renderDiffLines(file.diff)}
            </tbody>
          </table>
        </div>
        <div class="file-explanation">💡 ${escapeHtml(file.explanation)}</div>
        <div class="file-comment" id="comment-${idSuffix}" style="display:none;">
          <input type="text" class="comment-input" id="comment-input-${idSuffix}"
            placeholder="Optional comment (max 500 chars)"
            maxlength="500"
            onclick="event.stopPropagation()"
            onkeydown="event.stopPropagation()" />
        </div>
      </div>`;
}
