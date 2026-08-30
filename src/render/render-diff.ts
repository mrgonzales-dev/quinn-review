import type { DiffLine } from "../types.ts";
import { escapeHtml } from "../escape.ts";

export function renderDiffLines(diff: DiffLine[]): string {
  return diff
    .map((line) => {
      const cls =
        line.type === "added"
          ? "diff-line-added"
          : line.type === "removed"
            ? "diff-line-removed"
            : "diff-line-context";

      const sign = line.type === "added" ? "+" : line.type === "removed" ? "-" : " ";
      const oldNum = line.oldNumber ?? "";
      const newNum = line.newNumber ?? "";

      return `          <tr class="${cls}">
            <td class="diff-gutter">${oldNum}</td>
            <td class="diff-gutter">${newNum}</td>
            <td class="diff-sign">${sign}</td>
            <td class="diff-content"><pre>${escapeHtml(line.content) || "&nbsp;"}</pre></td>
          </tr>`;
    })
    .join("\n");
}
