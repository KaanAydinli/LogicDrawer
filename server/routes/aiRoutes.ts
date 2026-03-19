/**
 * @file Defines the routes for AI-related functionalities.
 */

import express from "express";
import { spawn } from "child_process";
import path from "path";
import fs from "fs";

import { optionalAuth, AuthRequest } from "../middlewares/auth";
import { aiRateLimit, getRateLimitStatus } from "../middlewares/aiRateLimit";

import { Logger } from "../utils/logger";
import { circuitDetectionService } from "../services/circuitDetectionService";
import { updateDetectionStats } from "../models/DetectionStats";

const router = express.Router();

type OpenRouterTool = {
  type: "function";
  function: {
    name: string;
    description?: string;
    parameters?: any;
  };
};

function getOpenRouterConfig() {
  const apiKey = process.env.OPENROUTER_API_KEY;
  const model = process.env.OPENROUTER_MODEL || "stepfun/step-3.5-flash:free";
  if (!apiKey) {
    throw new Error("OpenRouter API key not configured");
  }
  return { apiKey, model };
}

function getOpenRouterMaxTokens() {
  const raw = process.env.OPENROUTER_MAX_TOKENS;
  const parsed = raw ? Number(raw) : NaN;
  if (Number.isFinite(parsed) && parsed > 0) {
    return Math.floor(parsed);
  }
  return 1024;
}

function normalizeSchemaType(typeValue: any): string | undefined {
  if (typeof typeValue !== "string") return undefined;
  const t = typeValue.toLowerCase();
  switch (t) {
    case "object":
    case "array":
    case "string":
    case "number":
    case "integer":
    case "boolean":
    case "null":
      return t;
    default:
      return undefined;
  }
}

function geminiSchemaToJsonSchema(schema: any): any {
  if (!schema || typeof schema !== "object") {
    return { type: "object", properties: {} };
  }

  const normalizedType = normalizeSchemaType(schema.type);
  const out: any = {};

  if (normalizedType) {
    out.type = normalizedType;
  }

  if (schema.description) out.description = schema.description;
  if (Array.isArray(schema.enum)) out.enum = schema.enum;

  const effectiveType = out.type || (schema.properties ? "object" : undefined);

  if (effectiveType === "object") {
    out.type = "object";
    const props = schema.properties && typeof schema.properties === "object" ? schema.properties : {};
    out.properties = Object.fromEntries(
      Object.entries(props).map(([key, val]) => [key, geminiSchemaToJsonSchema(val)])
    );
    if (Array.isArray(schema.required)) {
      out.required = schema.required.filter((r: any) => typeof r === "string");
    }
  } else if (effectiveType === "array") {
    out.type = "array";
    out.items = geminiSchemaToJsonSchema(schema.items || { type: "object", properties: {} });
  }

  return out;
}

function mapGeminiToolsToOpenRouterTools(tools: any): OpenRouterTool[] | undefined {
  if (!Array.isArray(tools)) return undefined;

  const declarations = tools.flatMap((t: any) =>
    Array.isArray(t?.functionDeclarations) ? t.functionDeclarations : []
  );

  if (declarations.length === 0) return undefined;

  return declarations.map((fn: any) => ({
    type: "function",
    function: {
      name: fn.name,
      description: fn.description,
      parameters: geminiSchemaToJsonSchema(fn.parameters || { type: "OBJECT", properties: {} }),
    },
  }));
}

function tryParseJson(value: string | undefined): any {
  if (!value) return {};
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
}

function extractImageData(imageData: string): { mimeType: string; base64Data: string } {
  let base64Data = imageData;
  let mimeType = "image/jpeg";

  if (imageData.includes("base64,")) {
    const matches = imageData.match(/^data:([A-Za-z-+/]+);base64,(.+)$/);
    if (matches && matches.length === 3) {
      mimeType = matches[1];
      base64Data = matches[2];
    } else {
      base64Data = imageData.split("base64,")[1];
    }
  }

  if (!base64Data) {
    throw new Error("Could not extract base64 data from image");
  }

  return { mimeType, base64Data };
}

