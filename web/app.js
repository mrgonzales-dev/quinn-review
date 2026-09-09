const state = {
  prs: [],
  selectedId: null,
  report: null,
  query: "",
};

const els = {
  list: document.getElementById("pr-list"),
  count: document.getElementById("pr-count"),
  search: document.getElementById("search"),
  refresh: document.getElementById("refresh-btn"),
  empty: document.getElementById("empty-state"),
  detail: document.getElementById("detail"),
  title: document.getElementById("pr-title"),
  meta: document.getElementById("pr-meta"),
  description: document.getElementById("pr-description"),
  filesSummary: document.getElementById("files-summary"),
  fileNav: document.getElementById("file-nav"),
  fileCards: document.getElementById("file-cards"),
  expandAll: document.getElementById("expand-all"),
  collapseAll: document.getElementById("collapse-all"),
  markReviewed: document.getElementById("mark-reviewed"),
  deleteReport: document.getElementById("delete-report"),
  loading: document.getElementById("loading"),
  approvalSummary: document.getElementById("approval-summary"),
};

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function reviewedKey(id) {
  return `quinn:reviewed:${id}`;
}

function isReviewed(id) {
  return localStorage.getItem(reviewedKey(id)) === "1";
}

function setReviewed(id, value) {
  localStorage.setItem(reviewedKey(id), value ? "1" : "0");
}

function approvalKey(reportId, filePath) {
  return `quinn:approval:${reportId}:${filePath}`;
}

function getApproval(reportId, filePath) {
  return localStorage.getItem(approvalKey(reportId, filePath));
}

function setApproval(reportId, filePath, value) {
  if (value) {
    localStorage.setItem(approvalKey(reportId, filePath), value);
  } else {
    localStorage.removeItem(approvalKey(reportId, filePath));
  }
}

function approvalSummary(reportId, files) {
  const approved = [];
  const rejected = [];
  for (const file of files) {
    const state = getApproval(reportId, file.path);
    if (state === "approved") approved.push(file.path);
    else if (state === "rejected") rejected.push(file.path);
  }
  return { approved, rejected };
}

function formatWhen(iso) {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString();
}

