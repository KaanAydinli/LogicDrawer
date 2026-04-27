/**
 * @file Defines the routes for AI-related functionalities.
 *
 * Powered by Anthropic Claude (Sonnet 4.5).
 *
 * The frontend (AIAgent + tools) was originally written against the Gemini
 * function-calling shape: it sends `{message, parts, history, tools}` in the
 * Gemini format and expects `{functionCalls: [{name, args}]} | {text}` back.
 * To avoid touching every tool, this module accepts that Gemini-shaped
 * payload, translates it to Anthropic's `messages` + `tool_use`/`tool_result`
 * format, calls Claude with prompt caching enabled, and translates the
 * response back into the legacy shape.
 */

import express from "express";
import path from "path";
import fs from "fs";
import Anthropic from "@anthropic-ai/sdk";

import { optionalAuth, AuthRequest } from "../middlewares/auth";
import { aiRateLimit, getRateLimitStatus } from "../middlewares/aiRateLimit";

import { Logger } from "../utils/logger";
import { circuitDetectionService } from "../services/circuitDetectionService";
import { updateDetectionStats } from "../models/DetectionStats";
import { updateAgentStats } from "../models/AgentStats";

const router = express.Router();

const CLAUDE_MODEL = "claude-sonnet-4-5";
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || "" });

type ImageMediaType = "image/jpeg" | "image/png" | "image/gif" | "image/webp";

type AnthropicContentBlock =
  | { type: "text"; text: string; cache_control?: { type: "ephemeral" } }
  | { type: "image"; source: { type: "base64"; media_type: ImageMediaType; data: string } }
  | { type: "tool_use"; id: string; name: string; input: any }
  | { type: "tool_result"; tool_use_id: string; content: string; is_error?: boolean };

function normalizeImageMediaType(raw: string): ImageMediaType {
  const lower = (raw || "").toLowerCase();
  if (lower === "image/png") return "image/png";
  if (lower === "image/gif") return "image/gif";
  if (lower === "image/webp") return "image/webp";
  return "image/jpeg";
}

type AnthropicMessage = {
  role: "user" | "assistant";
  content: AnthropicContentBlock[];
};

function decodeBase64Image(image: string): { mediaType: ImageMediaType; data: string } {
  let rawMediaType = "image/jpeg";
  let data = image;
  if (image.includes("base64,")) {
    const matches = image.match(/^data:([A-Za-z\-+/]+);base64,(.+)$/);
    if (matches && matches.length === 3) {
      rawMediaType = matches[1];
      data = matches[2];
    } else {
      data = image.split("base64,")[1];
    }
  }
  return { mediaType: normalizeImageMediaType(rawMediaType), data };
}

/**
 * Recursively normalize a Gemini-shaped JSON Schema for Anthropic.
 * Gemini uses uppercase type strings ("OBJECT"/"STRING"); Anthropic requires
 * the standard lowercase JSON Schema vocabulary.
 */
function normalizeSchema(schema: any): any {
  if (Array.isArray(schema)) return schema.map(normalizeSchema);
  if (!schema || typeof schema !== "object") return schema;

  const out: any = {};
  for (const [key, value] of Object.entries(schema)) {
    if (key === "type" && typeof value === "string") {
      out.type = value.toLowerCase();
    } else if (
      key === "properties" &&
      value &&
      typeof value === "object" &&
      !Array.isArray(value)
    ) {
      const props: any = {};
      for (const [propName, propSchema] of Object.entries(value as Record<string, any>)) {
        props[propName] = normalizeSchema(propSchema);
      }
      out.properties = props;
    } else if (key === "items") {
      out.items = normalizeSchema(value);
    } else {
      out[key] = value;
    }
  }
  return out;
}

/**
 * Convert frontend Gemini-shaped tools into Anthropic's tool format.
 *
 * Frontend sends:
 *   [{ functionDeclarations: [{ name, description, parameters }] }]
 * Anthropic expects:
 *   [{ name, description, input_schema }]
 *
 * Marks the LAST tool with `cache_control: ephemeral` so the entire tool
 * block (rendered before the system prompt) becomes part of the cached
 * prefix on subsequent requests.
 */
