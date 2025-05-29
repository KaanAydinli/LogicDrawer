import express from "express";
import { spawn } from 'child_process';
import path from 'path';
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

// Roboflow analizi
router.post("/analyze/roboflow", async (req, res) => {
  try {
    const { base64Image } = req.body;
    if (!base64Image) {
      return res.status(400).json({ error: "No image provided" });
    }

    const base64Data = base64Image.includes(",") ? base64Image.split(",")[1] : base64Image;

    const pythonScriptPath = path.join(__dirname, '..', 'detectCircuit.py');
    const pythonExecutable = 'python';

    const pythonProcess = spawn(pythonExecutable, [pythonScriptPath]);

    let scriptOutput = '';
    let scriptError = '';

    pythonProcess.stdin.write(base64Data);
    pythonProcess.stdin.end();

    pythonProcess.stdout.on('data', (data) => {
      scriptOutput += data.toString();
    });

    pythonProcess.stderr.on('data', (data) => {
      scriptError += data.toString();
    });

    return new Promise((resolve, reject) => {
      pythonProcess.on('close', (code) => {
        if (code === 0) {
          try {
            const trimmedOutput = scriptOutput.trim();
            if (!trimmedOutput) {
                throw new Error("Python script produced empty output.");
            }
            const resultJson = JSON.parse(trimmedOutput);
            res.json(resultJson);
            resolve(undefined);
          } catch (parseError) {
            res.status(500).json({
              error: "Failed to parse analysis result from Python script",
              details: scriptError || "Parsing error",
              rawOutput: scriptOutput
            });
            reject(parseError);
          }
        } else {
          res.status(500).json({
            error: "Circuit analysis script failed",
            details: scriptError || `Script exited with code ${code}`,
            rawOutput: scriptOutput
          });
          reject(new Error(`Python script failed: ${scriptError}`));
        }
      });

      pythonProcess.on('error', (err) => {
        res.status(500).json({ error: "Failed to start analysis script", details: err.message });
        reject(err);
      });
    });
  } catch (error) {
    res.status(500).json({
      error: "Failed to analyze image using local script",
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

// Mesaj sınıflandırma
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
- GENERAL_INFORMATION: For questions about circuitry, programming, or other informational requests

Reply with ONLY the category name, nothing else.`;
      
      const messages = [
        { role: "system", content: systemPrompt },
        { role: "user", content: message + (hasImage ? " (Note: The user has uploaded an image)" : "") }
      ];
      
      const response = await fetch("https://api.mistral.ai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${process.env.MISTRAL_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "mistral-large-latest",
          messages: messages
        })
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
      
      let classification = "GENERAL_INFORMATION";
      if (text.includes("VERILOG")) classification = "VERILOG_IMPORT";
      else if (text.includes("CIRCUIT") && (text.includes("DETECT") || text.includes("DRAW"))) classification = "CIRCUIT_DETECTION";
      else if (text.includes("IMAGE")) classification = "IMAGE_ANALYSIS";
      
      return res.json({ classification });
    } catch (error) {
      return res.status(500).json({
        error: "Failed to classify message",
        details: error instanceof Error ? error.message : String(error)
      });
    }
  } catch (error) {
    return res.status(500).json({
      error: "Internal server error",
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

// Mistral ile metin üretme
router.post("/generate/mistral", async (req, res) => {
  try {
    const {userPrompt, systemPrompt } = req.body;

    if (!process.env.MISTRAL_API_KEY) {
      return res.status(500).json({ error: "Mistral API key not configured" });
    }

    try {
      let messages = [];
      
      if (systemPrompt) {
        messages.push({
          role: "system",
          content: systemPrompt
        });
      }
      
      const role = "user" ;
      messages.push({
        role: role,
        content: userPrompt
      });

      const response = await fetch("https://api.mistral.ai/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.MISTRAL_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "mistral-large-latest",
          messages: messages
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
    const { prompt, systemPrompt } = req.body;
    
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
        fullPrompt = `${systemPrompt}\n\n${prompt}`;
      }
      
      const result = await model.generateContent(fullPrompt);
      const response = result.response;
      const text = response.text();
      
      return res.json({ text });
    } catch (error) {
      return res.status(500).json({
        error: "Failed to generate text with Gemini",
        details: error instanceof Error ? error.message : String(error)
      });
    }
  } catch (error) {
    return res.status(500).json({
      error: "Internal server error",
      details: error instanceof Error ? error.message : String(error)
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
        contents: [{ 
          role: "user",
          parts: [
            { text: prompt },
            {
              inlineData: {
                data: base64Data,
                mimeType: mimeType
              }
            }
          ] 
        }]
      });
      
      const response = result.response;
      const text = response.text();
      
      return res.json({ text });
    } catch (error) {
      return res.status(500).json({
        error: "Failed to analyze image with Gemini",
        details: error instanceof Error ? error.message : String(error)
      });
    }
  } catch (error) {
    return res.status(500).json({
      error: "Internal server error",
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

export default router;