function toOpenRouterMessages(
  message: string | undefined,
  history: any[] | undefined,
  parts: any[] | undefined,
  image: string | undefined,
  systemPrompt?: string
) {
  const messages: any[] = [];

  if (systemPrompt) {
    messages.push({ role: "system", content: systemPrompt });
  }

  if (history && Array.isArray(history)) {
    for (const msg of history) {
      if (msg.parts && Array.isArray(msg.parts)) {
        const functionCallPart = msg.parts.find((p: any) => p.functionCall);
        if (functionCallPart?.functionCall) {
          const call = functionCallPart.functionCall;
          const callId = `call_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
          messages.push({
            role: "assistant",
            content: "",
            tool_calls: [
              {
                id: callId,
                type: "function",
                function: {
                  name: call.name,
                  arguments: JSON.stringify(call.args || {}),
                },
              },
            ],
          });
          continue;
        }

        const functionRespPart = msg.parts.find((p: any) => p.functionResponse);
        if (functionRespPart?.functionResponse) {
          const fr = functionRespPart.functionResponse;
          messages.push({
            role: "tool",
            tool_call_id: fr.name || "tool_call",
            content:
              typeof fr.response === "string"
                ? fr.response
                : JSON.stringify(fr.response || {}, null, 0),
          });
          continue;
        }

        const textParts = msg.parts
          .map((p: any) => p.text)
          .filter((t: string | undefined) => typeof t === "string" && t.length > 0);
        if (textParts.length > 0) {
          messages.push({
            role: msg.role === "user" ? "user" : "assistant",
            content: textParts.join("\n\n"),
          });
        }
      } else {
        messages.push({
          role: msg.role === "user" ? "user" : "assistant",
          content: msg.content || "",
        });
      }
    }
  }

  const userContent: any[] = [];
  if (message) {
    userContent.push({ type: "text", text: message });
  }

  if (parts && Array.isArray(parts)) {
    for (const p of parts) {
      if (p?.text) userContent.push({ type: "text", text: p.text });
      if (p?.functionResponse) {
        const fr = p.functionResponse;
        messages.push({
          role: "tool",
          tool_call_id: fr.name || "tool_call",
          content:
            typeof fr.response === "string"
              ? fr.response
              : JSON.stringify(fr.response || {}, null, 0),
        });
      }
    }
  }

  if (image) {
    const { mimeType, base64Data } = extractImageData(image);
    userContent.push({
      type: "image_url",
      image_url: { url: `data:${mimeType};base64,${base64Data}` },
    });
  }

  if (userContent.length > 0) {
    messages.push({ role: "user", content: userContent });
  }

  return messages;
}

/**
 * Get current rate limit status for the client
 */
router.get("/rate-limit-status", optionalAuth, (req: AuthRequest, res, next) => {
  try {
    // If user is authenticated, they have unlimited access
    if (req.user) {
      return res.json({
        authenticated: true,
        unlimited: true,
        message: "You have unlimited access to AI features.",
      });
    }

    // For unauthenticated users, return their current rate limit status
    const clientIp = req.ip || req.connection.remoteAddress || "unknown";
    const status = getRateLimitStatus(clientIp);

    res.json({
      authenticated: false,
      unlimited: false,
      ...status,
      message:
        status.remaining > 0
          ? `You have ${status.remaining} messages remaining today.`
          : "You have reached your daily limit. Please create an account for unlimited access.",
    });
  } catch (error) {
    res.status(500).json({
      error: "Failed to get rate limit status",
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

router.post("/analyze/yolo", optionalAuth, aiRateLimit, async (req, res) => {
  try {
    const { base64Image } = req.body;
    if (!base64Image) {
      return res.status(400).json({ error: "No image provided" });
    }

    // Track if client disconnects
    let clientAborted = false;
    req.on("aborted", () => {
      clientAborted = true;
      Logger.log("Client aborted YOLO detection request");
    });

    // Use the persistent service with timeout protection
    const detectionPromise = circuitDetectionService.detect(base64Image);
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Detection timeout after 90s")), 90000)
    );

    const result = await Promise.race([detectionPromise, timeoutPromise]);

    // Don't send response if client already disconnected
    if (clientAborted) {
      Logger.log("Client disconnected before detection completed");
      return;
    }

    // Check if the service returned an error object
    if (result.error) {
      Logger.error("Detection service returned error:", result.error);
      return res.status(500).json({ error: result.error });
    }

    // Update statistics after successful detection
    if (result.gates && Array.isArray(result.gates)) {
      const componentsCount = result.gates.length;
      // Update stats asynchronously (fire and forget)
      updateDetectionStats(1, componentsCount).catch(err => {
        Logger.error("Failed to update detection stats:", err);
      });
    }

    res.json(result);
  } catch (error) {
    // Check if request was already aborted
    if (req.socket.destroyed) {
      Logger.log("Cannot send error response - client already disconnected");
      return;
    }

    Logger.error("Python processing error:", error);
    res.status(500).json({
      error: "Python processing error",
      details: (error as Error).message,
    });
  }
});

/**
 * Main Agent Chat Endpoint with Tool Support
 */
router.post("/agent/chat", optionalAuth, aiRateLimit, async (req, res) => {
  try {
    const { message, systemPrompt, history, tools, image, parts } = req.body;

    if (!message && !image && !parts) {
      return res.status(400).json({ error: "No message, image, or parts provided" });
    }

    try {
      const { apiKey, model } = getOpenRouterConfig();
      const mappedTools = mapGeminiToolsToOpenRouterTools(tools);
      const messages = toOpenRouterMessages(message, history, parts, image, systemPrompt);

      const payload: any = {
        model,
        messages,
        max_tokens: getOpenRouterMaxTokens(),
      };
      if (mappedTools && mappedTools.length > 0) {
        payload.tools = mappedTools;
        payload.tool_choice = "auto";
      }

      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`OpenRouter error ${response.status}: ${errText}`);
      }

      const data = await response.json();
      const choice = data?.choices?.[0]?.message;

      if (choice?.tool_calls && Array.isArray(choice.tool_calls) && choice.tool_calls.length > 0) {
        const functionCalls = choice.tool_calls.map((c: any) => ({
          name: c?.function?.name,
          args: tryParseJson(c?.function?.arguments),
        }));
        return res.json({ functionCalls });
      }

      const text = typeof choice?.content === "string" ? choice.content : "";
      return res.json({ text });
    } catch (error) {
      Logger.error("OpenRouter Agent Error:", error);
      return res.status(500).json({
        error: "Agent processing failed",
        details: error instanceof Error ? error.message : String(error),
      });
    }
  } catch (error) {
    return res.status(500).json({
      error: "Internal server error",
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * Generate text with OpenRouter.
 */
router.post("/generate/gemini-text", optionalAuth, aiRateLimit, async (req, res) => {
  try {
    const { prompt, systemPrompt, history } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: "No prompt provided" });
    }

    try {
      const { apiKey, model } = getOpenRouterConfig();

      let fullPrompt = prompt;
      if (systemPrompt) {
        // Format history if it's an array
        if (history && Array.isArray(history)) {
          const historyText = history
            .map(msg => `${msg.role === "user" ? "User" : "AI"}: ${msg.content}`)
            .join("\n");

          fullPrompt = `"The following is your System Prompt: "${systemPrompt}\n "Here is the conversation history with you and the user" \n${historyText}\n\nThis is the User Last Message: ${prompt}`;
        } else {
          fullPrompt = `${systemPrompt}\n\n${prompt}`;
        }
      }

      // Check if client requested streaming
      const useStreaming = req.query.stream === "true" || req.body.stream === true;

      const messages = [{ role: "user", content: fullPrompt }];

      if (useStreaming) {
        // Set up headers for SSE
        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Connection", "keep-alive");

        try {
          const streamingResponse = await fetch(
            "https://openrouter.ai/api/v1/chat/completions",
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${apiKey}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                model,
                messages,
                stream: true,
                max_tokens: getOpenRouterMaxTokens(),
              }),
            }
          );

          if (!streamingResponse.ok || !streamingResponse.body) {
            const errText = await streamingResponse.text();
            throw new Error(`OpenRouter streaming error ${streamingResponse.status}: ${errText}`);
          }

          const reader = streamingResponse.body.getReader();
          const decoder = new TextDecoder();
          let buffer = "";

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";

            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed.startsWith("data:")) continue;
              const dataStr = trimmed.replace(/^data:\s*/, "");
              if (dataStr === "[DONE]") continue;

              try {
                const evt = JSON.parse(dataStr);
                const delta = evt?.choices?.[0]?.delta?.content;
                if (delta) {
                  res.write(`data: ${JSON.stringify({ chunk: delta })}\n\n`);
                }
              } catch {
                // ignore malformed partial lines
              }
            }
          }

          // Send end of stream signal
          res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
          res.end();
        } catch (streamError) {
          if (!res.headersSent) {
            return res.status(500).json({
              error: "Streaming error",
              details: streamError instanceof Error ? streamError.message : String(streamError),
            });
          } else {
            res.write(
              `data: ${JSON.stringify({
                error: "Streaming error",
                details: streamError instanceof Error ? streamError.message : String(streamError),
              })}\n\n`
            );
            res.end();
          }
        }
      } else {
        // Use non-streaming API for regular requests
        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model,
            messages,
            max_tokens: getOpenRouterMaxTokens(),
          }),
        });

        if (!response.ok) {
          const errText = await response.text();
          throw new Error(`OpenRouter error ${response.status}: ${errText}`);
        }

        const data = await response.json();
        const text = data?.choices?.[0]?.message?.content || "";
        return res.json({ text });
      }
    } catch (error) {
      return res.status(500).json({
        error: "Failed to generate text with OpenRouter",
        details: error instanceof Error ? error.message : String(error),
      });
    }
  } catch (error) {
    return res.status(500).json({
      error: "Internal server error",
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

// OpenRouter Vision ile görüntü analizi
router.post("/generate/gemini-vision", optionalAuth, aiRateLimit, async (req, res) => {
  try {
    const { prompt, imageData } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: "No prompt provided" });
    }

    if (!imageData) {
      return res.status(400).json({ error: "No image data provided" });
    }

    try {
      const { apiKey, model } = getOpenRouterConfig();
      let base64Data: string;
      let mimeType: string;

      try {
        const parsed = extractImageData(imageData);
        base64Data = parsed.base64Data;
        mimeType = parsed.mimeType;
      } catch {
        return res.status(400).json({ error: "Invalid image data format" });
      }

      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          max_tokens: getOpenRouterMaxTokens(),
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: prompt },
                {
                  type: "image_url",
                  image_url: {
                    url: `data:${mimeType};base64,${base64Data}`,
                  },
                },
              ],
            },
          ],
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`OpenRouter vision error ${response.status}: ${errText}`);
      }

      const data = await response.json();
      const text = data?.choices?.[0]?.message?.content || "";

      return res.json({ text });
    } catch (error) {
      return res.status(500).json({
        error: "Failed to analyze image with OpenRouter",
        details: error instanceof Error ? error.message : String(error),
      });
    }
  } catch (error) {
    return res.status(500).json({
      error: "Internal server error",
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

router.post("/dev/react-trace", async (req, res) => {
  if (process.env.LOGICDRAWER_DEV !== "true") {
    return res.status(404).json({ error: "Not found" });
  }

  try {
    const trace = req.body;
    if (!trace || typeof trace !== "object") {
      return res.status(400).json({ error: "Invalid trace payload" });
    }

    // In prod (compiled): __dirname = server/dist/routes → ../../.. = project root
    // In dev (ts-node-dev): __dirname = server/routes → ../.. = project root
    const projectRoot = __dirname.includes("dist")
      ? path.resolve(__dirname, "../../..")
      : path.resolve(__dirname, "../..");
    const tracesDir = path.join(projectRoot, "react-traces");
    if (!fs.existsSync(tracesDir)) {
      fs.mkdirSync(tracesDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const filename = `react-trace-${timestamp}.json`;
    fs.writeFileSync(path.join(tracesDir, filename), JSON.stringify(trace, null, 2), "utf-8");

    Logger.log(`[DevTrace] Saved ReAct trace: ${filename}`);
    return res.json({ saved: filename });
  } catch (error) {
    Logger.error("[DevTrace] Failed to save trace:", error);
    return res.status(500).json({ error: "Failed to save trace" });
  }
});

export default router;
