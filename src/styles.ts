export const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Fira+Code:wght@400;500;600;700&family=Fira+Sans:wght@300;400;500;600;700&display=swap');
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
  }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  ::-webkit-scrollbar { width: 10px; height: 10px; }
  ::-webkit-scrollbar-track { background: var(--bg); }
  ::-webkit-scrollbar-thumb { background: var(--border); border-radius: 5px; }
  ::-webkit-scrollbar-thumb:hover { background: var(--bg-hover); }
  ::-webkit-scrollbar-corner { background: var(--bg); }
  * { scrollbar-width: thin; scrollbar-color: var(--border) var(--bg); }
  body {
    font-family: "Fira Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
    background: var(--bg);
    color: var(--text);
    line-height: 1.5;
    font-size: 14px;
  }

  /* ── Main content ─────────────────────────────────────────────── */
  .main {
    padding: 24px 32px;
    max-width: 1200px;
    margin: 0 auto;
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
  .pr-label {
    font-family: ui-monospace, SFMono-Regular, monospace;
    font-size: 11px; font-weight: 600; color: var(--accent);
    background: rgba(88,166,255,0.12); border: 1px solid rgba(88,166,255,0.3);
    padding: 2px 8px; border-radius: 4px;
  }
  .pr-stats { display: flex; gap: 8px; font-size: 12px; }
  .pr-stats .stat-additions { color: #7ee787; }
  .pr-stats .stat-deletions { color: #ff8182; }
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
    background: var(--bg-tertiary); user-select: none;
    border-bottom: 1px solid var(--border);
  }
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

  /* Diff table */
  .file-diff { overflow-x: auto; }
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

  /* Report footer */
  .report-footer {
    padding: 16px 0; border-top: 1px solid var(--border); margin-top: 24px;
    font-size: 12px; color: var(--text-muted); text-align: center;
  }
`;
