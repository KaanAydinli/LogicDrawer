import express from "express";
import { Request, Response } from "express";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";
import { Circuit } from "./models/Circuit";
import { GoogleGenerativeAI } from "@google/generative-ai";
import axios from "axios";
import multer from "multer";
import { Buffer } from "buffer";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/logicdrawer";

app.use(express.json({ limit: "25mb" }));
app.use(express.urlencoded({ limit: "25mb", extended: true }));

app.use(cors());


mongoose
  .connect(MONGODB_URI)
  .then(() => {
    console.log("Connected to MongoDB successfully");
    console.log("MongoDB URI:", MONGODB_URI);
  })
  .catch((err) => {
    console.error("MongoDB connection error:", err);
    console.error("Connection URI:", MONGODB_URI);
  });


app.get("/api/circuits", async (req, res) => {
  try {
    const circuits = await Circuit.find();
    res.json(circuits);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch circuits" });
  }
});

app.get("/api/circuits/:id", async (req, res) => {
  try {
    const circuit = await Circuit.findById(req.params.id);
    if (!circuit) {
      return res.status(404).json({ error: "Circuit not found" });
    }
    res.json(circuit);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch circuit" });
  }
});
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY || "");


app.get("/api/analyze/roboflow", (req, res) => {
  res.json({
    message: "Roboflow API endpoint is ready!",
    timestamp: new Date().toISOString(),
    env: {
      GOOGLE_API_KEY: process.env.GOOGLE_API_KEY ? "Set" : "Not set",
      ROBOFLOW_API_KEY: process.env.ROBOFLOW_API_KEY ? "Set" : "Not set",
    },
  });
});

