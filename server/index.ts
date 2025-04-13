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
import { User } from "./models/User";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import { authMiddleware, AuthRequest } from "./middlewares/auth";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/logicdrawer";

app.use(express.json({ limit: "25mb" }));
app.use(express.urlencoded({ limit: "25mb", extended: true }));

app.use(
  cors({
    origin: '*',  // Tüm kaynaklardan erişime izin ver
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
  })
);

mongoose
  .connect(MONGODB_URI)
  .then(() => {
    console.log("Connected to MongoDB successfully");
    console.log("MongoDB URI:", MONGODB_URI);
  })
  .catch(err => {
    console.error("MongoDB connection error:", err);
    console.error("Connection URI:", MONGODB_URI);
  });

app.get("/api/circuits", authMiddleware, async (req: AuthRequest, res) => {
  try {
    // Fetch circuits and populate with user data
    const circuits = await Circuit.find({ userId: req.user?.id })
      .populate("userId", "name email") // Populate with just name and email
      .sort({ createdAt: -1 });

    res.json(circuits);
  } catch (error) {
    console.error("Error fetching circuits:", error);
    res.status(500).json({ error: "Failed to fetch circuits" });
  }
});

const JWT_SECRET = process.env.JWT_SECRET || "s";

// API endpoint'lerinin üstüne bu endpoint'leri ekleyin

// Kullanıcı kaydı
app.post("/api/auth/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // E-posta adresi kontrol et
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: "Email already in use" });
    }

    // Yeni kullanıcı oluştur
    const user = new User({
      name,
      email,
      password,
    });

    await user.save();

    // Kullanıcı oluşturuldu, şifre verilmeden kullanıcıyı döndür
    res.status(201).json({
      message: "User registered successfully",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
      },
    });
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({ error: "Server error during registration" });
  }
});

// Kullanıcı girişi
app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    // Kullanıcıyı bul
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    // Şifreyi kontrol et
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    // JWT oluştur
    const token = jwt.sign({ id: user._id, email: user.email }, JWT_SECRET, { expiresIn: "24h" });

    // Kullanıcı girişi başarılı
    res.json({
      message: "Login successful",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Server error during login" });
  }
});

// Kullanıcı bilgilerini getir
app.get("/api/auth/me", async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];

    if (!token) {
      return res.status(401).json({ error: "No token provided" });
    }

    const decoded = jwt.verify(token, JWT_SECRET) as { id: string };
    const user = await User.findById(decoded.id).select("-password");

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({ user });
  } catch (error) {
    console.error("Auth error:", error);
    res.status(401).json({ error: "Invalid token" });
  }
});

app.get("/api/circuits/:id", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const circuit = await Circuit.findOne({
      _id: req.params.id,
      userId: req.user?.id,
    });

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
        details: "API key or workflow ID not set",
      });
    }

    console.log(`Calling Roboflow Workflow API (workflow: ${process.env.ROBOFLOW_WORKFLOW_ID})...`);

    try {
      const apiResponse = await axios({
        method: "post",
        url: `https://detect.roboflow.com/infer/workflows/${process.env.ROBOFLOW_WORKFLOW_ID}`,
        headers: {
          "Content-Type": "application/json",
        },
        data: JSON.stringify({
          api_key: process.env.ROBOFLOW_API_KEY,
          inputs: {
            image: {
              type: "base64",
              value: base64Data,
            },
          },
        }),
      });

      console.log("Roboflow response received successfully");
      res.json(apiResponse.data);
    } catch (apiError) {
      if (axios.isAxiosError(apiError) && apiError.response) {
        console.error("Roboflow API error:", {
          status: apiError.response.status,
          data: apiError.response.data,
        });

        return res.status(apiError.response.status).json({
          error: "Roboflow API error",
          details: apiError.response.data,
        });
      } else {
        console.error("Error calling Roboflow API:", apiError);
        return res.status(500).json({
          error: "Failed to process with Roboflow",
          details: apiError instanceof Error ? apiError.message : String(apiError),
        });
      }
    }
  } catch (error) {
    console.error("Error in /api/analyze/roboflow endpoint:", error);
    res.status(500).json({
      error: "Failed to analyze image with Roboflow",
      details: error instanceof Error ? error.message : String(error),
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
  }
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

app.get("/api/circuits/:id/download", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const circuitId = req.params.id;
    const circuit = await Circuit.findOne({
      _id: circuitId,
      userId: req.user?.id,
    });

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

app.post("/api/circuits", authMiddleware, async (req: AuthRequest, res) => {
  try {
    // Check if user ID exists
    if (!req.user?.id) {
      return res.status(401).json({ error: "User ID not found in token" });
    }

    // Add the current user's ID to the circuit data
    const circuitData = {
      ...req.body,
      userId: req.user.id,
    };

    console.log("Saving circuit with data:", JSON.stringify(circuitData, null, 2));

    const circuit = new Circuit(circuitData);

    try {
      await circuit.save();
      res.status(201).json(circuit);
    } catch (validationError: any) {
      console.error("Circuit validation error:", validationError);
      return res.status(400).json({
        error: "Invalid circuit data",
        details: validationError.message,
      });
    }
  } catch (error: any) {
    console.error("Error saving circuit:", error);
    res.status(500).json({
      error: "Failed to save circuit",
      details: error.message,
    });
  }
});

// Add this endpoint to check token validity
app.get("/api/auth/check", authMiddleware, (req: AuthRequest, res) => {
  // If we get here, the token is valid (middleware passed)
  res.json({
    authenticated: true,
    user: {
      id: req.user?.id,
      email: req.user?.email,
    },
  });
});

app.put("/api/circuits/:id", authMiddleware, async (req: AuthRequest, res) => {
  try {
    // Only allow updating if the circuit belongs to the user
    const circuit = await Circuit.findOneAndUpdate(
      { _id: req.params.id, userId: req.user?.id },
      req.body,
      { new: true }
    );

    if (!circuit) {
      return res.status(404).json({ error: "Circuit not found or you don't have permission" });
    }
    res.json(circuit);
  } catch (error) {
    res.status(400).json({ error: "Failed to update circuit" });
  }
});

app.delete("/api/circuits/:id", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const circuit = await Circuit.findOneAndDelete({
      _id: req.params.id,
      userId: req.user?.id,
    });

    if (!circuit) {
      return res.status(404).json({ error: "Circuit not found or you don't have permission" });
    }
    res.json({ message: "Circuit deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete circuit" });
  }
});
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    ip: req.ip
  });
});

// Add this before the final app.listen() call
app.post("/api/auth/refresh", async (req, res) => {
  try {
    const { userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({ error: "User ID is required" });
    }
    
    // Find the user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    
    // Generate new token
    const token = jwt.sign(
      { id: user._id, email: user.email }, 
      JWT_SECRET, 
      { expiresIn: "24h" }
    );
    
    res.json({ token });
  } catch (error) {
    console.error("Token refresh error:", error);
    res.status(500).json({ error: "Error refreshing token" });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
