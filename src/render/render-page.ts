import type { PRData } from "../types.ts";
import { STYLES } from "../styles.ts";
import { renderSidebar } from "./render-sidebar.ts";
import { renderFile } from "./render-file.ts";
import { renderLanding } from "./render-landing.ts";
import { escapeHtml } from "../escape.ts";

function renderPRContent(pr: PRData, prIndex: number): string {
  const totalAdditions = pr.files.reduce((sum, f) => sum + f.additions, 0);
  const totalDeletions = pr.files.reduce((sum, f) => sum + f.deletions, 0);
  const fileCards = pr.files.map((f, i) => renderFile(f, i, prIndex)).join("\n");
  const completedClass = pr.completed ? " completed" : "";

  return `    <div class="pr-content${completedClass}" id="pr-content-${prIndex}" style="${prIndex === 0 ? "" : "display:none;"}">
      <div class="pr-header">
        <h1 class="pr-title">${escapeHtml(pr.title)}</h1>
        <div class="pr-meta">
          <span class="pr-item-label">#${prIndex}${pr.label ? ' · ' + escapeHtml(pr.label) : ''}</span>
          <span class="pr-branch">${escapeHtml(pr.branch)}</span>
          <span class="pr-stats">
            <span class="stat-additions">+${totalAdditions}</span>
            <span class="stat-deletions">-${totalDeletions}</span>
          </span>
          <button class="btn btn-approve" onclick="approveAll(${prIndex}, ${pr.files.length})">Approve All Changes</button>
          <button class="btn btn-reject" onclick="rejectAll(${prIndex}, ${pr.files.length})">Reject All Changes</button>
          <button class="btn btn-complete" id="btn-complete-${prIndex}" onclick="completePR(${prIndex})" style="${pr.completed ? "display:none;" : ""}">Complete</button>
          <span class="pr-completed-badge" id="completed-badge-${prIndex}" style="${pr.completed ? "" : "display:none;"}">Completed</span>
          <span class="pr-progress" id="pr-progress-${prIndex}">0/${pr.files.length} reviewed</span>
        </div>
        <div class="pr-description">${escapeHtml(pr.description)}</div>
      </div>

      <div class="files-summary">
        <span>Changes in <strong>${pr.files.length}</strong> file${pr.files.length === 1 ? "" : "s"}</span>
      </div>

${fileCards}
    </div>`;
}

