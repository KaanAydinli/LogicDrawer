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
import { spawn } from 'child_process'; // Import spawn
import path from 'path';  

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
// Modify the existing endpoint
// Update the GET /api/circuits endpoint
app.get("/api/circuits", authMiddleware, async (req: AuthRequest, res) => {
  try {
    // Fetch user's own circuits
    const ownCircuits = await Circuit.find({ userId: req.user?.id })
      .populate("userId", "name email")
      .sort({ createdAt: -1 });
      
    // Fetch circuits shared with the user
    const sharedCircuits = await Circuit.find({ 
      sharedWith: req.user?.id 
    })
    .populate("userId", "name email")
    .sort({ createdAt: -1 });
    
    // Fetch public circuits (that aren't owned by the user)
    const publicCircuits = await Circuit.find({
      userId: { $ne: req.user?.id },
      isPublic: true
    })
    .populate("userId", "name email")
    .sort({ createdAt: -1 });
    
    // Mark shared and public circuits
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
    
    // Combine all sets
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
    
    // Create a regex pattern that matches beginning of words (prefix match)
    // This will match strings that start with the query (case insensitive)
    const searchPattern = new RegExp(`^${query}`, 'i');
    
    // Find circuits that match the search criteria
    const matchingCircuits = await Circuit.find({
      $or: [
        { name: searchPattern },
        { description: searchPattern }
        // Removed tag matching as it's not prefix-friendly
      ],
      $and: [
        {
          $or: [
            // User's own circuits
            { userId: req.user?.id },
            // Circuits shared with the user
            { sharedWith: req.user?.id },
            // Public circuits
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

app.get("/api/circuits/shared-with-me", authMiddleware, async (req: AuthRequest, res) => {
  
  console.log("Fetching circuits shared with user:");
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    // Kullanıcı bilgilerini bul
    const user = await User.findById(req.user.id);
    if (!user) {
      console.error("User not found for shared circuits lookup:", req.user.id);
      return res.status(404).json({ error: "User not found" });
    }
    
    console.log("Looking for circuits shared with:", user.name);

    try {
      // Kullanıcı ile paylaşılan devreleri bul
      const circuits = await Circuit.find({ sharedWith: user.name })
        .populate("userId", "name email")
        .sort({ dateCreated: -1 });

      console.log(`Found ${circuits.length} circuits shared with ${user.name}`);
      res.json(circuits);
    } catch (queryError) {
      console.error("Database error in shared-with-me:", queryError);
      return res.status(500).json({ error: "Database query error" });
    }
  } catch (error) {
    console.error("Error fetching shared circuits:", error);
    res.status(500).json({ error: "Failed to fetch shared circuits" });
  }
});

// Devre görünürlüğünü değiştirme endpoint'i
app.put("/api/circuits/:id/visibility", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { isPublic } = req.body;

    if (isPublic === undefined) {
      return res.status(400).json({ error: "isPublic field is required" });
    }

    // Devreyi güncelle, sadece sahibi değiştirebilir
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
    console.error("Error updating circuit visibility:", error);
    res.status(500).json({ error: "Failed to update circuit visibility" });
  }
});

app.get("/api/circuits/public", async (req, res) => {
  try {
    console.log("Fetching public circuits...");
    
    const circuits = await Circuit.find({ isPublic: true })
      .populate("userId", "name email")
      .sort({ dateCreated: -1 });

    console.log(`Found ${circuits.length} public circuits`);
    res.json(circuits);
  } catch (error) {
    console.error("Error fetching public circuits:", error);
    res.status(500).json({ error: "Failed to fetch public circuits" });
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
    console.log("Received image analysis request (using local Python script via stdin)");

    const { base64Image } = req.body;
    if (!base64Image) {
      return res.status(400).json({ error: "No image provided" });
    }

    // Extract base64 data (remove data URI prefix if present)
    // IMPORTANT: Ensure the prefix is removed, Python expects only the data part
    const base64Data = base64Image.includes(",") ? base64Image.split(",")[1] : base64Image;

    // --- 1. Spawn Python Script ---
    const pythonScriptPath = path.join(__dirname, 'detectCircuit.py'); // Ensure correct script name
    console.log(`Spawning Python script: ${pythonScriptPath}`);

    const pythonExecutable = 'python'; // Or 'python3'

    // Spawn the process WITHOUT the base64 data as an argument
    const pythonProcess = spawn(pythonExecutable, [pythonScriptPath]);

    let scriptOutput = '';
    let scriptError = '';

    // --- 2. Write base64 data to Python's stdin ---
    pythonProcess.stdin.write(base64Data);
    pythonProcess.stdin.end(); // Signal end of input
    console.log("Sent base64 data to Python script via stdin.");

    // --- 3. Capture stdout and stderr (same as before) ---
    pythonProcess.stdout.on('data', (data) => {
      scriptOutput += data.toString();
    });

    pythonProcess.stderr.on('data', (data) => {
      scriptError += data.toString();
      console.error(`Python stderr: ${data}`);
    });

    // --- 4. Handle Python Script Completion (same as before) ---
    return new Promise((resolve, reject) => {
      pythonProcess.on('close', (code) => {
        console.log(`Python script exited with code ${code}`);

        if (code === 0) {
          try {
            const trimmedOutput = scriptOutput.trim();
            if (!trimmedOutput) {
                throw new Error("Python script produced empty output.");
            }
            const resultJson = JSON.parse(trimmedOutput);
            console.log("Successfully parsed output from Python script.");
            res.json(resultJson);
            resolve(undefined);
          } catch (parseError) {
            console.error("Error parsing JSON output from Python:", parseError);
            console.error("Python stdout was:", scriptOutput);
            res.status(500).json({
              error: "Failed to parse analysis result from Python script",
              details: scriptError || "Parsing error",
              rawOutput: scriptOutput
            });
            reject(parseError);
          }
        } else {
          console.error(`Python script failed with code ${code}.`);
          res.status(500).json({
            error: "Circuit analysis script failed",
            details: scriptError || `Script exited with code ${code}`,
            rawOutput: scriptOutput
          });
          reject(new Error(`Python script failed: ${scriptError}`));
        }
      });

      pythonProcess.on('error', (err) => {
        console.error('Failed to start Python subprocess:', err);
        res.status(500).json({ error: "Failed to start analysis script", details: err.message });
        reject(err);
      });
    });

  } catch (error) {
    console.error("Error in /api/analyze/roboflow (stdin) endpoint:", error);
    res.status(500).json({
      error: "Failed to analyze image using local script",
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
// Add this endpoint
app.post("/api/circuits/:id/share", authMiddleware, async (req: AuthRequest, res) => {
  
  try {
    const { username } = req.body;

    if (!username) {
      return res.status(400).json({ error: "Username is required" });
    }

    // Kullanıcıyı bul
    const targetUser = await User.findOne({ name: username });
    if (!targetUser) {
      return res.status(404).json({ error: "User not found" });
    }

    // Devreyi bul
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

    // Zaten paylaşılmış mı kontrol et
    if (circuit.sharedWith.includes(username)) {
      return res.status(400).json({ error: "Circuit already shared with this user" });
    }

    // Kullanıcı ile paylaş
    circuit.sharedWith.push(username);
    await circuit.save();

    res.json({
      message: `Circuit shared with ${username}`,
      circuit
    });
  } catch (error) {
    console.error("Error sharing circuit:", error);
    res.status(500).json({ error: "Failed to share circuit" });
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
    const circuitId = req.params.id;
    const updateData = req.body;

    // Önce kullanıcıyı bul (username için gerekli)
    const user = await User.findById(req.user?.id);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Devre üzerinde izinleri kontrol et
    const circuit = await Circuit.findOne({
      _id: circuitId,
      $or: [
        { userId: req.user?.id },                   // Devre sahibi
        { sharedWith: user.name },                 // Devre paylaşılmış
        
      ]
    });

    if (!circuit) {
      // Eğer public bir devre ve fork edilmemiş ise, fork oluşturmayı öner
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

    // Güncelleme yapılacak alanlar
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
    console.error("Error updating circuit:", error);
    res.status(500).json({ error: "Failed to update circuit" });
  }
});
app.get("/api/circuits/:id", authMiddleware, async (req: AuthRequest, res) => {
  try {
    // Kullanıcı bilgilerini al
    const user = await User.findById(req.user?.id);
    if (!user) {
      return res.status(401).json({ error: "User not found" });
    }

    console.log(`User ${user.name} (${req.user?.id}) is trying to access circuit ${req.params.id}`);

    // Kontrol sırası: Kişisel devre, paylaşılan devre, public devre
    let circuit = await Circuit.findOne({
      _id: req.params.id,
      userId: req.user?.id
    });

    // Kendi devresi değilse, paylaşılan devre mi kontrol et
    if (!circuit) {
      console.log(`Circuit is not owned by user, checking if shared with ${user.name}`);
      circuit = await Circuit.findOne({
        _id: req.params.id,
        sharedWith: user.name  // Kullanıcı ID'si değil, kullanıcı adını kullan!
      });
    }

    // Paylaşılan devre de değilse, public mi kontrol et
    if (!circuit) {
      console.log("Circuit is not shared with user, checking if public");
      circuit = await Circuit.findOne({
        _id: req.params.id,
        isPublic: true
      });
    }

    if (!circuit) {
      console.log("Circuit not found or user doesn't have access");
      return res.status(404).json({ error: "Circuit not found or you don't have permission" });
    }
    
    console.log(`Circuit found, returning to user ${user.name}`);
    res.json(circuit);
  } catch (error) {
    console.error("Error fetching circuit:", error);
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
