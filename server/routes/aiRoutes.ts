/**
 * @file Defines the routes for AI-related functionalities.
 */

import express from "express";
import { spawn } from "child_process";
import path from "path";
import fs from "fs";
import { GoogleGenerativeAI } from "@google/generative-ai";

import { optionalAuth, AuthRequest } from "../middlewares/auth";
import { aiRateLimit, getRateLimitStatus } from "../middlewares/aiRateLimit";

import { Logger } from "../utils/logger";
import { circuitDetectionService } from "../services/circuitDetectionService";
import { updateDetectionStats } from "../models/DetectionStats";

const router = express.Router();
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY || "");

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

    const googleApiKey = process.env.GOOGLE_API_KEY;
    if (!googleApiKey) {
      return res.status(500).json({ error: "Google API key not configured" });
    }

    try {
      const modelParams: any = {
        model: "gemini-2.5-flash",
      };

      if (systemPrompt) {
        modelParams.systemInstruction = systemPrompt;
      }

      if (tools) {
        modelParams.tools = tools;
      }

      const model = genAI.getGenerativeModel(modelParams);

      let userParts: any[] = [];

      if (image) {
        let base64Data = image;
        let mimeType = "image/jpeg";

        if (image.includes("base64,")) {
          const matches = image.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
          if (matches && matches.length === 3) {
            mimeType = matches[1];
            base64Data = matches[2];
          } else {
            base64Data = image.split("base64,")[1];
          }
        }

        userParts.push({
          inlineData: {
            data: base64Data,
            mimeType: mimeType,
          },
        });
      }

      if (message) {
        userParts.push({ text: message });
      }

      if (parts) {
        userParts = userParts.concat(parts);
      }

      let chatHistory: any[] = [];
      if (history && Array.isArray(history)) {
        chatHistory = history.map((msg: any) => {
          if (msg.parts) {
            let role = msg.role === "user" ? "user" : "model";
            if (msg.parts.some((p: any) => p.functionResponse)) {
              role = "function";
            }
            return {
              role: role,
              parts: msg.parts,
            };
          }

          return {
            role: msg.role === "user" ? "user" : "model",
            parts: [{ text: msg.content || "" }],
          };
        });

        if (chatHistory.length > 0 && chatHistory[0].role === "model") {
          chatHistory.shift();
        }

        const sanitizedHistory = [];
        if (chatHistory.length > 0) {
          let currentMsg = chatHistory[0];

          for (let i = 1; i < chatHistory.length; i++) {
            const nextMsg = chatHistory[i];
            if (nextMsg.role === currentMsg.role) {
              const isTextOnly = (parts: any[]) =>
                Array.isArray(parts) && parts.length === 1 && parts[0].text;

              if (isTextOnly(currentMsg.parts) && isTextOnly(nextMsg.parts)) {
                currentMsg.parts[0].text += "\n\n" + nextMsg.parts[0].text;
              } else {
                currentMsg.parts = currentMsg.parts.concat(nextMsg.parts);
              }
            } else {
              sanitizedHistory.push(currentMsg);
              currentMsg = nextMsg;
            }
          }
          sanitizedHistory.push(currentMsg);
          chatHistory = sanitizedHistory;
        }
      }

      let currentRole = "user";
      if (userParts.some(p => p.functionResponse)) {
        currentRole = "function";
      }
      const contents = [...chatHistory, { role: currentRole, parts: userParts }];

      const result = await model.generateContent({
        contents: contents,
      });
      const response = result.response;

      const call = response.functionCalls();

      if (call && call.length > 0) {
        const functionCalls = call.map(c => ({
          name: c.name,
          args: c.args,
        }));
        return res.json({ functionCalls });
      }

      const text = response.text();
      return res.json({ text });
    } catch (error) {
      Logger.error("Gemini Agent Error:", error);
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
 * Generate text with Gemini.
 */
router.post("/generate/gemini-text", optionalAuth, aiRateLimit, async (req, res) => {
  try {
    const { prompt, systemPrompt, history } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: "No prompt provided" });
    }

    const googleApiKey = process.env.GOOGLE_API_KEY;
    if (!googleApiKey) {
      return res.status(500).json({ error: "Google API key not configured" });
    }

    try {
      const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

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

      if (useStreaming) {
        // Set up headers for SSE
        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Connection", "keep-alive");

        try {
          // Generate streaming content
          const streamingResponse = await model.generateContentStream(fullPrompt);

          // Send chunks as they arrive
          for await (const chunk of streamingResponse.stream) {
            // Important: call text() function to get the actual text
            const textChunk = chunk.text();
            if (textChunk) {
              res.write(`data: ${JSON.stringify({ chunk: textChunk })}\n\n`);
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
        const result = await model.generateContent(fullPrompt);
        const response = result.response;
        const text = response.text();
        return res.json({ text });
      }
    } catch (error) {
      return res.status(500).json({
        error: "Failed to generate text with Gemini",
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

// Gemini Vision ile görüntü analizi
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
      const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

      let base64Data;
      let mimeType = "image/jpeg";

      try {
        if (imageData.includes("base64,")) {
          const matches = imageData.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
          if (matches && matches.length === 3) {
            mimeType = matches[1];
            base64Data = matches[2];
          } else {
            base64Data = imageData.split("base64,")[1];
          }
        } else {
          base64Data = imageData;
        }

        if (!base64Data) {
          throw new Error("Could not extract base64 data from image");
        }
      } catch (parseError) {
        return res.status(400).json({ error: "Invalid image data format" });
      }

      const result = await model.generateContent({
        contents: [
          {
            role: "user",
            parts: [
              { text: prompt },
              {
                inlineData: {
                  data: base64Data,
                  mimeType: mimeType,
                },
              },
            ],
          },
        ],
      });

      const response = result.response;
      const text = response.text();

      return res.json({ text });
    } catch (error) {
      return res.status(500).json({
        error: "Failed to analyze image with Gemini",
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

export default router;
