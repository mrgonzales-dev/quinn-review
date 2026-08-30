export const STYLES = `
  :root {
    --bg: #0d1117;
    --bg-secondary: #161b22;
    --bg-tertiary: #21262d;
    --bg-hover: #2d333b;
    --border: #30363d;
    --text: #c9d1d9;
    --text-muted: #8b949e;
    --accent: #58a6ff;
    --green: #2F5722;
    --red: #3E0C06;
    --green-bg: rgba(47,87,34,0.45);
    --red-bg: rgba(62,12,6,0.45);
    --yellow: #d29922;
    --sidebar-width: 320px;
  }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  ::-webkit-scrollbar { width: 10px; height: 10px; }
  ::-webkit-scrollbar-track { background: var(--bg); }
  ::-webkit-scrollbar-thumb { background: var(--border); border-radius: 5px; }
  ::-webkit-scrollbar-thumb:hover { background: var(--bg-hover); }
  ::-webkit-scrollbar-corner { background: var(--bg); }
  * { scrollbar-width: thin; scrollbar-color: var(--border) var(--bg); }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
    background: var(--bg);
    color: var(--text);
    line-height: 1.5;
    font-size: 14px;
    display: flex;
    min-height: 100vh;
  }

  /* ── Sidebar ──────────────────────────────────────────────────── */
  .sidebar {
    width: var(--sidebar-width);
    min-width: var(--sidebar-width);
    background: var(--bg-secondary);
    border-right: 1px solid var(--border);
    padding: 16px 0;
    overflow-y: auto;
    height: 100vh;
    position: sticky;
    top: 0;
  }
  .sidebar-header {
    padding: 0 16px 16px;
    border-bottom: 1px solid var(--border);
    margin-bottom: 8px;
  }
  .sidebar-header h1 {
    font-size: 16px;
    font-weight: 600;
    color: var(--text);
  }
  .sidebar-brand {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .sidebar-logo {
    width: 24px;
    height: 24px;
    border-radius: 4px;
  }
  .sidebar-header p {
    font-size: 12px;
    color: var(--text-muted);
    margin-top: 4px;
  }
  .pr-list { list-style: none; }
  .pr-item {
    padding: 12px 16px;
    border-bottom: 1px solid var(--border);
    cursor: pointer;
    transition: background 0.12s;
  }
  .pr-item:hover { background: var(--bg-tertiary); }
  .pr-item.active { background: var(--bg-tertiary); border-left: 3px solid var(--accent); padding-left: 13px; }
  .pr-item.all-approved {
    animation: pixelGreen 0.6s steps(8) forwards;
  }
  .pr-item.all-approved .pr-item-title { color: #7ee787; }
  .pr-item.all-approved .pr-item-branch { color: #7ee787; }
  .pr-item.all-rejected {
    animation: pixelRed 0.6s steps(8) forwards;
  }
  .pr-item.all-rejected .pr-item-title { color: #ff8182; }
  .pr-item.all-rejected .pr-item-branch { color: #ff8182; }
  @keyframes pixelRed {
    0%   { background: var(--bg-tertiary); border-left-color: var(--accent); }
    12%  { background: rgba(255,129,130,0.08); border-left-color: rgba(255,129,130,0.2); }
    25%  { background: rgba(255,129,130,0.16); border-left-color: rgba(255,129,130,0.4); }
    37%  { background: rgba(255,129,130,0.24); border-left-color: rgba(255,129,130,0.6); }
    50%  { background: rgba(255,129,130,0.32); border-left-color: rgba(255,129,130,0.8); }
    62%  { background: rgba(255,129,130,0.40); border-left-color: #ff8182; }
    75%  { background: rgba(255,129,130,0.48); border-left-color: #ff8182; }
    88%  { background: rgba(255,129,130,0.56); border-left-color: #ff8182; }
    100% { background: rgba(255,129,130,0.15); border-left-color: #ff8182; }
  }
  @keyframes pixelGreen {
    0%   { background: var(--bg-tertiary); border-left-color: var(--accent); }
    12%  { background: rgba(126,231,135,0.08); border-left-color: rgba(126,231,135,0.2); }
    25%  { background: rgba(126,231,135,0.16); border-left-color: rgba(126,231,135,0.4); }
    37%  { background: rgba(126,231,135,0.24); border-left-color: rgba(126,231,135,0.6); }
    50%  { background: rgba(126,231,135,0.32); border-left-color: rgba(126,231,135,0.8); }
    62%  { background: rgba(126,231,135,0.40); border-left-color: #7ee787; }
    75%  { background: rgba(126,231,135,0.48); border-left-color: #7ee787; }
    88%  { background: rgba(126,231,135,0.56); border-left-color: #7ee787; }
    100% { background: rgba(126,231,135,0.15); border-left-color: #7ee787; }
  }
  .pr-item-title {
    font-size: 13px;
    font-weight: 600;
    color: var(--text);
    margin-bottom: 4px;
    line-height: 1.4;
  }
  .pr-item-branch {
    font-family: ui-monospace, SFMono-Regular, monospace;
    font-size: 11px;
    color: var(--accent);
    margin-bottom: 6px;
  }
  .pr-item-meta {
    display: flex;
    gap: 8px;
    font-size: 11px;
    color: var(--text-muted);
    align-items: center;
  }
  .pr-item-meta .stat-additions { color: #7ee787; }
  .pr-item-meta .stat-deletions { color: #ff8182; }
  .pr-item-files {
    font-size: 11px;
    color: var(--text-muted);
    margin-top: 4px;
  }

  /* ── Main content ─────────────────────────────────────────────── */
  .main {
    flex: 1;
    padding: 24px 32px;
    max-width: calc(100vw - var(--sidebar-width));
    overflow-x: hidden;
  }

  /* PR Header */
  .pr-header { border-bottom: 1px solid var(--border); padding-bottom: 16px; margin-bottom: 24px; }
  .pr-title { font-size: 24px; font-weight: 600; color: var(--text); margin-bottom: 8px; }
  .pr-meta { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; margin-bottom: 12px; }
  .pr-branch {
    background: var(--bg-tertiary); border: 1px solid var(--border);
    border-radius: 6px; padding: 2px 8px; font-size: 12px; color: var(--accent);
    font-family: ui-monospace, SFMono-Regular, monospace;
  }
  .pr-stats { display: flex; gap: 8px; font-size: 12px; }
  .pr-stats .stat-additions { color: #7ee787; }
  .pr-stats .stat-deletions { color: #ff8182; }
  .pr-progress { font-size: 12px; color: var(--text-muted); margin-left: auto; }
  .pr-description {
    background: var(--bg-secondary); border: 1px solid var(--border);
    border-radius: 6px; padding: 16px; color: var(--text-muted);
    white-space: pre-wrap; font-size: 14px;
  }

  /* Files summary */
  .files-summary {
    display: flex; align-items: center; gap: 8px;
    padding: 12px 0; border-bottom: 1px solid var(--border); margin-bottom: 16px;
    font-size: 14px; color: var(--text-muted);
  }
  .files-summary strong { color: var(--text); }

  /* File card */
  .file-card {
    background: var(--bg-secondary); border: 1px solid var(--border);
    border-radius: 6px; margin-bottom: 16px; overflow: hidden;
  }
  .file-header {
    display: flex; align-items: center; gap: 10px; padding: 12px 16px;
    background: var(--bg-tertiary); cursor: pointer; user-select: none;
    border-bottom: 1px solid var(--border);
  }
  .file-header:hover { background: var(--bg-hover); }
  .file-chevron { font-size: 10px; color: var(--text-muted); transition: transform 0.15s; flex-shrink: 0; }
  .file-chevron.collapsed { transform: rotate(-90deg); }
  .file-status {
    font-size: 11px; padding: 2px 8px; border-radius: 12px;
    font-weight: 500; text-transform: capitalize; flex-shrink: 0;
  }
  .file-status-added { background: rgba(59,185,80,0.15); color: #7ee787; }
  .file-status-modified { background: rgba(210,153,34,0.15); color: var(--yellow); }
  .file-status-deleted { background: rgba(248,81,73,0.15); color: #ff8182; }
  .file-path { font-family: ui-monospace, SFMono-Regular, monospace; font-size: 13px; flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .file-stats { font-size: 12px; display: flex; gap: 6px; flex-shrink: 0; }
  .file-stats .stat-additions { color: #7ee787; }
  .file-stats .stat-deletions { color: #ff8182; }
  .file-actions { display: flex; gap: 6px; flex-shrink: 0; }

  /* Buttons */
  .btn {
    background: var(--bg-tertiary); border: 1px solid var(--border); color: var(--text);
    border-radius: 6px; padding: 4px 12px; font-size: 12px; cursor: pointer;
    transition: background 0.15s;
  }
  .btn:hover { background: rgba(126,231,135,0.1); color: #7ee787; }
  .btn-sm { padding: 3px 10px; }
  .btn-approve { color: #7ee787; border-color: rgba(126,231,135,0.3); }
  .btn-approve:hover { background: rgba(126,231,135,0.1); }
  .btn-reject { color: #ff8182; border-color: rgba(255,129,130,0.3); }
  .btn-reject:hover { background: rgba(255,129,130,0.1); }
  .btn-complete { color: var(--accent); border-color: rgba(88,166,255,0.3); }
  .btn-complete:hover { background: rgba(88,166,255,0.1); }

  /* Completed PR state */
  .pr-content.completed .btn-approve,
  .pr-content.completed .btn-reject,
  .pr-content.completed .file-actions {
    display: none;
  }
  .pr-content.completed .pr-header {
    border-color: rgba(88,166,255,0.3);
  }
  .pr-completed-badge {
    display: inline-block; padding: 4px 12px; border-radius: 6px;
    font-size: 12px; font-weight: 600; color: var(--accent);
    background: rgba(88,166,255,0.1); border: 1px solid rgba(88,166,255,0.3);
  }
  .pr-item.completed .pr-item-title { color: var(--accent); }
  .pr-item.completed { border-left: 3px solid var(--accent); padding-left: 13px; }
  .pr-item-badge-completed {
    margin-left: auto; padding: 1px 8px; border-radius: 10px;
    font-size: 10px; font-weight: 600; color: var(--accent);
    background: rgba(88,166,255,0.12); border: 1px solid rgba(88,166,255,0.3);
  }

  /* Diff table */
  .file-diff { overflow-x: auto; }
  .file-diff.collapsed { display: none; }
  .diff-table { width: 100%; border-collapse: collapse; font-family: ui-monospace, SFMono-Regular, monospace; font-size: 12px; }
  .diff-table td { padding: 0; vertical-align: top; }
  .diff-gutter {
    width: 1%; min-width: 40px; text-align: right; padding: 0 8px !important;
    color: var(--text-muted); user-select: none; white-space: nowrap;
  }
  .diff-sign { width: 1%; min-width: 16px; text-align: center; user-select: none; white-space: nowrap; }
  .diff-content { padding: 0 !important; }
  .diff-content pre { padding: 0 8px; white-space: pre; font-family: inherit; }
  .diff-line-context { background: var(--bg); }
  .diff-line-added { background: var(--green-bg); color: #ffffff; }
  .diff-line-added .diff-sign { color: #7ee787; }
  .diff-line-removed { background: var(--red-bg); color: #ffffff; }
  .diff-line-removed .diff-sign { color: #ff8182; }

  /* Explanation */
  .file-explanation {
    padding: 12px 16px; border-top: 1px solid var(--border);
    color: var(--text-muted); font-size: 13px; background: rgba(88,166,255,0.04);
  }

  /* Review badge */
  .file-review-badge {
    padding: 8px 16px; font-size: 12px; font-weight: 500; display: none;
  }
  .file-review-badge.show { display: block; }
  .file-review-badge.approved { background: rgba(59,185,80,0.1); color: #7ee787; }
  .file-review-badge.rejected { background: rgba(248,81,73,0.1); color: #ff8182; }

  /* Update badge */
  .update-badge {
    display: flex; align-items: center; gap: 8px; margin-top: 12px;
    padding: 8px 12px; border-radius: 6px; font-size: 12px;
    background: rgba(210,153,34,0.08); border: 1px solid rgba(210,153,34,0.3);
  }
  .update-badge-dot {
    width: 8px; height: 8px; border-radius: 50%; background: var(--yellow);
    flex-shrink: 0; animation: pulseDot 1.5s ease-in-out infinite;
  }
  @keyframes pulseDot {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.4; }
  }
  .update-badge-text { color: var(--yellow); }
  .update-btn {
    margin-left: auto; padding: 3px 10px; border-radius: 6px; font-size: 11px;
    background: rgba(210,153,34,0.15); border: 1px solid rgba(210,153,34,0.4);
    color: var(--yellow); cursor: pointer; transition: background 0.15s;
  }
  .update-btn:hover { background: rgba(210,153,34,0.25); }
  .update-btn:disabled { opacity: 0.6; cursor: default; }

  /* ── Landing page ────────────────────────────────────────────── */
  .landing-overlay {
    position: fixed; inset: 0; background: var(--bg);
    display: flex; align-items: center; justify-content: center;
    z-index: 100; animation: fadeIn 0.3s ease;
  }
  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  .landing-modal {
    background: var(--bg-secondary); border: 1px solid var(--border);
    border-radius: 12px; padding: 48px 40px; max-width: 560px; width: 90%;
    text-align: center; box-shadow: 0 8px 32px rgba(0,0,0,0.4);
  }
  .landing-logo {
    width: 56px; height: 56px; border-radius: 12px;
    margin: 0 auto 20px; display: block;
  }
  .landing-title {
    font-size: 24px; font-weight: 600; color: var(--text);
    margin-bottom: 8px;
  }
  .landing-subtitle {
    font-size: 14px; color: var(--text-muted); margin-bottom: 32px;
  }
  .landing-steps {
    text-align: left; margin-bottom: 32px;
  }
  .landing-step {
    display: flex; gap: 12px; padding: 12px 0;
    border-bottom: 1px solid var(--border);
  }
  .landing-step:last-child { border-bottom: none; }
  .landing-step-num {
    width: 24px; height: 24px; border-radius: 50%;
    background: var(--bg-tertiary); border: 1px solid var(--border);
    color: var(--accent); font-size: 12px; font-weight: 600;
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0;
  }
  .landing-step-content { flex: 1; }
  .landing-step-title {
    font-size: 13px; font-weight: 600; color: var(--text);
    margin-bottom: 2px;
  }
  .landing-step-desc {
    font-size: 12px; color: var(--text-muted); line-height: 1.5;
  }
  .landing-code {
    background: var(--bg); border: 1px solid var(--border);
    border-radius: 6px; padding: 10px 14px; margin-top: 6px;
    font-family: ui-monospace, SFMono-Regular, monospace;
    font-size: 12px; color: var(--accent);
    overflow-x: auto; text-align: left;
    cursor: pointer; transition: background 0.15s;
  }
  .landing-code:hover { background: var(--bg-tertiary); }
  .landing-code .copy-hint {
    color: var(--text-muted); font-size: 10px; float: right;
  }
  .landing-waiting {
    margin-top: 24px; padding: 12px; border-radius: 6px;
    background: rgba(88,166,255,0.06); border: 1px solid rgba(88,166,255,0.2);
    font-size: 12px; color: var(--text-muted);
    display: flex; align-items: center; justify-content: center; gap: 8px;
  }
  .landing-spinner {
    width: 14px; height: 14px; border: 2px solid var(--border);
    border-top-color: var(--accent); border-radius: 50%;
    animation: spin 0.8s linear infinite; flex-shrink: 0;
  }
  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  /* Footer */
  .footer { margin-top: 32px; padding-top: 16px; border-top: 1px solid var(--border); color: var(--text-muted); font-size: 12px; text-align: center; }
`;