function convertTools(geminiTools: any): any[] {
  if (!Array.isArray(geminiTools)) return [];
  const out: any[] = [];
  for (const t of geminiTools) {
    const decls = Array.isArray(t?.functionDeclarations) ? t.functionDeclarations : [];
    for (const fd of decls) {
      const normalized = fd.parameters
        ? normalizeSchema(fd.parameters)
        : { type: "object", properties: {} };
      // Anthropic requires the top-level schema to be `type: "object"`.
      if (normalized.type !== "object") {
        normalized.type = "object";
      }
      if (!normalized.properties || typeof normalized.properties !== "object") {
        normalized.properties = {};
      }
      out.push({
        name: fd.name,
        description: fd.description || "",
        input_schema: normalized,
      });
    }
  }
  if (out.length > 0) {
    out[out.length - 1].cache_control = { type: "ephemeral" };
  }
  return out;
}

/**
 * Walk the Gemini-shaped history + current turn and emit Anthropic messages.
 *
 * Tool-call/tool-result pairing: Gemini history doesn't carry IDs, so we
 * assign sequential `toolu_<n>` IDs in order. The Nth functionCall pairs
 * with the Nth functionResponse — a safe assumption because the agent loop
 * pushes them in lockstep.
 */
function buildAnthropicMessages(
  history: any[],
  current: { message?: string | null; parts?: any[]; image?: string }
): AnthropicMessage[] {
  let toolUseCounter = 0;
  let toolResultCounter = 0;
  const messages: AnthropicMessage[] = [];

  const convertParts = (parts: any[]): AnthropicContentBlock[] => {
    const blocks: AnthropicContentBlock[] = [];
    for (const part of parts) {
      if (part.text) {
        blocks.push({ type: "text", text: part.text });
      } else if (part.functionCall) {
        blocks.push({
          type: "tool_use",
          id: `toolu_${toolUseCounter++}`,
          name: part.functionCall.name,
          input: part.functionCall.args || {},
        });
      } else if (part.functionResponse) {
        const resp = part.functionResponse.response;
        const inner = resp && typeof resp === "object" && "content" in resp ? resp.content : resp;
        const text = typeof inner === "string" ? inner : JSON.stringify(inner ?? "");
        blocks.push({
          type: "tool_result",
          tool_use_id: `toolu_${toolResultCounter++}`,
          content: text,
        });
      } else if (part.inlineData) {
        blocks.push({
          type: "image",
          source: {
            type: "base64",
            media_type: normalizeImageMediaType(part.inlineData.mimeType),
            data: part.inlineData.data,
          },
        });
      }
    }
    return blocks;
  };

  if (Array.isArray(history)) {
    for (const msg of history) {
      const role: "user" | "assistant" =
        msg.role === "model" || msg.role === "assistant" ? "assistant" : "user";
      let content: AnthropicContentBlock[] = [];
      if (Array.isArray(msg.parts)) {
        content = convertParts(msg.parts);
      } else if (msg.content) {
        content = [{ type: "text", text: String(msg.content) }];
      }
      if (content.length > 0) messages.push({ role, content });
    }
  }

  // Sanitize: first message must be user; merge consecutive same-role turns.
  while (messages.length > 0 && messages[0].role !== "user") messages.shift();
  const merged: AnthropicMessage[] = [];
  for (const m of messages) {
    const last = merged[merged.length - 1];
    if (last && last.role === m.role) {
      last.content = last.content.concat(m.content);
    } else {
      merged.push(m);
    }
  }

  // Build the current turn.
  const currentBlocks: AnthropicContentBlock[] = [];
  if (Array.isArray(current.parts)) {
    currentBlocks.push(...convertParts(current.parts));
  }
  if (current.image) {
    const { mediaType, data } = decodeBase64Image(current.image);
    currentBlocks.push({
      type: "image",
      source: { type: "base64", media_type: mediaType, data },
    });
  }
  if (current.message) {
    currentBlocks.push({ type: "text", text: current.message });
  }

  if (currentBlocks.length > 0) {
    const lastRole = merged[merged.length - 1]?.role;
    if (lastRole === "user") {
      merged[merged.length - 1].content =
        merged[merged.length - 1].content.concat(currentBlocks);
    } else {
      merged.push({ role: "user", content: currentBlocks });
    }
  }

  return merged;
}

/**
 * Get current rate limit status for the client
 */
