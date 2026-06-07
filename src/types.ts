/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type Language = "java" | "python" | "cpp" | "c" | "html" | "other";

export interface DiffLine {
  type: "unchanged" | "deleted" | "added";
  content: string;
}

export interface AnalysisResponse {
  success: boolean;
  diffData: DiffLine[];
  technicalExplanation: string | string[];
  alternativeImplementations: string;
  optimizationTips: string | string[];
}

export interface HistoryItem {
  id: string;
  timestamp: number;
  language: string;
  inputCode: string;
  result: AnalysisResponse;
}