app.post("/api/analyze/roboflow", async (req, res) => {
  try {
    console.log("Received image analysis request");

    const { base64Image } = req.body;
    if (!base64Image) {
      return res.status(400).json({ error: "No image provided" });
    }

   
    const base64Data = base64Image.includes(",") ? base64Image.split(",")[1] : base64Image;

    
    if (!process.env.ROBOFLOW_API_KEY || !process.env.ROBOFLOW_WORKFLOW_ID) {
      console.error("Roboflow API key or workflow ID not configured in .env file");
      return res.status(500).json({ 
        error: "Roboflow configuration missing", 
        details: "API key or workflow ID not set" 
      });
    }

    console.log(`Calling Roboflow Workflow API (workflow: ${process.env.ROBOFLOW_WORKFLOW_ID})...`);
    
    try {
      
      const apiResponse = await axios({
        method: "post",
        url: `https://detect.roboflow.com/infer/workflows/${process.env.ROBOFLOW_WORKFLOW_ID}`,
        headers: {
          "Content-Type": "application/json"
        },
        data: JSON.stringify({
          api_key: process.env.ROBOFLOW_API_KEY,
          inputs: {
            "image": {
              "type": "base64",
              "value": base64Data
            }
          }
        })
      });

      console.log("Roboflow response received successfully");
      res.json(apiResponse.data);
    } catch (apiError) {
      if (axios.isAxiosError(apiError) && apiError.response) {
        console.error("Roboflow API error:", {
          status: apiError.response.status,
          data: apiError.response.data
        });
        
        return res.status(apiError.response.status).json({
          error: "Roboflow API error",
          details: apiError.response.data
        });
      } else {
        console.error("Error calling Roboflow API:", apiError);
        return res.status(500).json({ 
          error: "Failed to process with Roboflow",
          details: apiError instanceof Error ? apiError.message : String(apiError)
        });
      }
    }
  } catch (error) {
    console.error("Error in /api/analyze/roboflow endpoint:", error);
    res.status(500).json({
      error: "Failed to analyze image with Roboflow",
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

interface MulterRequest extends Request {
  file?: Express.Multer.File;
}

app.post(
  "/api/analyze/gemini",
  upload.single("image"),
  async (req: MulterRequest, res: Response) => {
    try {
      if (!req.file && !req.body.base64Image) {
        return res.status(400).json({ error: "No image provided" });
      }

      let imageData;
      let mimeType;

      if (req.file) {
        imageData = req.file.buffer.toString("base64");
        mimeType = req.file.mimetype;
      } else {
        const base64String = req.body.base64Image;
        const matches = base64String.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);

        if (!matches || matches.length !== 3) {
          return res.status(400).json({ error: "Invalid base64 image data" });
        }

        mimeType = matches[1];
        imageData = matches[2];
      }

      const userPrompt =
        req.body.prompt || "Analyze this circuit diagram and describe what you see.";

      const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-vision" });

      const result = await model.generateContent({
        contents: [
          {
            role: "user",
            parts: [
              { text: userPrompt },
              {
                inlineData: {
                  mimeType: mimeType,
                  data: imageData,
                },
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 1000,
        },
      });

      const response = await result.response;
      const text = response.text();

      res.json({ text });
    } catch (error) {
      console.error("Error calling Gemini Vision API:", error);
      res.status(500).json({
        error: "Failed to analyze image with Gemini",
        details: error,
      });
    }
  },
);

app.post("/api/generate/text", async (req, res) => {
  try {
    console.log("Text generation request received:", req.body);

    const { prompt, history, systemPrompt } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: "No prompt provided" });
    }

    // Check if the API key is configured
    if (!process.env.GOOGLE_API_KEY) {
      console.error("Google API key not found in environment variables");
      return res.status(500).json({ error: "Google API key not configured" });
    }

    try {
      const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

      let formattedPrompt = "";

      if (systemPrompt) {
        formattedPrompt += `${systemPrompt}\n\n`;
      }

      if (history && Array.isArray(history) && history.length > 0) {
        formattedPrompt += `Previous conversation context:\n${history.join("\n")}\n\n`;
      }

      formattedPrompt += `User: ${prompt}\n`;

      console.log("Sending request to Gemini API...");

      const result = await model.generateContent(formattedPrompt);
      const response = await result.response;
      const text = response.text();

      console.log("Response received from Gemini");

      res.json({ text });
    } catch (error) {
      console.error("Error calling Gemini API:", error);
      res.status(500).json({
        error: "Failed to generate text",
        details: error instanceof Error ? error.message : String(error),
      });
    }
  } catch (error) {
    console.error("Error processing request:", error);
    res.status(500).json({
      error: "Internal server error",
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

app.get("/api/generate/text", (req, res) => {
  res.json({
    message: "Text generation API is working!",
    timestamp: new Date().toISOString(),
    env: {
      GOOGLE_API_KEY: process.env.GOOGLE_API_KEY ? "Set" : "Not set",
      ROBOFLOW_API_KEY: process.env.ROBOFLOW_API_KEY ? "Set" : "Not set",
    },
  });
});

app.get("/api/circuits/:id/download", async (req, res) => {
  try {
    const circuitId = req.params.id;
    const circuit = await Circuit.findById(circuitId);

    if (!circuit) {
      return res.status(404).json({ error: "Circuit not found" });
    }

    res.setHeader("Content-Type", "application/json");
    res.setHeader("Content-Disposition", `attachment; filename=${circuit.name || "circuit"}.json`);

    res.json(circuit);
  } catch (error) {
    console.error("Error downloading circuit:", error);
    res.status(500).json({ error: "Failed to download circuit" });
  }
});

app.post("/api/circuits", async (req, res) => {
  try {
    console.log("Received circuit data:", req.body);
    const circuit = new Circuit(req.body);
    await circuit.save();
    res.status(201).json(circuit);
  } catch (error) {
    res.status(400).json({ error: "Failed to save circuit" });
  }
});

app.put("/api/circuits/:id", async (req, res) => {
  try {
    const circuit = await Circuit.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!circuit) {
      return res.status(404).json({ error: "Circuit not found" });
    }
    res.json(circuit);
  } catch (error) {
    res.status(400).json({ error: "Failed to update circuit" });
  }
});

app.delete("/api/circuits/:id", async (req, res) => {
  try {
    const circuit = await Circuit.findByIdAndDelete(req.params.id);
    if (!circuit) {
      return res.status(404).json({ error: "Circuit not found" });
    }
    res.json({ message: "Circuit deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete circuit" });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
