import express from "express";
import { spawn } from "child_process";
import path from "path";
import fs from "fs";
import { GoogleGenerativeAI } from "@google/generative-ai";
import multer from "multer";
import { authMiddleware } from "../middlewares/auth";

const router = express.Router();
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY || "");



// Upload için multer ayarları
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

router.post("/analyze/roboflow", async (req, res) => {
  try {
    const { base64Image } = req.body;
    if (!base64Image) {
      return res.status(400).json({ error: "No image provided" });
    }

    const base64Data = base64Image.includes(",") ? base64Image.split(",")[1] : base64Image;
    const pythonScriptPath = path.join(__dirname, "..", "detectCircuit.py");
    
    // Python executable'ı belirle
    const pythonExecutable = process.env.PYTHON_EXECUTABLE || 
                          (process.platform === "win32" ? "python" : "python3");

    // Python script'in varlığını kontrol et
    if (!fs.existsSync(pythonScriptPath)) {
      return res.status(500).json({ 
        error: "Python script not found", 
        path: pythonScriptPath 
      });
    }

    console.log(`Starting Python script: ${pythonExecutable} ${pythonScriptPath}`);

    // Promise-based execution to properly handle async flow
    try {
      const result = await new Promise((resolve, reject) => {
        const pythonProcess = spawn(pythonExecutable, [pythonScriptPath], {
          stdio: ['pipe', 'pipe', 'pipe'],
          env: {
            ...process.env,
            PYTHONUNBUFFERED: "1",
            PYTHONIOENCODING: "utf-8"
          }
        });

        let scriptOutput = "";
        let scriptError = "";

        // Stdout handling
        pythonProcess.stdout.on("data", (data) => {
          scriptOutput += data.toString();
        });

        // Stderr handling
        pythonProcess.stderr.on("data", (data) => {
          console.log("Python stderr:", data.toString());
          scriptError += data.toString();
        });

        // Error handling
        pythonProcess.on("error", (err) => {
          console.error(`Python process error: ${err.message}`);
          reject(new Error(`Failed to start Python script: ${err.message}`));
        });

        // Process close handling
        pythonProcess.on("close", (code) => {
          if (code === 0) {
            try {
              // Extract only the valid JSON
              const jsonStart = scriptOutput.indexOf('{');
              const jsonEnd = scriptOutput.lastIndexOf('}') + 1;
              
              if (jsonStart >= 0 && jsonEnd > jsonStart) {
                const jsonString = scriptOutput.substring(jsonStart, jsonEnd);
                console.log("Extracted JSON:", jsonString + "...");
                
                const result = JSON.parse(jsonString);
                resolve(result);
              } else {
                reject(new Error("No valid JSON found in Python output"));
              }
            } catch (e) {
              console.error("Error parsing Python output:", e);
              console.error("Raw output:", scriptOutput);
              reject(new Error(`Failed to parse Python output: ${(e as Error).message}`));
            }
          } else {
            reject(new Error(`Python script failed with code ${code}: ${scriptError}`));
          }
        });

        // Stdin handling
        pythonProcess.stdin.on('error', (err: NodeJS.ErrnoException) => {
          console.error(`Stdin error: ${err.message}`);
          // EOF errors are expected when stream closes
          if (err.code !== 'EOF') {
            reject(new Error(`Failed to write to Python script: ${err.message}`));
          }
        });

        // Send data to Python
        try {
          console.log(`Sending ${base64Data.length} bytes to Python script`);
          pythonProcess.stdin.write(base64Data, 'utf8');
          pythonProcess.stdin.end();
        } catch (writeError) {
          console.error(`Write error: ${(writeError as Error).message}`);
          reject(new Error(`Failed to send data to Python script: ${(writeError as Error).message}`));
        }
      });
      
      // Send the result
      res.json(result);
      
    } catch (pythonError) {
      // Only respond if headers haven't been sent yet
      if (!res.headersSent) {
        res.status(500).json({
          error: "Python processing error",
          details: (pythonError as Error).message
        });
      } else {
        console.error("Headers already sent, cannot send error response");
      }
    }

  } catch (error) {
    // Only respond if headers haven't been sent yet
    if (!res.headersSent) {
      res.status(500).json({
        error: "Internal server error",
        details: (error as Error).message
      });
    } else {
      console.error("Headers already sent, cannot send error response");
    }
  }
});


router.post("/classify-message", async (req, res) => {
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
- VERILOG_IMPORT: If the message contains Verilog code or asks to import/create a circuit from code
- CIRCUIT_DETECTION: If the message asks to detect, draw, or analyze a circuit from an image
- IMAGE_ANALYSIS: If the message asks to analyze or describe an image without creating a circuit
- TRUTH_TABLE_IMAGE: If the message asks to analyze or draw the truth table from an image
- KMAP_IMAGE: If the message asks to analyze or draw the Karnaugh map from an image
- GENERAL_INFORMATION: For questions about circuitry, programming, or other informational requests

Reply with ONLY the category name, nothing else.`;

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

// Mistral ile metin üretme
router.post("/generate/mistral", async (req, res) => {
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

// Gemini ile metin üretme
router.post("/generate/gemini-text", async (req, res) => {
  try {
    const { prompt, systemPrompt, history } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: "No prompt provided" });
    }

    const googleApiKey = process.env.GOOGLE_API_KEY || process.env.VITE_GOOGLE_API_KEY;
    if (!googleApiKey) {
      return res.status(500).json({ error: "Google API key not configured" });
    }

    try {
      const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

      let fullPrompt = prompt;
      if (systemPrompt) {
        // Eğer history bir array ise düzgün formatlama yap
        if (history && Array.isArray(history)) {
          const historyText = history
            .map(msg => `${msg.role === "user" ? "User" : "AI"}: ${msg.content}`)
            .join("\n");

          fullPrompt = `"The following is your System Prompt: "${systemPrompt}\n "Here is the conversation history with you and the user" \n${historyText}\n\This is the User Last Message: ${prompt}`;
        } else {
          fullPrompt = `${systemPrompt}\n\n${prompt}`;
        }
      }

      console.log("Gemini prompt:", prompt);
      const result = await model.generateContent(fullPrompt);
      const response = result.response;
      const text = response.text();

      return res.json({ text });
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
router.post("/generate/gemini-vision", async (req, res) => {
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
