import dotenv from "dotenv";
dotenv.config();

import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import cookieParser from "cookie-parser";
import os from "os";
import path from "path";
import { configureSecurityMiddleware } from "./middlewares/security";
import { validateInput } from "./middlewares/validation";
import authRoutes from "./routes/authRoutes";
import circuitRoutes from "./routes/circuitRoutes";
import aiRoutes from "./routes/aiRoutes";
import { Logger } from "./utils/logger";

const app = express();
app.set("trust proxy", 1);
const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI || "";

// For local development, you can use the following connection string
//mongodb://localhost:27017/logicdrawer

app.use(
  cors({
    origin: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);

app.use("/api/analyze", express.json({ limit: "25mb" }));
app.use("/api/generate", express.json({ limit: "25mb" }));
app.use("/api/agent", express.json({ limit: "25mb" }));

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ limit: "1mb", extended: true }));
app.use(cookieParser());

mongoose
  .connect(MONGODB_URI, {
    maxPoolSize: 5, // Reduced from default 100
    minPoolSize: 1, // Don't keep idle connections
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
  })
  .then(() => {
    Logger.log("Connected to MongoDB");
  })
  .catch(err => {
    Logger.error("MongoDB connection error:", err);
  });

configureSecurityMiddleware(app);

app.use(validateInput);

app.use("/api/auth", authRoutes);
app.use("/api/circuits", circuitRoutes);
app.use("/api", aiRoutes);

app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    ip: req.ip,
  });
});

const distPath = path.join(__dirname, "../../dist");
const rootPath = path.join(__dirname, "../../");
app.use(express.static(distPath));

app.get("/robots.txt", (req, res) => {
  res.sendFile(path.join(rootPath, "robots.txt"));
});

app.get("/sitemap.xml", (req, res) => {
  res.type("application/xml");
  res.sendFile(path.join(rootPath, "sitemap.xml"));
});

app.get("*", (req, res) => {
  if (req.path.includes(".") || req.path.startsWith("/api/")) {
    res.status(404).send("Not Found");
    return;
  }
  res.sendFile(path.join(distPath, "logic.html"));
});

app.listen(PORT, () => {
  const interfaces = os.networkInterfaces();
  const ipAddress =
    Object.values(interfaces)
      .flat()
      .filter(details => details && details.family === "IPv4" && !details.internal)[0]?.address ||
    "localhost";

  const serverUrl = `http://${ipAddress}:${PORT}`;
  Logger.log(`Server running at ${serverUrl}`);
  Logger.log(`Local Access: http://localhost:${PORT}`);
});
