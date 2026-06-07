/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { GoogleGenAI, Type } from "@google/genai";
import CodeEditor from "./components/CodeEditor";
import DiffViewer from "./components/DiffViewer";
import ExplainAndOptimize from "./components/ExplainAndOptimize";
import SidebarHistory from "./components/SidebarHistory";
import { AnalysisResponse, HistoryItem, Language } from "./types";
import { computeClientDiff } from "./utils/diffHelper";
import { 
  Settings, 
  Sparkles, 
  Trash2, 
  Copy, 
  Download, 
  History, 
  Check, 
  FileCode, 
  Key, 
  AlertTriangle,
  Flame,
  HelpCircle
} from "lucide-react";

export default function App() {
  // --- States ---
  const [inputCode, setInputCode] = useState("");
  const [language, setLanguage] = useState<Language | "">("");
  const [customApiKey, setCustomApiKey] = useState("");
  const [historyEnabled, setHistoryEnabled] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [result, setResult] = useState<AnalysisResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [historyDrawerOpen, setHistoryDrawerOpen] = useState(false);
  const [copiedCorrected, setCopiedCorrected] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Constants
  const LINES_LIMIT = 50;
  const lineCount = inputCode ? inputCode.split("\n").length : 0;
  const isCodeExceeded = lineCount > LINES_LIMIT;

  // --- Initial Configuration Hydration ---
  useEffect(() => {
    // Custom API Key
    const savedKey = localStorage.getItem("code_error_api_key");
    if (savedKey) {
      setCustomApiKey(savedKey);
    }

    // History Toggle & Cached Revisions List
    const cachedToggle = localStorage.getItem("code_error_history_enabled");
    if (cachedToggle === "true") {
      setHistoryEnabled(true);
      const cachedHistory = localStorage.getItem("code_error_history_list");
      if (cachedHistory) {
        try {
          setHistory(JSON.parse(cachedHistory));
        } catch (e) {
          console.error("Failed to parse cached history", e);
        }
      }
    }
  }, []);

  // --- API Key & History persistence sync ---
  const handleApiKeyChange = (val: string) => {
    setCustomApiKey(val);
    if (val.trim()) {
      localStorage.setItem("code_error_api_key", val.trim());
    } else {
      localStorage.removeItem("code_error_api_key");
    }
  };

  const handleHistoryToggle = (checked: boolean) => {
    setHistoryEnabled(checked);
    localStorage.setItem("code_error_history_enabled", String(checked));
    if (!checked) {
      // Clear persistence when disabling
      localStorage.removeItem("code_error_history_list");
      setHistory([]);
    } else {
      // Initialize layout
      localStorage.setItem("code_error_history_list", JSON.stringify(history));
    }
  };

  // --- Session Safety: beforeunload warning ---
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (customApiKey && customApiKey.trim().length > 0) {
        e.preventDefault();
        // Modern browsers require setting returnValue
        e.returnValue = "Your custom Gemini API Key configuration is active in localStorage. Are you sure you want to close this app?";
        return e.returnValue;
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [customApiKey]);

  // --- Code Actions ---
  const handleClear = () => {
    setInputCode("");
    setResult(null);
    setError(null);
  };

  const getFileExtension = (lang: string): string => {
    switch (lang.toLowerCase()) {
      case "python": return "py";
      case "java": return "java";
      case "c++": return "cpp";
      case "c": return "c";
      case "html": return "html";
      default: return "txt";
    }
  };

  const handleCopyCorrected = async () => {
    if (!result) return;
    const correctedCode = result.diffData
      .filter((l) => l.type !== "deleted")
      .map((l) => l.content)
      .join("\n");
    try {
      await navigator.clipboard.writeText(correctedCode);
      setCopiedCorrected(true);
      setTimeout(() => setCopiedCorrected(false), 2000);
    } catch (err) {
      console.error("Failed to copy", err);
    }
  };

  const handleDownloadCorrected = () => {
    if (!result) return;
    const correctedCode = result.diffData
      .filter((l) => l.type !== "deleted")
      .map((l) => l.content)
      .join("\n");
    const extension = getFileExtension(language);
    const blob = new Blob([correctedCode], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `corrected_code.${extension}`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // --- Core Gemini Integration analyze request handler ---
  const handleAnalyze = async () => {
    if (!language) {
      setError("Language enforcement: Please select a language first before submitting.");
      return;
    }
    if (!inputCode.trim()) {
      setError("Input code is empty. Please supply a program segment first.");
      return;
    }
    if (isCodeExceeded) {
      setError(`Code block exceeds limits: Clean inputs must contain at most ${LINES_LIMIT} lines.`);
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      let data: AnalysisResponse;

      // Check for Custom API Key parameter bypass
      if (customApiKey && customApiKey.trim().length > 0) {
        // Direct, client-side browser API endpoint call using standard SDK
        const ai = new GoogleGenAI({ apiKey: customApiKey });

        const systemInstruction = `You are a highly technical, no-nonsense code analyzer, syntax checking engine, and execution optimizer.
Your tone is strict, objective, professional, and concise. Do not use flowery descriptors or verbose conversational preambles.
Identify the programming language of the supplied code block. 
If the user's selected language is "${language}", but the code is clearly written in a completely mismatched language (for example, Python elements provided when "Java" was selected, or Java code provided when "HTML" was selected), you must immediately set "success": false and set "error": "Language mismatch detected. Please verify your language selection." and leave other fields empty.

Otherwise:
1. "success" MUST be true.
2. Formulate correct adjustments for syntax errors, structural omissions, typos, import fallbacks, memory leak hazards, or general logical compilation bugs.
3. Set "correctedCode" to the complete corrected raw code string. No markdown block enveloping the correctedCode itself - just output the raw source code string.
4. Set "technicalExplanation" as an array of direct technical bullet point strings explaining syntax errors, misuses, or missing parts corrected.
5. Set "alternativeImplementations" as a markdown code block showing an alternative, elegant, or more modern way to write the same logic.
6. Set "optimizationTips" as an array of specific technical tips regarding performance, memory management, style best-practices, or speed execution warnings.`;

        const responseSchema = {
          type: Type.OBJECT,
          properties: {
            success: {
              type: Type.BOOLEAN,
              description: "Set to false ONLY if a severe programming language mismatch is detected. Otherwise set to true.",
            },
            error: {
              type: Type.STRING,
              description: "Must contain exactly 'Language mismatch detected. Please verify your language selection.' if a language mismatch was identified (when success is false). Otherwise, leave empty.",
            },
            correctedCode: {
              type: Type.STRING,
              description: "The complete verbatim corrected raw code string (without md formatting wrapper). Required if success is true.",
            },
            technicalExplanation: {
              type: Type.ARRAY,
              items: {
                type: Type.STRING,
              },
              description: "List of direct bullet point strings explaining errors, omissions, or typos adjusted. Required if success is true.",
            },
            alternativeImplementations: {
              type: Type.STRING,
              description: "A Markdown block showing a polished, alternative way to write the solution. Required if success is true.",
            },
            optimizationTips: {
              type: Type.ARRAY,
              items: {
                type: Type.STRING,
              },
              description: "List of performance tips or speed execution adjustments. Required if success is true.",
            },
          },
          required: ["success"],
        };

        const prompt = `Selected Programming Language: ${language}
Source Code to Analyze:
\`\`\`${language}
${inputCode}
\`\`\``;

        const aiResponse = await ai.models.generateContent({
          model: "gemini-3.5-flash",
          contents: prompt,
          config: {
            systemInstruction,
            responseMimeType: "application/json",
            responseSchema,
            temperature: 0.1,
          },
        });

        const textResponse = aiResponse.text;
        if (!textResponse) {
          throw new Error("Local bypass caller received empty response.");
        }
        
        const apiData = JSON.parse(textResponse.trim());
        if (apiData.success === false || apiData.error) {
          throw new Error(apiData.error || "Language mismatch detected. Please verify your language selection.");
        }

        // Compute client visual diff instantly on frontend
        const diffData = computeClientDiff(inputCode, apiData.correctedCode || "");

        data = {
          success: apiData.success,
          diffData,
          technicalExplanation: apiData.technicalExplanation || [],
          alternativeImplementations: apiData.alternativeImplementations || "",
          optimizationTips: apiData.optimizationTips || [],
        };
      } else {
        // Secure, standard backend routing call
        const response = await fetch("/api/analyze", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            code: inputCode,
            language,
          }),
        });

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new Error(errData.error || "A severe server error occurred during core analysis request.");
        }

        const backendResult = await response.json();
        
        if (backendResult.success === false || backendResult.error) {
          throw new Error(backendResult.error || "Language mismatch detected. Please verify your language selection.");
        }

        // Compute client visual diff instantly on frontend
        const diffData = computeClientDiff(inputCode, backendResult.correctedCode || "");

        data = {
          success: backendResult.success,
          diffData,
          technicalExplanation: backendResult.technicalExplanation || [],
          alternativeImplementations: backendResult.alternativeImplementations || "",
          optimizationTips: backendResult.optimizationTips || [],
        };
      }

      setResult(data);

      // Cache successes to Local History list if enabled
      if (historyEnabled) {
        const nextItem: HistoryItem = {
          id: Math.random().toString(36).substring(2, 9),
          timestamp: Date.now(),
          language,
          inputCode,
          result: data,
        };
        const updatedHistory = [nextItem, ...history.slice(0, 9)]; // track last 10
        setHistory(updatedHistory);
        localStorage.setItem("code_error_history_list", JSON.stringify(updatedHistory));
      }

    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to finalize compilation analysis pipeline.");
    } finally {
      setLoading(false);
    }
  };

  // --- Reload Session from History ---
  const handleSelectHistory = (item: HistoryItem) => {
    setInputCode(item.inputCode);
    setLanguage(item.language as Language);
    setResult(item.result);
    setError(null);
  };

  const handleClearHistory = () => {
    setHistory([]);
    localStorage.removeItem("code_error_history_list");
  };

  const handleLoadSample = (lang: Language) => {
    let sample = "";
    switch (lang) {
      case "python":
        sample = `def find_largest(numbers)
  largest = numbers[0
  for num in numbers:
  if num > largest
      largest = num
  return largest`;
        break;
      case "java":
        sample = `public class SimpleLoop {
    public static void main(String[] args) {
        for (int i = 0; i <= 10; i+) {
            System.out.println("Line: " + idx);
        }
    }
}`;
        break;
      case "html":
        sample = `<div>
  <h1>Welcome to the Page
  <p>Missing closure tags and tags mismatch here.
</div`;
        break;
      case "cpp":
        sample = `#include <iostream>
using namespace std;

int main() {
    int x = 5
    cout << "Value of x is: " x << endl;
    return 0;
}`;
        break;
      case "c":
        sample = `#include <stdio.h>

int main() {
    int arr[5] = {1, 2, 3};
    for(int i=0; i<=5; i++) {
        printf("%d\\n", arr[i]);
    }
}`;
        break;
      default:
        sample = `// Write code segment here`;
    }
    setInputCode(sample);
    setLanguage(lang);
    setResult(null);
    setError(null);
  };

  return (
    <div className="min-h-screen bg-[#F9FAFB] text-slate-900 flex flex-col font-sans border-t-2 border-indigo-600" id="application-root">
      {/* 1. Header Navigation */}
      <header className="sticky top-0 h-16 bg-white border-b border-gray-200 px-6 shrink-0 flex items-center justify-between z-30 shadow-sm" id="nav-header">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center shadow-sm">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"></path>
            </svg>
          </div>
          <span className="font-bold text-lg tracking-tight">CodeRefiner<span className="text-indigo-600">AI</span></span>
          <span className="hidden sm:inline-block px-2 py-0.5 bg-gray-100/80 text-[10px] font-mono font-bold text-gray-500 rounded uppercase tracking-wider">
            v3.5 Flash
          </span>
        </div>

        <div className="flex items-center gap-6">
          {/* History Sidebar Button with custom minimal styling */}
          <button
            onClick={() => setHistoryDrawerOpen(true)}
            className="flex items-center gap-1.5 text-xs font-bold text-gray-500 hover:text-indigo-600 uppercase tracking-wider transition-colors"
            title="Open Local History Panel"
            id="open-history-drawer-btn"
          >
            <History className="w-4 h-4" />
            <span className="hidden sm:inline">Local History</span>
          </button>

          <div className="h-6 w-[1px] bg-gray-200"></div>

          {/* Configuration Settings Toggle */}
          <button
            onClick={() => setSettingsOpen(!settingsOpen)}
            className={`flex items-center gap-2 transition-colors ${
              settingsOpen ? "text-indigo-600" : "text-gray-500 hover:text-indigo-600"
            }`}
            title="Configure System Inputs"
            id="toggle-settings-btn"
          >
            <Settings className="w-5 h-5" />
            <span className="text-sm font-medium hidden sm:inline">API Settings</span>
          </button>
        </div>
      </header>

      {/* 2. Optional Settings Panel Expanded */}
      {settingsOpen && (
        <div className="bg-white border-b border-slate-200 px-6 py-5 shadow-xs flex flex-col gap-4 animate-fade-in" id="settings-configuration-panel">
          <div className="max-w-4xl mx-auto w-full flex flex-col md:flex-row gap-6">
            {/* Custom Key Section */}
            <div className="flex-1 space-y-2">
              <label className="text-xs font-bold text-slate-700 font-mono flex items-center gap-2">
                <Key className="w-4 h-4 text-indigo-500" />
                Custom Gemini API Key
              </label>
              <input
                type="password"
                placeholder="Enter your personal AI Studio API Key..."
                value={customApiKey}
                onChange={(e) => handleApiKeyChange(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:border-indigo-500 focus:outline-none text-xs font-mono bg-slate-50 shadow-inner"
              />
              <p className="text-[10px] text-slate-400 leading-normal">
                If provided, analysis queries bypass the default Express server backend entirely to execute faster client-side API requests.
              </p>
              {customApiKey && (
                <div className="flex items-center gap-2 text-amber-600 bg-amber-50 p-2.5 rounded-lg border border-amber-100 text-[10px] leading-normal mt-2">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  <span>
                    <strong>Security Notice:</strong> Storing key credentials inside the browser's <code>localStorage</code> carries local session leakage risks if left unencrypted.
                  </span>
                </div>
              )}
            </div>

            {/* Local History Section */}
            <div className="flex-1 space-y-2 flex flex-col justify-between">
              <div>
                <span className="text-xs font-bold text-slate-700 font-mono block mb-1">
                  Revision History Controls
                </span>
                <p className="text-[11px] text-slate-400 leading-normal mb-3">
                  Check to caches up to 10 successful corrections inside your local storage instance for prompt future retrieves.
                </p>
              </div>
              <div className="flex items-center justify-between bg-slate-50 p-3 rounded-xl border border-slate-100">
                <span className="text-xs font-semibold text-slate-600">Enable Local History</span>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={historyEnabled}
                    onChange={(e) => handleHistoryToggle(e.target.checked)}
                    className="sr-only peer"
                    id="history-toggle-input"
                  />
                  <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
                </label>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. Main Workspace */}
      <main className="flex-1 max-w-[1600px] w-full mx-auto grid grid-cols-1 lg:grid-cols-2 gap-6 p-6 overflow-hidden min-h-0" id="workspace-grid">
        {/* Left Panel: Input */}
        <section className="bg-white rounded-2xl border border-gray-200 p-6 flex flex-col gap-5 shadow-sm" id="left-workspace-panel">
          {/* Inputs Selector header info */}
          <div className="flex items-center justify-between gap-4 pb-2 border-b border-gray-100" id="language-and-prompts-bar">
            <div className="flex flex-col gap-1 flex-1">
              <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Target Language</label>
              <div className="relative">
                <select
                  value={language}
                  onChange={(e) => {
                    setLanguage(e.target.value as Language);
                    setError(null);
                  }}
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 pr-8 text-sm font-medium focus:ring-2 focus:ring-indigo-500 outline-none cursor-pointer"
                  id="language-dropdown"
                >
                  <option value="" disabled>Select language...</option>
                  <option value="java">Java</option>
                  <option value="python">Python</option>
                  <option value="cpp">C++</option>
                  <option value="c">C</option>
                  <option value="html">HTML</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>

            <div className="text-right shrink-0">
              <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block">Line Count</span>
              <p className="text-sm font-mono text-indigo-600 font-bold tracking-tighter">
                {lineCount} / {LINES_LIMIT}
              </p>
            </div>
          </div>

          {/* Sample Snippet Load Rail */}
          <div className="flex items-center justify-between gap-2 bg-gray-50/70 p-2.5 rounded-xl border border-gray-100">
            <span className="text-[10px] font-bold text-gray-400 uppercase font-mono tracking-wider">
              Quick Samples:
            </span>
            <div className="flex gap-1.5 flex-wrap">
              <button
                onClick={() => handleLoadSample("python")}
                className="px-2 py-1 bg-white hover:bg-indigo-50 border border-gray-200 text-slate-600 hover:text-indigo-600 rounded-md font-mono text-[10px] font-bold transition-all shadow-xs"
              >
                Python
              </button>
              <button
                onClick={() => handleLoadSample("java")}
                className="px-2 py-1 bg-white hover:bg-indigo-50 border border-gray-200 text-slate-600 hover:text-indigo-600 rounded-md font-mono text-[10px] font-bold transition-all shadow-xs"
              >
                Java
              </button>
              <button
                onClick={() => handleLoadSample("cpp")}
                className="px-2 py-1 bg-white hover:bg-indigo-50 border border-gray-200 text-slate-600 hover:text-indigo-600 rounded-md font-mono text-[10px] font-bold transition-all shadow-xs"
              >
                C++
              </button>
              <button
                onClick={() => handleLoadSample("c")}
                className="px-2 py-1 bg-white hover:bg-indigo-50 border border-gray-200 text-slate-600 hover:text-indigo-600 rounded-md font-mono text-[10px] font-bold transition-all shadow-xs"
              >
                C
              </button>
              <button
                onClick={() => handleLoadSample("html")}
                className="px-2 py-1 bg-white hover:bg-indigo-50 border border-gray-200 text-slate-600 hover:text-indigo-600 rounded-md font-mono text-[10px] font-bold transition-all shadow-xs"
              >
                HTML
              </button>
            </div>
          </div>

            {/* Error alerts section */}
            {error && (
              <div className="bg-rose-50 border border-rose-100 p-3.5 rounded-xl text-rose-600 text-xs flex items-start gap-2.5 shadow-xs" id="app-error-banner">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span className="font-medium leading-normal">{error}</span>
              </div>
            )}

            {/* Custom Code Editor */}
            <div className="flex-1 min-h-[350px]">
              <CodeEditor
                value={inputCode}
                onChange={setInputCode}
                language={language || "other"}
                linesLimit={LINES_LIMIT}
              />
            </div>

            {/* Action buttons footer block */}
            <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between mt-2 pt-3 border-t border-slate-100" id="editor-actions">
              <button
                onClick={handleClear}
                disabled={loading}
                className="py-2.5 px-4 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 text-xs font-bold font-mono transition-colors disabled:opacity-50"
                id="clear-code-btn"
              >
                Clear Workspace
              </button>

              <button
                onClick={handleAnalyze}
                disabled={loading || !language || !inputCode.trim() || isCodeExceeded}
                className="flex-1 max-w-[280px] self-end sm:self-auto py-3 px-6 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white rounded-xl shadow-lg shadow-indigo-100 font-bold font-mono text-xs flex items-center justify-center gap-2 transition disabled:opacity-40 disabled:cursor-not-allowed"
                id="analyze-code-btn"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Executing Analysis...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Analyze & Optimise
                  </>
                )}
              </button>
            </div>
        </section>

        {/* Right Output Workspace Segment */}
        <section className="flex-1 flex flex-col gap-4 min-w-0" id="right-workspace-panel">
          {/* Default Slate Screen if no content */}
          {!loading && !result && (
            <div className="flex-1 bg-white rounded-2xl border border-slate-200 border-dashed p-12 flex flex-col items-center justify-center text-center shadow-xs min-h-[450px]" id="empty-state-view">
              <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center border border-slate-200 text-slate-400 mb-4 shadow-xs">
                <FileCode className="w-6 h-6" />
              </div>
              <h2 className="text-base font-bold text-slate-700 font-mono tracking-tight mb-2">
                Awaiting Source Code Submission
              </h2>
              <p className="text-xs text-slate-400 max-w-sm leading-relaxed mb-6">
                Ready to review and refactor. Select a programming language, insert your target snippet details, and hit <strong>Analyze & Optimise</strong> to get started.
              </p>
              
              {/* Informative Help Notice */}
              <div className="p-4 bg-indigo-50/50 border border-indigo-100 rounded-xl text-left max-w-md flex gap-3 text-indigo-900 text-xs">
                <span className="text-base">🚀</span>
                <p className="leading-normal">
                  Our system verifies code blocks up to <strong>50 lines</strong>, generating line-by-line visual differences alongside structural compile modifications and execution performance upgrades.
                </p>
              </div>
            </div>
          )}

          {/* Skeletons/Spinners communication Loading State */}
          {loading && (
            <div className="flex-1 bg-white rounded-2xl border border-slate-200 p-6 flex flex-col gap-6 shadow-sm min-h-[450px]" id="loading-skeleton-view">
              {/* Spinner Indicator */}
              <div className="flex items-center gap-3 bg-gradient-to-r from-indigo-50 to-emerald-50 border border-indigo-100/50 p-4 rounded-xl">
                <svg className="animate-spin h-5 w-5 text-indigo-600" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <div className="text-xs font-mono font-bold text-slate-700">
                  Compiling feedback loops from Google Gemini Models...
                </div>
              </div>

              {/* Layout Skeleton Block A */}
              <div className="space-y-4 animate-pulse">
                <div className="h-6 bg-slate-200 rounded-lg w-1/3"></div>
                <div className="space-y-2">
                  <div className="h-[120px] bg-slate-100 rounded-xl w-full"></div>
                </div>
              </div>

              {/* Layout Skeleton Block B */}
              <div className="space-y-4 animate-pulse">
                <div className="h-6 bg-slate-200 rounded-lg w-1/4"></div>
                <div className="space-y-2">
                  <div className="h-4 bg-slate-150 rounded w-full"></div>
                  <div className="h-4 bg-slate-150 rounded w-5/6"></div>
                  <div className="h-4 bg-slate-150 rounded w-2/3"></div>
                </div>
              </div>
            </div>
          )}

          {/* Corrected Interactive displays */}
          {result && (
            <div className="flex-1 flex flex-col gap-5 overflow-y-auto" id="analysis-results">
              {/* Summary Header Cards */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
                <div>
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full uppercase tracking-wider font-mono">
                      Verification Result
                    </span>
                    {customApiKey && (
                      <span className="text-[10px] bg-indigo-100 text-indigo-800 font-bold px-2 py-0.5 rounded-full uppercase tracking-wider font-mono">
                        Client Bypass
                      </span>
                    )}
                  </div>
                  <h3 className="text-sm font-black font-mono text-slate-800">
                    {result.success ? "Errors Identified & Adjusted" : "Zero Issues Found!"}
                  </h3>
                  <p className="text-xs text-slate-400 font-mono">
                    {result.diffData.length} lines analyzed in target workspace
                  </p>
                </div>

                {/* Top Level Action tools */}
                <div className="flex items-center gap-2 self-stretch sm:self-auto justify-end">
                  {/* Copy Correted Button */}
                  <button
                    onClick={handleCopyCorrected}
                    className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-2 text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200/50 rounded-xl text-xs font-bold font-mono transition-colors"
                    title="Copy Final Clean Corrected Code"
                    id="copy-corrected-btn"
                  >
                    {copiedCorrected ? (
                      <>
                        <Check className="w-4 h-4 text-emerald-600" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" />
                        Copy Code
                      </>
                    )}
                  </button>

                  {/* Download Code Button */}
                  <button
                    onClick={handleDownloadCorrected}
                    className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-2 text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-xl text-xs font-bold font-mono transition-colors"
                    title="Download Clean Corrected File"
                    id="download-corrected-btn"
                  >
                    <Download className="w-4 h-4" />
                    Download
                  </button>
                </div>
              </div>

              {/* Line-by-Line visual changes diff block */}
              <DiffViewer diffData={result.diffData} />

              {/* Technical breakdown list and advice blocks */}
              <ExplainAndOptimize
                technicalExplanation={result.technicalExplanation}
                alternativeImplementations={result.alternativeImplementations}
                optimizationTips={result.optimizationTips}
                language={language || "other"}
              />
            </div>
          )}
        </section>
      </main>

      {/* 4. Drawer slide-out collapsible past searches container */}
      <SidebarHistory
        history={history}
        onSelect={handleSelectHistory}
        onClear={handleClearHistory}
        isOpen={historyDrawerOpen}
        onClose={() => setHistoryDrawerOpen(false)}
        isEnabled={historyEnabled}
      />
    </div>
  );
}