function showLoading(on) {
  if (on) {
    els.loading.classList.remove("hidden");
    els.loading.hidden = false;
  } else {
    els.loading.classList.add("hidden");
    els.loading.hidden = true;
  }
}

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Request failed: ${res.status}`);
  }
  return res.json();
}

function filteredPrs() {
  const q = state.query.trim().toLowerCase();
  if (!q) return state.prs;
  return state.prs.filter((pr) => {
    const hay = `${pr.title} ${pr.branch} ${pr.label || ""} ${pr.description}`.toLowerCase();
    return hay.includes(q);
  });
}

function renderList() {
  const items = filteredPrs();
  els.count.textContent = `${items.length} proposal${items.length === 1 ? "" : "s"}`;

  if (!items.length) {
    els.list.innerHTML = `<p class="muted" style="padding:12px">No matching proposals.</p>`;
    return;
  }

  els.list.innerHTML = items
    .map((pr, index) => {
      const active = pr.id === state.selectedId ? "active" : "";
      const reviewed = isReviewed(pr.id) ? "reviewed" : "";
      return `
        <button type="button" class="pr-item ${active} ${reviewed}" role="listitem" data-id="${escapeHtml(pr.id)}" style="animation-delay:${Math.min(index, 12) * 40}ms">
          <div class="pr-item-title">${escapeHtml(pr.title)}</div>
          <div class="pr-item-meta">
            <span>${escapeHtml(pr.branch)}</span>
            ${pr.label ? `<span>${escapeHtml(pr.label)}</span>` : ""}
            <span class="plus">+${pr.additions}</span>
            <span class="minus">-${pr.deletions}</span>
          </div>
        </button>
      `;
    })
    .join("");
}

function renderDiffRows(diff) {
  return (diff || [])
    .map((line) => {
      const cls =
        line.type === "added" ? "line-added" : line.type === "removed" ? "line-removed" : "line-context";
      const sign = line.type === "added" ? "+" : line.type === "removed" ? "-" : " ";
      return `
        <tr class="${cls}">
          <td class="diff-gutter">${line.oldNumber ?? ""}</td>
          <td class="diff-gutter">${line.newNumber ?? ""}</td>
          <td class="diff-sign">${sign}</td>
          <td class="diff-content"><pre>${escapeHtml(line.content) || "&nbsp;"}</pre></td>
        </tr>
      `;
    })
    .join("");
}

function renderDetail() {
  const pr = state.report;
  if (!pr) {
    els.detail.hidden = true;
    els.detail.classList.add("hidden");
    els.empty.classList.remove("hidden");
    els.empty.hidden = false;
    return;
  }

  els.empty.hidden = true;
  els.empty.classList.add("hidden");
  els.detail.hidden = false;
  els.detail.classList.remove("hidden");

  els.title.textContent = pr.title;
  els.description.textContent = pr.description;
  els.meta.innerHTML = `
    <span class="chip branch">${escapeHtml(pr.branch)}</span>
    ${pr.label ? `<span class="chip label">${escapeHtml(pr.label)}</span>` : ""}
    <span class="chip"><span class="plus">+${pr.additions ?? 0}</span> <span class="minus">-${pr.deletions ?? 0}</span></span>
    <span class="chip">${escapeHtml(formatWhen(pr.generatedAt))}</span>
  `;

  const files = pr.files || [];
  els.filesSummary.textContent = `${files.length} file${files.length === 1 ? "" : "s"} changed`;

  els.fileNav.innerHTML = files
    .map(
      (file, index) =>
        `<a href="#file-${index}">${escapeHtml(file.path)}</a>`
    )
    .join("");

  els.fileCards.innerHTML = files
    .map((file, index) => {
      const current = getApproval(pr.id, file.path);
      return `
        <article class="file-card open" id="file-${index}" style="animation-delay:${Math.min(index, 10) * 45}ms">
          <button type="button" class="file-header" aria-expanded="true" data-toggle="${index}">
            <svg class="chevron" viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M6 3l5 5-5 5z"/></svg>
            <span class="status ${escapeHtml(file.status)}">${escapeHtml(file.status)}</span>
            <span class="file-path">${escapeHtml(file.path)}</span>
            <span class="file-stats"><span class="plus">+${file.additions}</span><span class="minus">-${file.deletions}</span></span>
            <span class="file-approval" data-approval-path="${escapeHtml(file.path)}">
              <button type="button" class="approve-btn ${current === "approved" ? "active" : ""}" data-approve="${escapeHtml(file.path)}" title="Approve">&#10003;</button>
              <button type="button" class="reject-btn ${current === "rejected" ? "active" : ""}" data-reject="${escapeHtml(file.path)}" title="Reject">&#10007;</button>
            </span>
          </button>
          <div class="file-body">
            <div class="file-explanation">${escapeHtml(file.explanation)}</div>
            <div class="diff-wrap">
              <table class="diff-table">
                <tbody>${renderDiffRows(file.diff)}</tbody>
              </table>
            </div>
          </div>
        </article>
      `;
    })
    .join("");

  renderApprovalSummary(pr.id, files);

  highlightDiffs(files);

  els.markReviewed.textContent = isReviewed(pr.id) ? "Unmark reviewed" : "Mark reviewed";
}

const EXT_LANG_MAP = {
  js: "javascript", mjs: "javascript", cjs: "javascript",
  ts: "typescript", tsx: "typescript",
  jsx: "javascript",
  py: "python",
  go: "go",
  rs: "rust",
  java: "java",
  c: "c", h: "c",
  cpp: "cpp", cc: "cpp", hpp: "cpp",
  cs: "csharp",
  rb: "ruby",
  php: "php",
  swift: "swift",
  kt: "kotlin",
  sh: "bash", bash: "bash",
  yml: "yaml", yaml: "yaml",
  json: "json",
  html: "xml", xml: "xml",
  css: "css",
  scss: "scss",
  sql: "sql",
  md: "markdown",
  dockerfile: "dockerfile",
};

function langFromPath(filePath) {
  const base = filePath.split("/").pop().toLowerCase();
  if (base === "dockerfile") return "dockerfile";
  const ext = base.includes(".") ? base.split(".").pop() : "";
  return EXT_LANG_MAP[ext] || null;
}

function highlightDiffs(files) {
  if (typeof hljs === "undefined") return;
  for (let i = 0; i < files.length; i++) {
    const lang = langFromPath(files[i].path);
    if (!lang) continue;
    const card = document.getElementById(`file-${i}`);
    if (!card) continue;
    card.querySelectorAll(".diff-content pre").forEach((pre) => {
      const tr = pre.closest("tr");
      if (!tr) return;
      if (tr.classList.contains("line-context")) return;
      try {
        hljs.highlightBlock(pre);
      } catch (e) {
        // skip if highlighting fails
      }
    });
  }
}

function renderApprovalSummary(reportId, files) {
  const { approved, rejected } = approvalSummary(reportId, files);
  if (!approved.length && !rejected.length) {
    els.approvalSummary.classList.add("hidden");
    els.approvalSummary.hidden = true;
    return;
  }
  els.approvalSummary.classList.remove("hidden");
  els.approvalSummary.hidden = false;

  const parts = [];
  if (approved.length) {
    parts.push(`<span class="approval-group"><span class="plus">Approved (${approved.length}):</span> ${approved.map((p) => `<code>${escapeHtml(p)}</code>`).join(", ")}</span>`);
  }
  if (rejected.length) {
    parts.push(`<span class="approval-group"><span class="minus">Rejected (${rejected.length}):</span> ${rejected.map((p) => `<code>${escapeHtml(p)}</code>`).join(", ")}</span>`);
  }
  els.approvalSummary.innerHTML = parts.join("");
}

async function loadPrs() {
  showLoading(true);
  try {
    const data = await fetchJson("/api/prs");
    state.prs = data.prs || [];
    renderList();

    if (state.selectedId) {
      const stillThere = state.prs.some((pr) => pr.id === state.selectedId);
      if (!stillThere) {
        state.selectedId = null;
        state.report = null;
        renderDetail();
      }
    } else if (state.prs.length === 1) {
      await selectPr(state.prs[0].id);
    }
  } finally {
    showLoading(false);
  }
}

async function selectPr(id) {
  state.selectedId = id;
  renderList();
  showLoading(true);
  try {
    const report = await fetchJson(`/api/prs/${encodeURIComponent(id)}`);
    state.report = report;
    renderDetail();
    history.replaceState(null, "", `#${encodeURIComponent(id)}`);
  } finally {
    showLoading(false);
  }
}