export function renderPage(prs: PRData[], mcpPath: string): string {
  const hasPRs = prs.length > 0;
  const sidebar = hasPRs ? renderSidebar(prs) : "";
  const prContents = hasPRs ? prs.map((pr, i) => renderPRContent(pr, i)).join("\n") : "";
  const landing = hasPRs ? "" : renderLanding(mcpPath);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <link rel="icon" type="image/x-icon" href="/favicon.ico" />
  <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png" />
  <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16.png" />
  <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
  <link rel="icon" type="image/png" sizes="192x192" href="/icon-192.png" />
  <link rel="icon" type="image/png" sizes="512x512" href="/icon-512.png" />
  <title>Quinn</title>
  <style>${STYLES}</style>
</head>
<body>
${sidebar}
  <div class="main">
${prContents}
  </div>
${landing}
  <script>
    function selectPR(index) {
      var prs = document.querySelectorAll(".pr-content");
      prs.forEach(function(el) { el.style.display = "none"; });
      var target = document.getElementById("pr-content-" + index);
      if (target) target.style.display = "";

      var items = document.querySelectorAll(".pr-item");
      items.forEach(function(el) { el.classList.remove("active"); });
      var item = document.querySelectorAll(".pr-item")[index];
      if (item) item.classList.add("active");
    }

    function toggleFile(idSuffix) {
      var diff = document.getElementById("diff-" + idSuffix);
      var chevron = document.getElementById("chevron-" + idSuffix);
      if (diff) diff.classList.toggle("collapsed");
      if (chevron) chevron.classList.toggle("collapsed");
    }

    function copyCode(idSuffix) {
      var diff = document.getElementById("diff-" + idSuffix);
      if (!diff) return;
      var lines = [];
      diff.querySelectorAll("tr").forEach(function(row) {
        var sign = row.querySelector(".diff-sign");
        var content = row.querySelector(".diff-content pre");
        if (sign && content) {
          var prefix = sign.textContent.trim();
          if (prefix === "+" || prefix === " ") {
            lines.push(content.textContent);
          }
        }
      });
      navigator.clipboard.writeText(lines.join("\\n"));
    }

    function applyBadgeState(idSuffix, action) {
      var badge = document.getElementById("badge-" + idSuffix);
      if (!badge) return;
      if (action === null) {
        badge.className = "file-review-badge";
        badge.textContent = "";
      } else {
        badge.className = "file-review-badge show " + action;
        badge.textContent = action === "approved"
          ? "Approved — ready to apply"
          : "Rejected — will not apply";
      }
    }

    function getBadgeAction(idSuffix) {
      var badge = document.getElementById("badge-" + idSuffix);
      if (!badge) return null;
      if (badge.className.indexOf("approved") !== -1) return "approved";
      if (badge.className.indexOf("rejected") !== -1) return "rejected";
      return null;
    }

    function getComment(idSuffix) {
      var input = document.getElementById("comment-input-" + idSuffix);
      return input ? input.value : "";
    }

    function saveComment(idSuffix) {
      var action = getBadgeAction(idSuffix);
      if (!action) return;
      var comment = getComment(idSuffix);
      fetch("/api/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idSuffix: idSuffix, action: action, comment: comment })
      }).catch(function(e) { console.error("Failed to save comment:", e); });
    }

    function showCommentInput(idSuffix, show) {
      var el = document.getElementById("comment-" + idSuffix);
      if (el) el.style.display = show ? "" : "none";
    }

    function reviewFile(idSuffix, action) {
      var currentAction = getBadgeAction(idSuffix);
      if (currentAction === action) {
        applyBadgeState(idSuffix, null);
        showCommentInput(idSuffix, false);
        fetch("/api/review/" + idSuffix, { method: "DELETE" })
          .catch(function(e) {
            console.error("Failed to delete review:", e);
            applyBadgeState(idSuffix, currentAction);
          });
      } else {
        applyBadgeState(idSuffix, action);
        showCommentInput(idSuffix, true);
        var comment = getComment(idSuffix);
        fetch("/api/review", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ idSuffix: idSuffix, action: action, comment: comment })
        }).catch(function(e) {
          console.error("Failed to save review:", e);
          applyBadgeState(idSuffix, currentAction);
        });
      }
      updatePrProgress(idSuffix.split("-")[0]);
    }

    function setReview(idSuffix, action) {
      var currentAction = getBadgeAction(idSuffix);
      if (currentAction === action) return;
      applyBadgeState(idSuffix, action);
      showCommentInput(idSuffix, true);
      var comment = getComment(idSuffix);
      fetch("/api/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idSuffix: idSuffix, action: action, comment: comment })
      }).catch(function(e) {
        console.error("Failed to save review:", e);
        applyBadgeState(idSuffix, currentAction);
      });
      updatePrProgress(idSuffix.split("-")[0]);
    }

    function updatePrProgress(prIndex) {
      var prContent = document.getElementById("pr-content-" + prIndex);
      if (!prContent) return;
      var totalFiles = prContent.querySelectorAll(".file-card").length;
      var approvedCount = prContent.querySelectorAll(".file-review-badge.approved").length;
      var rejectedCount = prContent.querySelectorAll(".file-review-badge.rejected").length;
      var reviewedCount = approvedCount + rejectedCount;
      var progressEl = document.getElementById("pr-progress-" + prIndex);
      if (progressEl) {
        progressEl.textContent = reviewedCount + "/" + totalFiles + " reviewed";
      }
      var item = document.getElementById("pr-item-" + prIndex);
      if (item) {
        if (approvedCount === totalFiles && totalFiles > 0) {
          item.classList.add("all-approved");
          item.classList.remove("all-rejected");
        } else if (rejectedCount === totalFiles && totalFiles > 0) {
          item.classList.add("all-rejected");
          item.classList.remove("all-approved");
        } else {
          item.classList.remove("all-approved");
          item.classList.remove("all-rejected");
        }
      }
    }

    function approveAll(prIndex, fileCount) {
      for (var i = 0; i < fileCount; i++) {
        setReview(prIndex + "-" + i, "approved");
      }
    }

    function rejectAll(prIndex, fileCount) {
      for (var i = 0; i < fileCount; i++) {
        setReview(prIndex + "-" + i, "rejected");
      }
    }

    function completePR(prIndex) {
      fetch("/api/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prIndex: prIndex })
      }).then(function(r) { return r.json(); })
        .then(function(res) {
          if (res.ok) applyCompletedState(prIndex, true);
        })
        .catch(function(e) { console.error("Failed to complete PR:", e); });
    }

    function applyCompletedState(prIndex, completed) {
      var content = document.getElementById("pr-content-" + prIndex);
      var btn = document.getElementById("btn-complete-" + prIndex);
      var badge = document.getElementById("completed-badge-" + prIndex);
      var item = document.getElementById("pr-item-" + prIndex);
      if (completed) {
        if (content) content.classList.add("completed");
        if (btn) btn.style.display = "none";
        if (badge) badge.style.display = "";
        if (item) item.classList.add("completed");
        if (item) {
          var meta = item.querySelector(".pr-item-meta");
          if (meta && !meta.querySelector(".pr-item-badge-completed")) {
            var span = document.createElement("span");
            span.className = "pr-item-badge-completed";
            span.textContent = "Done";
            meta.appendChild(span);
          }
        }
      } else {
        if (content) content.classList.remove("completed");
        if (btn) btn.style.display = "";
        if (badge) badge.style.display = "none";
        if (item) item.classList.remove("completed");
        if (item) {
          var doneBadge = item.querySelector(".pr-item-badge-completed");
          if (doneBadge) doneBadge.remove();
        }
      }
    }

    (function loadSavedReviews() {
      fetch("/api/reviews").then(function(r) { return r.json(); }).then(function(reviews) {
        var prIndices = {};
        Object.keys(reviews).forEach(function(idSuffix) {
          var entry = reviews[idSuffix];
          var action = entry.verdict;
          var badge = document.getElementById("badge-" + idSuffix);
          if (!badge) return;
          applyBadgeState(idSuffix, action);
          showCommentInput(idSuffix, true);
          if (entry.comment) {
            var input = document.getElementById("comment-input-" + idSuffix);
            if (input) input.value = entry.comment;
          }
          prIndices[idSuffix.split("-")[0]] = true;
        });
        Object.keys(prIndices).forEach(function(prIndex) {
          updatePrProgress(prIndex);
        });
      }).catch(function(e) { console.error("Failed to load reviews:", e); });
    })();

    (function checkForUpdates() {
      fetch("/api/update-check")
        .then(function(r) { return r.json(); })
        .then(function(res) {
          if (res.updateAvailable) {
            var badge = document.getElementById("update-badge");
            if (badge) badge.style.display = "";
          }
        })
        .catch(function(e) { console.error("Update check failed:", e); });
    })();

    function applyUpdate() {
      var btn = document.getElementById("update-btn");
      var badge = document.getElementById("update-badge");
      if (btn) btn.disabled = true;
      if (btn) btn.textContent = "Updating...";
      fetch("/api/update", { method: "POST" })
        .then(function(r) { return r.json(); })
        .then(function(res) {
          if (res.ok) {
            if (btn) btn.textContent = "Done";
            if (badge) {
              var text = badge.querySelector(".update-badge-text");
              if (text) text.textContent = "Updated — restart server";
            }
          } else {
            if (btn) btn.textContent = "Retry";
            if (btn) btn.disabled = false;
            console.error("Update failed:", res.error);
          }
        })
        .catch(function(e) {
          if (btn) btn.textContent = "Retry";
          if (btn) btn.disabled = false;
          console.error("Update failed:", e);
        });
    }

    function copyLandingCode(el) {
      var clone = el.cloneNode(true);
      var hintClone = clone.querySelector(".copy-hint");
      if (hintClone) hintClone.remove();
      var text = clone.textContent.trim();
      navigator.clipboard.writeText(text);
      var hint = el.querySelector(".copy-hint");
      if (hint) {
        var orig = hint.textContent;
        hint.textContent = "copied!";
        setTimeout(function() { hint.textContent = orig; }, 1500);
      }
    }

    (function pollForPRs() {
      var overlay = document.getElementById("landing-overlay");
      if (!overlay) return;
      setInterval(function() {
        fetch("/api/prs")
          .then(function(r) { return r.json(); })
          .then(function(prs) {
            if (prs && prs.length > 0) {
              window.location.reload();
            }
          })
          .catch(function() {});
      }, 3000);
    })();
  </script>
</body>
</html>`;
}
