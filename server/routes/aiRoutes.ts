/**
 * @file Defines the routes for AI-related functionalities.
 */

import express from "express";
import { spawn } from "child_process";
import path from "path";
import fs from "fs";
import { GoogleGenerativeAI } from "@google/generative-ai";
import multer from "multer";
import { optionalAuth, AuthRequest } from "../middlewares/auth";
import { aiRateLimit, getRateLimitStatus } from "../middlewares/aiRateLimit";

import { Logger } from "../utils/logger";

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

/**
 * Multer settings for file uploads.
 */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

router.post("/analyze/yolo", optionalAuth, aiRateLimit, async (req, res) => {
  try {
    const { base64Image } = req.body;
    if (!base64Image) {
      return res.status(400).json({ error: "No image provided" });
    }

    const base64Data = base64Image.includes(",") ? base64Image.split(",")[1] : base64Image;
    const serverRoot = path.resolve(__dirname, "..");
    const pythonScriptPath = path.join(serverRoot, "detectCircuit.py");

    const venvPythonPath = path.join(serverRoot, "venv", "bin", "python3");
    const venvPythonPathAlt = path.join(serverRoot, "..", "venv", "bin", "python3");
    const venvPythonPathWin = path.join(serverRoot, "venv", "Scripts", "python.exe");
    const venvPythonPathWinAlt = path.join(serverRoot, "..", "venv", "Scripts", "python.exe");

    let pythonExecutable: string;
    if (process.env.PYTHON_EXECUTABLE) {
      pythonExecutable = process.env.PYTHON_EXECUTABLE;
    } else if (process.platform === "win32") {
      pythonExecutable = fs.existsSync(venvPythonPathWin)
        ? venvPythonPathWin
        : fs.existsSync(venvPythonPathWinAlt)
          ? venvPythonPathWinAlt
          : "python";
    } else {
      pythonExecutable = fs.existsSync(venvPythonPath)
        ? venvPythonPath
        : fs.existsSync(venvPythonPathAlt)
          ? venvPythonPathAlt
          : "python3";
    }
    if (!fs.existsSync(pythonScriptPath)) {
      return res.status(500).json({
        error: "Python script not found",
        path: pythonScriptPath,
      });
    }

    try {
      const result = await new Promise((resolve, reject) => {
        const pythonProcess = spawn(pythonExecutable, [pythonScriptPath], {
          stdio: ["pipe", "pipe", "pipe"],
          env: {
            ...process.env,
            PYTHONUNBUFFERED: "1",
            PYTHONIOENCODING: "utf-8",
          },
        });

        let scriptOutput = "";
        let scriptError = "";
        let isResolved = false;

        pythonProcess.stdout.on("data", data => {
          scriptOutput += data.toString();
        });

        pythonProcess.stderr.on("data", data => {
          scriptError += data.toString();
        });

        let timeout: NodeJS.Timeout;
        const safeResolve = (value: any) => {
          if (timeout) clearTimeout(timeout);
          if (!isResolved) {
            isResolved = true;
            resolve(value);
          }
        };

        const safeReject = (reason: any) => {
          if (timeout) clearTimeout(timeout);
          if (!isResolved) {
            isResolved = true;
            reject(reason);
          }
        };

        timeout = setTimeout(() => {
          if (!isResolved) {
            isResolved = true;
            pythonProcess.kill();
            safeReject(
              new Error(
                `Python script timed out after 60 seconds. Output so far: ${scriptOutput.substring(0, 500)}. Errors: ${scriptError.substring(0, 500)}`
              )
            );
          }
        }, 60000);

        pythonProcess.on("error", err => {
          safeReject(new Error(`Failed to start Python script: ${err.message}`));
        });

        pythonProcess.on("close", code => {
          if (isResolved) return;

          if (code === 0) {
            try {
              const jsonStart = scriptOutput.indexOf("{");
              const jsonEnd = scriptOutput.lastIndexOf("}") + 1;

              if (jsonStart >= 0 && jsonEnd > jsonStart) {
                const jsonString = scriptOutput.substring(jsonStart, jsonEnd);

                const result = JSON.parse(jsonString);
                safeResolve(result);
              } else {
                safeReject(
                  new Error(
                    `No valid JSON found in Python output. Output: ${scriptOutput.substring(0, 500)}. Errors: ${scriptError.substring(0, 500)}`
                  )
                );
              }
            } catch (e) {
              safeReject(
                new Error(
                  `Failed to parse Python output: ${(e as Error).message}. Output: ${scriptOutput.substring(0, 500)}. Errors: ${scriptError.substring(0, 500)}`
                )
              );
            }
          } else {
            safeReject(
              new Error(
                `Python script failed with exit code ${code}. Error output: ${scriptError || "No error output captured"}`
              )
            );
          }
        });

        pythonProcess.stdin.on("error", (err: NodeJS.ErrnoException) => {
          if (err.code === "EPIPE") {
            safeReject(
              new Error(
                `Python process closed unexpectedly before data could be written. This usually means the script crashed immediately. Error output: ${scriptError || "No error output captured"}`
              )
            );
          } else if (err.code !== "EOF") {
            safeReject(new Error(`Failed to write to Python script: ${err.message}`));
          }
        });

        setImmediate(() => {
          if (isResolved) return;

          try {
            if (!pythonProcess.stdin.writable) {
              safeReject(
                new Error(
                  `Cannot write to Python stdin - process may have already closed. Error output: ${scriptError || "No error output captured"}`
                )
              );
              return;
            }

            const chunkSize = 65536;
            if (base64Data.length > chunkSize) {
              let offset = 0;
              const writeChunk = () => {
                if (isResolved || !pythonProcess.stdin.writable) return;

                const chunk = base64Data.slice(offset, offset + chunkSize);
                if (chunk.length > 0) {
                  const canContinue = pythonProcess.stdin.write(chunk, "utf8");
                  offset += chunkSize;
                  if (offset < base64Data.length) {
                    if (canContinue) {
                      setImmediate(writeChunk);
                    } else {
                      pythonProcess.stdin.once("drain", writeChunk);
                    }
                  } else {
                    pythonProcess.stdin.end();
                  }
                } else {
                  pythonProcess.stdin.end();
                }
              };
              writeChunk();
            } else {
              pythonProcess.stdin.write(base64Data, "utf8", err => {
                if (err) {
                  safeReject(
                    new Error(
                      `Failed to write data to Python script: ${err.message}. Error output: ${scriptError || "No error output captured"}`
                    )
                  );
                } else {
                  pythonProcess.stdin.end();
                }
              });
            }
          } catch (writeError) {
            safeReject(
              new Error(
                `Failed to send data to Python script: ${(writeError as Error).message}. Error output: ${scriptError || "No error output captured"}`
              )
            );
          }
        });
      });

      res.json(result);
    } catch (pythonError) {
      if (!res.headersSent) {
        Logger.error("Python processing error:", pythonError);
        res.status(500).json({
          error: "Python processing error",
          details: (pythonError as Error).message,
        });
      }
    }
  } catch (error) {
    if (!res.headersSent) {
      Logger.error("Internal server error:", error);
      res.status(500).json({
        error: "Internal server error",
        details: (error as Error).message,
      });
    }
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
      // Use a model that supports function calling and vision
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

      // Prepare contents
      let userParts: any[] = [];

      if (image) {
        // Handle base64 image
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

      // Convert history to Gemini format
      let chatHistory: any[] = [];
      if (history && Array.isArray(history)) {
        chatHistory = history.map((msg: any) => {
          // If message already has parts (structured history from client agent loop), use them
          if (msg.parts) {
            let role = msg.role === "user" ? "user" : "model";
            // Check if parts contain functionResponse, if so enforce 'function' role
            if (msg.parts.some((p: any) => p.functionResponse)) {
              role = "function";
            }
            return {
              role: role,
              parts: msg.parts,
            };
          }
          // Legacy/Simple text message
          return {
            role: msg.role === "user" ? "user" : "model",
            parts: [{ text: msg.content || "" }],
          };
        });

        // Validate: First message must be from user or function (rare)
        if (chatHistory.length > 0 && chatHistory[0].role === "model") {
          // If first message is model, remove it
          chatHistory.shift();
        }

        // Validate: Merge consecutive messages from same role
        const sanitizedHistory = [];
        if (chatHistory.length > 0) {
          let currentMsg = chatHistory[0];

          for (let i = 1; i < chatHistory.length; i++) {
            const nextMsg = chatHistory[i];
            if (nextMsg.role === currentMsg.role) {
              // Merge content
              // Check if both are simple text
              const isTextOnly = (parts: any[]) =>
                Array.isArray(parts) && parts.length === 1 && parts[0].text;

              if (isTextOnly(currentMsg.parts) && isTextOnly(nextMsg.parts)) {
                currentMsg.parts[0].text += "\n\n" + nextMsg.parts[0].text;
              } else {
                // Append parts safely
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

      // Determine the role for the new message
      let currentRole = "user";
      if (userParts.some(p => p.functionResponse)) {
        currentRole = "function";
      }

      // Construct full content with history + new message
      const contents = [...chatHistory, { role: currentRole, parts: userParts }];

      const result = await model.generateContent({
        contents: contents,
      });
      const response = result.response;

      // Check for function calls
      const call = response.functionCalls();

      if (call && call.length > 0) {
        const functionCalls = call.map(c => ({
          name: c.name,
          args: c.args,
        }));
        return res.json({ functionCalls });
      }

      // Default text response
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