function setAllExpanded(open) {
  document.querySelectorAll(".file-card").forEach((card) => {
    card.classList.toggle("open", open);
    const btn = card.querySelector(".file-header");
    if (btn) btn.setAttribute("aria-expanded", open ? "true" : "false");
  });
}

els.list.addEventListener("click", (event) => {
  const button = event.target.closest(".pr-item");
  if (!button) return;
  selectPr(button.dataset.id);
});

els.search.addEventListener("input", () => {
  state.query = els.search.value;
  renderList();
});

els.refresh.addEventListener("click", () => {
  loadPrs().catch((err) => {
    els.count.textContent = err.message;
  });
});

els.expandAll.addEventListener("click", () => setAllExpanded(true));
els.collapseAll.addEventListener("click", () => setAllExpanded(false));

els.markReviewed.addEventListener("click", () => {
  if (!state.selectedId) return;
  const next = !isReviewed(state.selectedId);
  setReviewed(state.selectedId, next);
  renderList();
  renderDetail();
});

els.deleteReport.addEventListener("click", async () => {
  if (!state.selectedId) return;
  if (!confirm("Delete this report? This cannot be undone.")) return;
  const res = await fetch(`/api/prs/${encodeURIComponent(state.selectedId)}`, {
    method: "DELETE",
  });
  if (!res.ok) return;
  state.selectedId = null;
  state.report = null;
  await loadPrs();
  renderDetail();
});

els.fileCards.addEventListener("click", (event) => {
  const toggleBtn = event.target.closest("[data-toggle]");
  if (toggleBtn) {
    const card = toggleBtn.closest(".file-card");
    if (!card) return;
    const open = !card.classList.contains("open");
    card.classList.toggle("open", open);
    toggleBtn.setAttribute("aria-expanded", open ? "true" : "false");
    return;
  }

  const approveBtn = event.target.closest("[data-approve]");
  if (approveBtn) {
    if (!state.report) return;
    const filePath = approveBtn.dataset.approve;
    const current = getApproval(state.report.id, filePath);
    const next = current === "approved" ? null : "approved";
    setApproval(state.report.id, filePath, next);
    renderDetail();
    return;
  }

  const rejectBtn = event.target.closest("[data-reject]");
  if (rejectBtn) {
    if (!state.report) return;
    const filePath = rejectBtn.dataset.reject;
    const current = getApproval(state.report.id, filePath);
    const next = current === "rejected" ? null : "rejected";
    setApproval(state.report.id, filePath, next);
    renderDetail();
    return;
  }
});

async function boot() {
  const hash = decodeURIComponent(location.hash.replace(/^#/, ""));
  await loadPrs();
  if (hash && state.prs.some((pr) => pr.id === hash)) {
    await selectPr(hash);
  }
}

boot().catch((err) => {
  els.count.textContent = err.message;
});
