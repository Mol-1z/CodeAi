/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { diffLines } from "diff";
import { DiffLine } from "../types";

/**
 * Computes a standard line-by-line visual differences array on the client side.
 * Red for deleted lines, green for added lines, and white/gray for unchanged lines.
 */
export function computeClientDiff(oldStr: string, newStr: string): DiffLine[] {
  const changes = diffLines(oldStr, newStr);
  const diffData: DiffLine[] = [];

  for (const change of changes) {
    const lines = change.value.split("\n");
    // Since split("\n") produces an empty string at the end if the text ends on \n,
    // we should pop it to avoid an unexpected empty diff row.
    if (lines.length > 1 && lines[lines.length - 1] === "") {
      lines.pop();
    }

    const type: "unchanged" | "deleted" | "added" = change.added
      ? "added"
      : change.removed
      ? "deleted"
      : "unchanged";

    for (const line of lines) {
      diffData.push({
        type,
        content: line,
      });
    }
  }

  return diffData;
}
