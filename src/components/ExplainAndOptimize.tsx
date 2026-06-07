/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from "react";
import Prism from "prismjs";
import { Check, Copy } from "lucide-react";

interface ExplainAndOptimizeProps {
  technicalExplanation: string | string[];
  alternativeImplementations: string;
  optimizationTips: string | string[];
  language: string;
}

export default function ExplainAndOptimize({
  technicalExplanation,
  alternativeImplementations,
  optimizationTips,
  language,
}: ExplainAndOptimizeProps) {
  const codeRef = useRef<HTMLPreElement>(null);
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<"explanation" | "refactor" | "tips">("explanation");

  // Trigger Prism highlighting for alternative implementations
  useEffect(() => {
    if (codeRef.current && activeTab === "refactor") {
      Prism.highlightElement(codeRef.current.querySelector("code")!);
    }
  }, [alternativeImplementations, language, activeTab]);

  const handleCopyAlt = async () => {
    try {
      await navigator.clipboard.writeText(alternativeImplementations);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy", err);
    }
  };

  // Maps display keys to Prism types
  const getPrismLangName = (lang: string): string => {
    switch (lang.toLowerCase()) {
      case "python":
        return "python";
      case "java":
        return "java";
      case "c++":
        return "cpp";
      case "c":
        return "c";
      case "html":
        return "markup";
      default:
        return "markup";
    }
  };

  // Convert technicalExplanation text to distinct robust paragraphs or list elements
  const renderListItems = (val: string | string[]) => {
    if (!val) return null;
    
    let lines: string[] = [];
    if (Array.isArray(val)) {
      lines = val.map((l) => l.trim()).filter(Boolean);
    } else {
      // Split by bullets like *, -, 1., etc. or newline if no symbols are used
      lines = val
        .split(/\n+/)
        .map((l) => l.trim())
        .filter((l) => l.length > 0)
        .map((l) => l.replace(/^[-*•\d.]\s*/, "")); // remove bullet symbol
    }

    return (
      <ul className="space-y-4" id="explanation-list">
        {lines.map((item, idx) => {
          // Identify some key semantic words to color-code symbols
          const isErrorTypo = item.toLowerCase().includes("error") || item.toLowerCase().includes("bug") || item.toLowerCase().includes("missing");
          const isOptimize = item.toLowerCase().includes("standard") || item.toLowerCase().includes("optimal") || item.toLowerCase().includes("precision");
          
          let bulletColor = "bg-blue-100 text-blue-600";
          let bulletChar = "i";

          if (isErrorTypo) {
            bulletColor = "bg-red-100 text-red-600";
            bulletChar = "!";
          } else if (isOptimize) {
            bulletColor = "bg-green-100 text-green-600";
            bulletChar = "✓";
          }

          return (
            <li key={idx} className="flex gap-3 text-sm text-slate-600 leading-relaxed">
              <div className={`w-5 h-5 rounded-full ${bulletColor} flex items-center justify-center shrink-0 text-[10px] font-bold mt-0.5`}>
                <span>{bulletChar}</span>
              </div>
              <div>
                <p className="font-semibold text-slate-800 text-xs uppercase tracking-wider mb-0.5">Correction Point {idx + 1}</p>
                <p className="text-slate-600">{item}</p>
              </div>
            </li>
          );
        })}
      </ul>
    );
  };

  // Parse optimization tips list
  const renderTipsList = (tips: string | string[]) => {
    if (!tips) return null;
    
    let lines: string[] = [];
    if (Array.isArray(tips)) {
      lines = tips.map((l) => l.trim()).filter(Boolean);
    } else {
      lines = tips
        .split(/\n+/)
        .map((l) => l.trim())
        .filter((l) => l.length > 0)
        .map((l) => l.replace(/^[-*•\d.]\s*/, ""));
    }

    return (
      <div className="space-y-3" id="optimization-tips-grid">
        {lines.map((tip, idx) => (
          <div
            key={idx}
            className="flex gap-3 bg-indigo-50/40 border border-indigo-100/50 p-4 rounded-xl text-indigo-950 text-xs leading-normal"
          >
            <div className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-600 font-bold shrink-0 flex items-center justify-center text-[10px]">💡</div>
            <div>
              <p className="font-bold text-indigo-900 mb-0.5">Execution Suggestion {idx + 1}</p>
              <p className="text-indigo-800">{tip}</p>
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 flex flex-col overflow-hidden" id="explain-and-optimize-wrapper">
      {/* Tab Selectors Bar */}
      <div className="flex border-b border-gray-100 bg-gray-50/50">
        <button
          onClick={() => setActiveTab("explanation")}
          className={`flex-1 py-3 text-xs font-bold border-b-2 transition-all duration-150 ${
            activeTab === "explanation"
              ? "border-indigo-600 text-indigo-600 bg-white font-black"
              : "border-transparent text-gray-400 hover:text-gray-600"
          }`}
        >
          EXPLANATION
        </button>
        {alternativeImplementations && (
          <button
            onClick={() => setActiveTab("refactor")}
            className={`flex-1 py-3 text-xs font-bold border-b-2 transition-all duration-150 ${
              activeTab === "refactor"
                ? "border-indigo-600 text-indigo-600 bg-white font-black"
                : "border-transparent text-gray-400 hover:text-gray-600"
            }`}
          >
            ELEGANT REFACTOR
          </button>
        )}
        {optimizationTips && (
          <button
            onClick={() => setActiveTab("tips")}
            className={`flex-1 py-3 text-xs font-bold border-b-2 transition-all duration-150 ${
              activeTab === "tips"
                ? "border-indigo-600 text-indigo-600 bg-white font-black"
                : "border-transparent text-gray-400 hover:text-gray-600"
            }`}
          >
            OPTIMIZATION TIPS
          </button>
        )}
      </div>

      {/* Tab Body Contents */}
      <div className="p-6 overflow-y-auto">
        {activeTab === "explanation" && technicalExplanation && (
          <div className="prose max-w-none text-slate-600 animate-fade-in">
            {renderListItems(technicalExplanation)}
          </div>
        )}

        {activeTab === "refactor" && alternativeImplementations && (
          <div className="space-y-4 animate-fade-in" id="alternative-implementations">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest font-mono">
                  Clean Refactored Syntax Block
                </h4>
                <p className="text-[10px] text-gray-400">Higher precision, standard-compliant build output</p>
              </div>
              <button
                onClick={handleCopyAlt}
                className="flex items-center gap-1.5 text-[10px] text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 border border-indigo-100/30 px-3 py-1.5 rounded-lg transition-all duration-150 font-bold"
                title="Copy Alternative Implementation"
                id="copy-alt-button"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    Copy Code
                  </>
                )}
              </button>
            </div>
            <div className="relative rounded-xl border border-gray-150 overflow-hidden shadow-xs bg-[#fafafa]">
              <pre
                ref={codeRef}
                className="m-0 p-4 bg-slate-50 font-mono text-xs leading-relaxed max-h-[280px] overflow-y-auto"
              >
                <code className={`language-${getPrismLangName(language)}`}>
                  {alternativeImplementations}
                </code>
              </pre>
            </div>
          </div>
        )}

        {activeTab === "tips" && optimizationTips && (
          <div className="animate-fade-in">
            {renderTipsList(optimizationTips)}
          </div>
        )}
      </div>
    </div>
  );
}
