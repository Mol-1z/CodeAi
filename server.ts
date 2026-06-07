/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Accept larger json bodies for code segments
  app.use(express.json({ limit: "2mb" }));

  // API endpoint for server-side code analysis
  app.post("/api/analyze", async (req, res) => {
    try {
      const { code, language } = req.body;

      if (!code || !language) {
        return res.status(400).json({
          error: "Incomplete request: Both source code and selected language are required.",
        });
      }

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({
          error:
            "System API key (GEMINI_API_KEY) is not configured in Server Secrets. Please input your own Custom Gemini API Key in the settings section to bypass the server backend.",
        });
      }

      // Initialize Google Gen AI client with appropriate telemetry header
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build",
          },
        },
      });

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
${code}
\`\`\``;

      const aiResponse = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
        config: {
          systemInstruction,
          responseMimeType: "application/json",
          responseSchema,
          temperature: 0.1, // low temperature for precise, accurate analysis
        },
      });

      const responseText = aiResponse.text;
      if (!responseText) {
        throw new Error("Received an empty response from Gemini.");
      }

      const result = JSON.parse(responseText.trim());
      return res.json(result);
    } catch (err: any) {
      console.error("Analysis API Error:", err);
      return res.status(500).json({
        error: err.message || "An unexpected error occurred during core code compilation analysis.",
      });
    }
  });

  // Serve static assets out of client bundle, using Vite dev mode when local
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Express application container online at port ${PORT}`);
  });
}

startServer();
