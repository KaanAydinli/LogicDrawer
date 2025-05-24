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
import { spawn } from 'child_process';
import path from 'path';
import cookieParser from 'cookie-parser';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/logicdrawer";

app.use(express.json({ limit: "25mb" }));
app.use(express.urlencoded({ limit: "25mb", extended: true }));
app.use(cookieParser());

app.use(
  cors({
    origin: 'http://10.202.122.162:4000',
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
    const ownCircuits = await Circuit.find({ userId: req.user?.id })
      .populate("userId", "name email")
      .sort({ createdAt: -1 });
      
    const sharedCircuits = await Circuit.find({ 
      sharedWith: req.user?.id 
    })
    .populate("userId", "name email")
    .sort({ createdAt: -1 });
    
    const publicCircuits = await Circuit.find({
      userId: { $ne: req.user?.id },
      isPublic: true
    })
    .populate("userId", "name email")
    .sort({ createdAt: -1 });
    
    const sharedCircuitsWithFlag = sharedCircuits.map(circuit => {
      const circuitObj = circuit.toObject();
      circuitObj.isShared = true;
      return circuitObj;
    });
    
    const publicCircuitsWithFlag = publicCircuits.map(circuit => {
      const circuitObj = circuit.toObject();
      circuitObj.isPublic = true;
      return circuitObj;
    });
    
    const allCircuits = [...ownCircuits, ...sharedCircuitsWithFlag, ...publicCircuitsWithFlag];
    
    res.json(allCircuits);
  } catch (error) {
    console.error("Error fetching circuits:", error);
    res.status(500).json({ error: "Failed to fetch circuits" });
  }
});

app.get("/api/circuits/search", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const query = req.query.q as string;
    
    if (!query || typeof query !== 'string') {
      return res.status(400).json({ error: "Search query is required" });
    }
    
    const searchPattern = new RegExp(`^${query}`, 'i');
    
    const matchingCircuits = await Circuit.find({
      $or: [
        { name: searchPattern },
        { description: searchPattern }
      ],
      $and: [
        {
          $or: [
            { userId: req.user?.id },
            { sharedWith: req.user?.id },
            { isPublic: true }
          ]
        }
      ]
    })
    .populate("userId", "name email")
    .sort({ createdAt: -1 });
    
    res.json(matchingCircuits);
  } catch (error) {
    console.error("Error searching circuits:", error);
    res.status(500).json({ error: "Failed to search circuits" });
  }
});

const JWT_SECRET = process.env.JWT_SECRET || "a";

app.post("/api/auth/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: "Email already in use" });
    }

    const user = new User({
      name,
      email,
      password,
    });

    await user.save();

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

app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const token = jwt.sign({ id: user._id, email: user.email },JWT_SECRET, {
      expiresIn: "1h",
    });

    res.cookie('auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 1000
    });

    res.json({
      message: "Login successful",
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

app.post("/api/auth/logout", (req, res) => {
  res.clearCookie('auth_token', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
  });
  res.json({ message: "Logged out successfully" });
});

app.get("/api/auth/me", (req, res) => {
  try {
    const token = req.cookies.auth_token;

    if (!token) {
      return res.status(401).json({ error: "No authentication token found" });
    }

    const decoded = jwt.verify(token, JWT_SECRET) as { id: string };
    
    User.findById(decoded.id).select("-password")
      .then(user => {
        if (!user) {
          return res.status(404).json({ error: "User not found" });
        }
        
        res.json({ user });
      })
      .catch(err => {
        console.error("Database error:", err);
        res.status(500).json({ error: "Server error fetching user data" });
      });
  } catch (error) {
    console.error("Auth error:", error);
    res.status(401).json({ error: "Invalid token" });
  }
});

app.get("/api/circuits/shared-with-me", authMiddleware, async (req: AuthRequest, res) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    try {
      const circuits = await Circuit.find({ sharedWith: user.name })
        .populate("userId", "name email")
        .sort({ dateCreated: -1 });

      res.json(circuits);
    } catch (queryError) {
      return res.status(500).json({ error: "Database query error" });
    }
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch shared circuits" });
  }
});

app.put("/api/circuits/:id/visibility", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { isPublic } = req.body;

    if (isPublic === undefined) {
      return res.status(400).json({ error: "isPublic field is required" });
    }

    const circuit = await Circuit.findOneAndUpdate(
      { _id: req.params.id, userId: req.user?.id },
      { isPublic: Boolean(isPublic) },
      { new: true }
    );

    if (!circuit) {
      return res.status(404).json({ error: "Circuit not found or you don't have permission" });
    }

    res.json({
      isPublic: circuit.isPublic,
      message: `Circuit is now ${circuit.isPublic ? 'public' : 'private'}`
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to update circuit visibility" });
  }
});

