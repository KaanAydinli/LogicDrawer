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
        console.error("Python processing error:", pythonError);
        res.status(500).json({
          error: "Python processing error",
          details: (pythonError as Error).message,
        });
      }
    }
  } catch (error) {
    if (!res.headersSent) {
      console.error("Internal server error:", error);
      res.status(500).json({
        error: "Internal server error",
        details: (error as Error).message,
      });
    }
  }
});

router.post("/classify-message", optionalAuth, aiRateLimit, async (req, res) => {
  try {
    const { message, hasImage } = req.body;

    if (!message) {
      return res.status(400).json({ error: "No message provided" });
    }

    if (!process.env.MISTRAL_API_KEY) {
      return res.status(500).json({ error: "Mistral API is not configured" });
    }

    try {
      const systemPrompt = `You are a classification assistant for a logic circuit design application.
      Analyze the user's message and return ONLY ONE of these categories:
      - VERILOG_IMPORT: If the message contains Verilog code or asks to create a circuit that can be created via code.
      - CIRCUIT_DETECTION: If the message asks to detect, draw, or analyze a circuit from an image
      - IMAGE_ANALYSIS: If the message asks to analyze or describe an image without creating a circuit
      - TRUTH_TABLE_IMAGE: If the message asks to analyze or draw the truth table from an image
      - KMAP_IMAGE: If the message asks to analyze or draw the Karnaugh map from an image
      - GENERAL_INFORMATION: For questions about circuitry, programming, or other informational requests

      Reply with ONLY the category name, nothing else.`;

      //Temporarily remove CIRCUIT_FIX as it is too slow to process
      //- CIRCUIT_FIX: If the message asks to edit, fix or improve the current circuit.

      const messages = [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: message + (hasImage ? " (Note: The user has uploaded an image)" : ""),
        },
      ];

      const response = await fetch("https://api.mistral.ai/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.MISTRAL_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "mistral-large-latest",
          messages: messages,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(`Mistral API error: ${error.error?.message || response.statusText}`);
      }

      const data = await response.json();

      if (!data.choices || !data.choices.length) {
        throw new Error("Empty response from Mistral API");
      }

      const text = data.choices[0].message.content.trim().toUpperCase();

      let classification = text;

      console.log("Classification result:", classification, " User Message:", message);

      return res.json({ classification });
    } catch (error) {
      return res.status(500).json({
        error: "Failed to classify message",
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
 * Generate text with Mistral.
 */
router.post("/generate/mistral", optionalAuth, aiRateLimit, async (req, res) => {
  try {
    const { userPrompt, systemPrompt } = req.body;

    if (!process.env.MISTRAL_API_KEY) {
      return res.status(500).json({ error: "Mistral API key not configured" });
    }

    try {
      let messages = [];

      if (systemPrompt) {
        messages.push({
          role: "system",
          content: systemPrompt,
        });
      }

      const role = "user";
      messages.push({
        role: role,
        content: userPrompt,
      });

      const response = await fetch("https://api.mistral.ai/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.MISTRAL_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "mistral-large-latest",
          messages: messages,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(`Mistral API error: ${error.error?.message || response.statusText}`);
      }

      const data = await response.json();

      if (!data.choices || !data.choices.length) {
        throw new Error("Empty response from Mistral API");
      }

      const text = data.choices[0].message.content;

      res.json({ text });
    } catch (error) {
      res.status(500).json({
        error: "Failed to generate text with Mistral",
        details: error instanceof Error ? error.message : String(error),
      });
    }
  } catch (error) {
    res.status(500).json({
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
