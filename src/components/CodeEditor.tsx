/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useEffect, useState } from "react";
import Prism from "prismjs";
import "prismjs/themes/prism.css";
// Load Prism support for the requested languages
import "prismjs/components/prism-clike";
import "prismjs/components/prism-java";
import "prismjs/components/prism-python";
import "prismjs/components/prism-c";
import "prismjs/components/prism-cpp";
import "prismjs/components/prism-markup"; // HTML

interface CodeEditorProps {
  value: string;
  onChange: (val: string) => void;
  language: string;
  linesLimit: number;
}

export default function CodeEditor({ value, onChange, language, linesLimit }: CodeEditorProps) {
  const [lineCount, setLineCount] = useState(1);
  const [pasteWarning, setPasteWarning] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const highlightedRef = useRef<HTMLPreElement>(null);

  // Synchronize text lines count
  useEffect(() => {
    const lines = value ? value.split("\n") : [""];
    setLineCount(lines.length);
  }, [value]);

  // Synchronize dynamic scrolling between the text area and the highlight container
  const handleScroll = () => {
    if (textareaRef.current && highlightedRef.current) {
      highlightedRef.current.scrollTop = textareaRef.current.scrollTop;
      highlightedRef.current.scrollLeft = textareaRef.current.scrollLeft;
    }
  };

  // Intercept paste event for "Smart Paste" truncation logic
  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const pastedText = e.clipboardData.getData("text");
    if (!pastedText) return;

    const pastedLines = pastedText.split("\n");
    if (pastedLines.length > linesLimit) {
      e.preventDefault();
      // Auto-truncate at linesLimit
      const truncatedText = pastedLines.slice(0, linesLimit).join("\n");

      const textarea = textareaRef.current;
      if (textarea) {
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const newValue = value.substring(0, start) + truncatedText + value.substring(end);
        onChange(newValue);

        // Restore cursor position at the end of the truncated block
        setTimeout(() => {
          textarea.selectionStart = textarea.selectionEnd = start + truncatedText.length;
        }, 0);
      } else {
        onChange(truncatedText);
      }

      setPasteWarning(true);
      // Auto-dismiss after 5 seconds
      setTimeout(() => {
        setPasteWarning(false);
      }, 5000);
    }
  };

  // Support Tab key indentation inside textarea
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Tab") {
      e.preventDefault();
      const textarea = textareaRef.current;
      if (!textarea) return;

      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;

      // Insert 2 spaces for tab
      const tabSpaces = "  ";
      const newValue = value.substring(0, start) + tabSpaces + value.substring(end);
      onChange(newValue);

      // Restore cursor position
      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd = start + tabSpaces.length;
      }, 0);
    }
  };

  // Trigger Prism highlighting updates after modifications
  useEffect(() => {
    if (highlightedRef.current) {
      Prism.highlightElement(highlightedRef.current.querySelector("code")!);
    }
  }, [value, language]);

  // Map user selections to Prism grammar keys
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
        return "markup"; // fall back
    }
  };

  const isExceeded = lineCount > linesLimit;
  const lineNumbers = Array.from({ length: Math.max(lineCount, 1) }, (_, i) => i + 1);

  return (
    <div className="flex flex-col h-full bg-slate-50 rounded-xl border border-slate-200 overflow-hidden shadow-sm" id="code-editor-container">
      {/* Editor Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-slate-100">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-amber-400"></span>
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider font-mono">
            Source Code Editor
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`text-xs font-semibold font-mono px-2 py-1 rounded transition-colors duration-200 ${
              isExceeded
                ? "bg-rose-50 text-rose-600 border border-rose-200"
                : "bg-slate-100 text-slate-600"
            }`}
            id="line-counter"
          >
            {lineCount} / {linesLimit} Lines
          </span>
        </div>
      </div>

      {/* Editor Body */}
      <div className="relative flex flex-1 overflow-hidden font-mono text-sm leading-relaxed min-h-[350px]">
        {/* Line Gutter */}
        <div className="flex flex-col items-end py-4 px-3 bg-slate-100 text-slate-400 select-none text-right border-r border-slate-200 min-w-[3rem]">
          {lineNumbers.map((num) => (
            <div key={num} className="h-6">
              {num}
            </div>
          ))}
        </div>

        {/* Textarea + Highlighting Layer */}
        <div className="relative flex-1 bg-white overflow-hidden">
          {/* Syntax Highlight Overlay */}
          <pre
            ref={highlightedRef}
            className="absolute inset-0 m-0 p-4 pointer-events-none overflow-hidden bg-transparent border-0 font-mono text-sm"
            style={{ lineHeight: "1.5rem" }}
            aria-hidden="true"
          >
            <code className={`language-${getPrismLangName(language)}`}>
              {value || " "}
            </code>
          </pre>

          {/* Actual Editable Input Textarea */}
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onScroll={handleScroll}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            placeholder={
              language 
                ? `// Enter your ${language} code here (Max ${linesLimit} lines)` 
                : "// First, select a language from the dropdown, then enter code"
            }
            className="absolute inset-0 m-0 p-4 bg-transparent text-slate-800 font-mono text-sm border-0 focus:ring-0 focus:outline-none resize-none caret-slate-800"
            style={{
              lineHeight: "1.5rem",
              WebkitTextFillColor: "transparent", // Keep text invisible so background Prism highlights are seen
            }}
            spellCheck="false"
            id="editor-textarea"
          />
        </div>
      </div>

      {/* Smart Paste Warning Banner */}
      {pasteWarning && (
        <div className="bg-amber-50 border-t border-amber-100 p-3.5 flex items-center justify-between text-amber-800 text-xs shadow-inner" id="paste-truncate-warning">
          <div className="flex items-center gap-2.5">
            <svg className="w-4 h-4 text-amber-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span className="font-semibold">Code automatically truncated to the maximum limit of 50 lines.</span>
          </div>
          <button 
            onClick={() => setPasteWarning(false)} 
            className="text-amber-500 hover:text-amber-800 font-bold px-2 py-0.5 rounded text-sm select-none"
            title="Dismiss Warning"
          >
            ×
          </button>
        </div>
      )}

      {/* Error Banner when exceeded */}
      {isExceeded && (
        <div className="bg-rose-50 border-t border-rose-100 p-3 flex items-center gap-3 text-rose-600 text-xs" id="editor-limit-warning">
          <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div>
            <span className="font-bold">Execution Blocked:</span> Code exceeds the maximum limit of {linesLimit} lines. Please trim your input.
          </div>
        </div>
      )}
    </div>
  );
}
