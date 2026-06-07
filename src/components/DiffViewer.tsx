/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { DiffLine } from "../types";

interface DiffViewerProps {
  diffData: DiffLine[];
}

export default function DiffViewer({ diffData }: DiffViewerProps) {
  if (!diffData || diffData.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center bg-slate-50 border border-slate-200 border-dashed rounded-xl h-[250px]">
        <svg
          className="w-10 h-10 text-slate-300 mb-3"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
        <span className="text-sm font-medium text-slate-400 font-mono">
          No diff corrections generated
        </span>
      </div>
    );
  }

  // Calculate actual counts to list in summary badge
  const additions = diffData.filter((l) => l.type === "added").length;
  const deletions = diffData.filter((l) => l.type === "deleted").length;

  return (
    <div className="flex flex-col rounded-xl border border-slate-200 overflow-hidden shadow-sm bg-white" id="diff-viewer-wrapper">
      {/* Diff Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-200">
        <div className="flex items-center gap-2">
          <span className="w-3.5 h-3.5 bg-indigo-500 rounded-md flex items-center justify-center text-[10px] text-white font-black font-mono">
            Δ
          </span>
          <span className="text-xs font-semibold text-slate-700 font-mono">
            Git-Style Correction Diff
          </span>
        </div>
        <div className="flex items-center gap-1.5 font-mono text-xs">
          {deletions > 0 && (
            <span className="px-1.5 py-0.5 rounded bg-rose-50 text-rose-600 font-bold border border-rose-100">
              -{deletions}
            </span>
          )}
          {additions > 0 && (
            <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-600 font-bold border border-emerald-100">
              +{additions}
            </span>
          )}
          {(additions === 0 && deletions === 0) && (
            <span className="text-slate-500 italic">No alterations made</span>
          )}
        </div>
      </div>

      {/* Diff Code block */}
      <div className="overflow-x-auto select-text">
        <div className="min-w-full inline-block align-middle">
          <pre className="font-mono text-xs leading-relaxed py-3 bg-slate-950 text-slate-100 scrollbar-thin">
            <code className="block">
              {diffData.map((line, idx) => {
                let rowBg = "hover:bg-slate-900";
                let sign = " ";
                let lineClass = "text-slate-300";

                if (line.type === "added") {
                  rowBg = "bg-emerald-950/60 hover:bg-emerald-950 text-emerald-200 border-l-[3px] border-emerald-500";
                  sign = "+";
                  lineClass = "text-emerald-300";
                } else if (line.type === "deleted") {
                  rowBg = "bg-rose-950/60 hover:bg-rose-950 text-rose-200 line-through decoration-rose-500/50 border-l-[3px] border-rose-500";
                  sign = "-";
                  lineClass = "text-rose-300 border-r border-rose-950/40";
                }

                return (
                  <div
                    key={idx}
                    className={`flex items-start w-full px-4 h-6 ${rowBg} transition-colors duration-150`}
                  >
                    {/* Sign Column */}
                    <span
                      className={`w-4 text-center select-none font-bold mr-2 ${
                        line.type === "added"
                          ? "text-emerald-400"
                          : line.type === "deleted"
                          ? "text-rose-400"
                          : "text-slate-600"
                      }`}
                    >
                      {sign}
                    </span>
                    {/* Output Line Content */}
                    <span className={`whitespace-pre flex-1 ${lineClass}`}>
                      {line.content}
                    </span>
                  </div>
                );
              })}
            </code>
          </pre>
        </div>
      </div>
    </div>
  );
}
