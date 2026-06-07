/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { HistoryItem } from "../types";
import { Trash2, X, RefreshCw, Calendar } from "lucide-react";

interface SidebarHistoryProps {
  history: HistoryItem[];
  onSelect: (item: HistoryItem) => void;
  onClear: () => void;
  isOpen: boolean;
  onClose: () => void;
  isEnabled: boolean;
}

export default function SidebarHistory({
  history,
  onSelect,
  onClear,
  isOpen,
  onClose,
  isEnabled,
}: SidebarHistoryProps) {
  if (!isOpen) return null;

  // Format relative time helper
  const formatTime = (timestamp: number) => {
    const diff = Date.now() - timestamp;
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return new Date(timestamp).toLocaleDateString();
  };

  return (
    <>
      {/* Background overlay */}
      <div
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-40 transition-opacity duration-200"
        onClick={onClose}
        id="history-overlay"
      />

      {/* Drawer slide-over */}
      <div
        className="fixed top-0 left-0 h-full w-80 bg-white border-r border-slate-200 shadow-2xl z-50 flex flex-col transition-all duration-300 transform translate-x-0"
        id="history-sidebar"
      >
        {/* Drawer Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-2">
            <span className="p-1 px-2 text-[10px] font-bold bg-indigo-100 text-indigo-700 rounded font-mono uppercase">
              Caching
            </span>
            <h2 className="text-sm font-bold text-slate-800 font-mono">
              Local History
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            id="close-history"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Caching Status Informer */}
        {!isEnabled && (
          <div className="p-4 bg-amber-50 text-amber-800 text-xs border-b border-amber-100 font-sans leading-normal">
            <span className="font-bold block mb-1">⚠️ Local history is disabled</span>
            Turn on <strong>"Enable Local History"</strong> in settings to cache corrections and restore past runs.
          </div>
        )}

        {/* Drawer Body / Session list */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {isEnabled && history.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <RefreshCw className="w-8 h-8 text-slate-300 animate-spin-slow mb-3" />
              <p className="text-xs font-semibold text-slate-400 font-mono">
                No past runs cached yet
              </p>
              <p className="text-[11px] text-slate-400 mt-1 px-4 leading-normal">
                Analyze some code first to see your history stack here!
              </p>
            </div>
          ) : isEnabled && history.length > 0 ? (
            history.map((item) => {
              // Extract snippet for visual preview (first 40 chars)
              const firstLine = item.inputCode.split("\n")[0] || "";
              const preview = firstLine.length > 40 ? `${firstLine.substring(0, 40)}...` : firstLine;
              
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    onSelect(item);
                    onClose();
                  }}
                  className="w-full text-left p-3.5 rounded-xl border border-slate-200 hover:border-indigo-400 bg-slate-50/50 hover:bg-white transition-all duration-150 group flex flex-col gap-2 relative shadow-xs"
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="px-2 py-0.5 text-[10px] font-bold font-mono bg-slate-200/70 text-slate-700 group-hover:bg-indigo-100 group-hover:text-indigo-800 rounded capitalize">
                      {item.language}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {formatTime(item.timestamp)}
                    </span>
                  </div>
                  <div className="text-xs font-mono text-slate-600 line-clamp-2 truncate whitespace-pre-wrap bg-slate-200/20 p-2 rounded border border-slate-100">
                    {preview || "// empty"}
                  </div>
                  <div className="text-[10px] text-indigo-600 font-medium group-hover:underline self-end">
                    Reload Run &rarr;
                  </div>
                </button>
              );
            })
          ) : null}
        </div>

        {/* Drawer Footer */}
        {isEnabled && history.length > 0 && (
          <div className="p-4 border-t border-slate-200 bg-slate-50">
            <button
              onClick={onClear}
              className="w-full py-2.5 px-4 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 rounded-xl text-xs font-bold font-mono flex items-center justify-center gap-2 transition-all duration-150"
              id="clear-all-history"
            >
              <Trash2 className="w-4 h-4" />
              Reset Cache List
            </button>
          </div>
        )}
      </div>
    </>
  );
}