app.get("/api/circuits/public", async (req, res) => {
  try {
    const circuits = await Circuit.find({ isPublic: true })
      .populate("userId", "name email")
      .sort({ dateCreated: -1 });

    res.json(circuits);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch public circuits" });
  }
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY || "");

app.post("/api/analyze/roboflow", async (req, res) => {
  try {
    const { base64Image } = req.body;
    if (!base64Image) {
      return res.status(400).json({ error: "No image provided" });
    }

    const base64Data = base64Image.includes(",") ? base64Image.split(",")[1] : base64Image;

    const pythonScriptPath = path.join(__dirname, 'detectCircuit.py');
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

interface MulterRequest extends Request {
  file?: Express.Multer.File;
}

app.post("/api/classify-message", async (req, res) => {
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

app.post("/api/generate/mistral", async (req, res) => {
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

app.post("/api/generate/gemini-text", async (req, res) => {
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

app.post("/api/generate/gemini-vision", async (req, res) => {
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

app.post("/api/circuits/:id/like", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const circuitId = req.params.id;
    const userId = req.user?.id;
    
    const circuit = await Circuit.findById(circuitId);
    
    if (!circuit) {
      return res.status(404).json({ error: "Circuit not found" });
    }

    if (!circuit.likedBy) {
      circuit.likedBy = [];
    }
    
    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    const userIdStr = userId.toString();
    if (circuit.likedBy.some(id => id.toString() === userIdStr)) {
      return res.status(400).json({ error: "You have already liked this circuit" });
    }
    
    circuit.likedBy.push(new mongoose.Types.ObjectId(userId));
    circuit.likes = circuit.likedBy.length;

    await circuit.save();
    
    res.json({ 
      message: "Circuit liked successfully", 
      likes: circuit.likes 
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to like circuit" });
  }
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
    res.status(500).json({ error: "Failed to download circuit" });
  }
});

app.post("/api/circuits/:id/share", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { username } = req.body;

    if (!username) {
      return res.status(400).json({ error: "Username is required" });
    }

    const targetUser = await User.findOne({ name: username });
    if (!targetUser) {
      return res.status(404).json({ error: "User not found" });
    }
    const circuit = await Circuit.findOne({
      _id: req.params.id,
      userId: req.user?.id
    });

    if (!circuit) {
      return res.status(404).json({ error: "Circuit not found or you don't have permission" });
    }

    if (!circuit.sharedWith) {
      circuit.sharedWith = [];
    }

    if (circuit.sharedWith.includes(username)) {
      return res.status(400).json({ error: "Circuit already shared with this user" });
    }

    circuit.sharedWith.push(username);
    await circuit.save();

    res.json({
      message: `Circuit shared with ${username}`,
      circuit
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to share circuit" });
  }
});

app.post("/api/circuits", authMiddleware, async (req: AuthRequest, res) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: "User ID not found in token" });
    }

    const circuitData = {
      ...req.body,
      userId: req.user.id,
    };

    const circuit = new Circuit(circuitData);

    try {
      await circuit.save();
      res.status(201).json(circuit);
    } catch (validationError: any) {
      return res.status(400).json({
        error: "Invalid circuit data",
        details: validationError.message,
      });
    }
  } catch (error: any) {
    res.status(500).json({
      error: "Failed to save circuit",
      details: error.message,
    });
  }
});

app.get("/api/auth/check", authMiddleware, (req: AuthRequest, res) => {
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
    const circuitId = req.params.id;
    const updateData = req.body;

    const user = await User.findById(req.user?.id);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const circuit = await Circuit.findOne({
      _id: circuitId,
      $or: [
        { userId: req.user?.id },
        { sharedWith: user.name },
      ]
    });

    if (!circuit) {
      const publicCircuit = await Circuit.findOne({
        _id: circuitId,
        isPublic: true
      });
      
      if (publicCircuit) {
        return res.status(403).json({ 
          error: "This is a public circuit. You need to fork it first.",
          circuitId: circuitId,
          isForkable: true
        });
      }
      
      return res.status(404).json({ error: "Circuit not found or you don't have permission" });
    }

    const updates = {
      name: updateData.name,
      components: updateData.components,
      wires: updateData.wires,
      dateModified: new Date()
    };

    const updatedCircuit = await Circuit.findByIdAndUpdate(
      circuitId,
      updates,
      { new: true }
    );

    res.json(updatedCircuit);
  } catch (error) {
    res.status(500).json({ error: "Failed to update circuit" });
  }
});

app.get("/api/circuits/:id", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const user = await User.findById(req.user?.id);
    if (!user) {
      return res.status(401).json({ error: "User not found" });
    }

    let circuit = await Circuit.findOne({
      _id: req.params.id,
      userId: req.user?.id
    });

    if (!circuit) {
      circuit = await Circuit.findOne({
        _id: req.params.id,
        sharedWith: user.name 
      });
    }

    if (!circuit) {
      circuit = await Circuit.findOne({
        _id: req.params.id,
        isPublic: true
      });
    }

    if (!circuit) {
      return res.status(404).json({ error: "Circuit not found or you don't have permission" });
    }
    
    res.json(circuit);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch circuit" });
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

app.post("/api/auth/refresh", async (req, res) => {
  try {
    const { userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({ error: "User ID is required" });
    }
    
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    
    const token = jwt.sign(
      { id: user._id, email: user.email }, 
      JWT_SECRET, 
      { expiresIn: "24h" }
    );
    
    res.json({ token });
  } catch (error) {
    res.status(500).json({ error: "Error refreshing token" });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