router.get("/rate-limit-status", optionalAuth, (req: AuthRequest, res, _next) => {
  try {
    if (req.user) {
      return res.json({
        authenticated: true,
        unlimited: true,
        message: "You have unlimited access to AI features.",
      });
    }

    const clientIp = req.ip || req.socket.remoteAddress || "unknown";
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

    let clientAborted = false;
    req.on("aborted", () => {
      clientAborted = true;
      Logger.log("Client aborted YOLO detection request");
    });

    const detectionPromise = circuitDetectionService.detect(base64Image);
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Detection timeout after 90s")), 90000)
    );

    const result = await Promise.race([detectionPromise, timeoutPromise]);

    if (clientAborted) {
      Logger.log("Client disconnected before detection completed");
      return;
    }

    if (result.error) {
      Logger.error("Detection service returned error:", result.error);
      return res.status(500).json({ error: result.error });
    }

    if (result.gates && Array.isArray(result.gates)) {
      const componentsCount = result.gates.length;
      updateDetectionStats(1, componentsCount).catch(err => {
        Logger.error("Failed to update detection stats:", err);
      });
    }

    res.json(result);
  } catch (error) {
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
 * Main Agent Chat Endpoint with Tool Support — Claude Sonnet 4.5.
 *
 * Accepts the legacy Gemini-shaped payload from the frontend, calls Claude
 * with prompt caching, and returns the legacy shape: either
 * `{functionCalls: [{name, args}]}` (when Claude calls a tool) or
 * `{text: ...}` (when Claude returns plain text).
 */
router.post("/agent/chat", optionalAuth, aiRateLimit, async (req, res) => {
  try {
    const { message, systemPrompt, history, tools, image, parts } = req.body;

    if (!message && !image && !parts) {
      return res.status(400).json({ error: "No message, image, or parts provided" });
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return res.status(500).json({ error: "Anthropic API key not configured" });
    }

    const anthropicTools = convertTools(tools);
    const anthropicMessages = buildAnthropicMessages(history || [], { message, parts, image });

    if (anthropicMessages.length === 0) {
      return res.status(400).json({ error: "No valid message content" });
    }

    const system = systemPrompt
      ? [{ type: "text" as const, text: String(systemPrompt), cache_control: { type: "ephemeral" as const } }]
      : undefined;

    const response = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 4096,
      system,
      tools: anthropicTools.length > 0 ? anthropicTools : undefined,
      tool_choice:
        anthropicTools.length > 0
          ? { type: "auto", disable_parallel_tool_use: true }
          : undefined,
      messages: anthropicMessages,
    });

    if (response.usage) {
      Logger.log(
        `[Claude] in=${response.usage.input_tokens} out=${response.usage.output_tokens} ` +
          `cache_read=${response.usage.cache_read_input_tokens ?? 0} ` +
          `cache_write=${response.usage.cache_creation_input_tokens ?? 0}`
      );
    }

    const toolUses = response.content.filter((b: any) => b.type === "tool_use");

    // Telemetry: a "user message" is the first turn of an agent loop —
    // frontend sends it with `message` set and no `parts`. Subsequent turns
    // ship `parts: [{functionResponse}]` and shouldn't bump that counter.
    const isUserKickoff = !!message && !parts;
    void updateAgentStats({
      agentCalls: 1,
      userMessages: isUserKickoff ? 1 : 0,
      toolCalls: toolUses.length,
      inputTokens: response.usage?.input_tokens ?? 0,
      outputTokens: response.usage?.output_tokens ?? 0,
      cacheReadTokens: response.usage?.cache_read_input_tokens ?? 0,
      cacheWriteTokens: response.usage?.cache_creation_input_tokens ?? 0,
    });

    if (toolUses.length > 0) {
      const functionCalls = toolUses.map((b: any) => ({
        name: b.name,
        args: b.input ?? {},
      }));
      return res.json({ functionCalls });
    }

    const textBlock = response.content.find((b: any) => b.type === "text") as any;
    return res.json({ text: textBlock ? textBlock.text : "" });
  } catch (error) {
    Logger.error("Claude Agent Error:", error);
    if (error instanceof Anthropic.RateLimitError) {
      return res.status(429).json({
        error: "Rate limited by upstream provider",
        details: error.message,
      });
    }
    if (error instanceof Anthropic.APIError) {
      return res.status(error.status ?? 500).json({
        error: "Agent processing failed",
        details: error.message,
      });
    }
    return res.status(500).json({
      error: "Agent processing failed",
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * Generate text — Claude Sonnet 4.5. Endpoint name kept for frontend compat.
 */
router.post("/generate/gemini-text", optionalAuth, aiRateLimit, async (req, res) => {
  try {
    const { prompt, systemPrompt, history } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: "No prompt provided" });
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return res.status(500).json({ error: "Anthropic API key not configured" });
    }

    const messages: AnthropicMessage[] = [];
    if (history && Array.isArray(history)) {
      for (const msg of history) {
        messages.push({
          role: msg.role === "user" ? "user" : "assistant",
          content: [{ type: "text", text: String(msg.content || "") }],
        });
      }
    }
    messages.push({ role: "user", content: [{ type: "text", text: prompt }] });

    // Sanitize: first must be user, alternating.
    while (messages.length > 0 && messages[0].role !== "user") messages.shift();
    const merged: AnthropicMessage[] = [];
    for (const m of messages) {
      const last = merged[merged.length - 1];
      if (last && last.role === m.role) {
        last.content = last.content.concat(m.content);
      } else {
        merged.push(m);
      }
    }

    const system = systemPrompt
      ? [{ type: "text" as const, text: String(systemPrompt), cache_control: { type: "ephemeral" as const } }]
      : undefined;

    const useStreaming = req.query.stream === "true" || req.body.stream === true;

    if (useStreaming) {
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      try {
        const stream = anthropic.messages.stream({
          model: CLAUDE_MODEL,
          max_tokens: 4096,
          system,
          messages: merged,
        });

        for await (const event of stream) {
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          ) {
            res.write(`data: ${JSON.stringify({ chunk: event.delta.text })}\n\n`);
          }
        }
        res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
        res.end();
      } catch (streamError) {
        if (!res.headersSent) {
          return res.status(500).json({
            error: "Streaming error",
            details: streamError instanceof Error ? streamError.message : String(streamError),
          });
        }
        res.write(
          `data: ${JSON.stringify({
            error: "Streaming error",
            details: streamError instanceof Error ? streamError.message : String(streamError),
          })}\n\n`
        );
        res.end();
      }
      return;
    }

    const response = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 4096,
      system,
      messages: merged,
    });

    const textBlock = response.content.find((b: any) => b.type === "text") as any;
    return res.json({ text: textBlock ? textBlock.text : "" });
  } catch (error) {
    Logger.error("Claude text generation error:", error);
    return res.status(500).json({
      error: "Failed to generate text",
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * Vision endpoint — Claude Sonnet 4.5. Endpoint name kept for frontend compat.
 */
router.post("/generate/gemini-vision", optionalAuth, aiRateLimit, async (req, res) => {
  try {
    const { prompt, imageData } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: "No prompt provided" });
    }
    if (!imageData) {
      return res.status(400).json({ error: "No image data provided" });
    }
    if (!process.env.ANTHROPIC_API_KEY) {
      return res.status(500).json({ error: "Anthropic API key not configured" });
    }

    let mediaType: ImageMediaType;
    let data: string;
    try {
      const decoded = decodeBase64Image(imageData);
      mediaType = decoded.mediaType;
      data = decoded.data;
      if (!data) throw new Error("Could not extract base64 data from image");
    } catch {
      return res.status(400).json({ error: "Invalid image data format" });
    }

    const response = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 4096,
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: mediaType, data } },
            { type: "text", text: prompt },
          ],
        },
      ],
    });

    const textBlock = response.content.find((b: any) => b.type === "text") as any;
    return res.json({ text: textBlock ? textBlock.text : "" });
  } catch (error) {
    Logger.error("Claude vision error:", error);
    return res.status(500).json({
      error: "Failed to analyze image",
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

router.post("/dev/agent-trace", async (req, res) => {
  if (process.env.LOGICDRAWER_DEV !== "true") {
    return res.status(404).json({ error: "Not found" });
  }

  try {
    const trace = req.body;
    if (!trace || typeof trace !== "object") {
      return res.status(400).json({ error: "Invalid trace payload" });
    }

    const projectRoot = __dirname.includes("dist")
      ? path.resolve(__dirname, "../../..")
      : path.resolve(__dirname, "../..");
    const tracesDir = path.join(projectRoot, "agent-traces");
    if (!fs.existsSync(tracesDir)) {
      fs.mkdirSync(tracesDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const filename = `agent-trace-${timestamp}.json`;
    fs.writeFileSync(path.join(tracesDir, filename), JSON.stringify(trace, null, 2), "utf-8");

    Logger.log(`[DevTrace] Saved Agent trace: ${filename}`);
    return res.json({ saved: filename });
  } catch (error) {
    Logger.error("[DevTrace] Failed to save trace:", error);
    return res.status(500).json({ error: "Failed to save trace" });
  }
});

export default router;
