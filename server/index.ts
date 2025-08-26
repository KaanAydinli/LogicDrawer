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

const app = express();
app.set("trust proxy", 1);
const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI || "";

//mongodb://localhost:27017/logicdrawer

app.use(
  cors({
    origin: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);

/**
 * Middlewares
 */
app.use(express.json({ limit: "25mb" }));
app.use(express.urlencoded({ limit: "25mb", extended: true }));
app.use(cookieParser());

/**
 * Middleware to detect suspicious User-Agents.
 */
app.use((req, res, next) => {
  const userAgent = req.headers["user-agent"] || "Unknown";

  // Simple check for suspicious User-Agents
  if (
    userAgent.includes("Hack") ||
    userAgent.includes("bot") ||
    userAgent.includes("curl") ||
    userAgent.length < 10
  ) {
  }

  next();
});
mongoose
  .connect(MONGODB_URI)
  .then(() => {
  })
  .catch(err => {
  });

/**
 * Security middlewares
 */
configureSecurityMiddleware(app);

/**
 * General input validation
 */
app.use(validateInput);

/**
 * Apply routers
 */
app.use("/api/auth", authRoutes);
app.use("/api/circuits", circuitRoutes);
app.use("/api", aiRoutes);

/**
 * Health check endpoint
 */
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    ip: req.ip,
  });
});

const distPath = path.join(__dirname, "../../dist");
app.use(express.static(distPath));

/**
 * Redirect all non-API requests to index.html
 */
app.get("*", (req, res) => {
  res.sendFile(path.join(distPath, "index.html"));
});

/**
 * Start the server
 */
app.listen(PORT, () => {
 
  const interfaces = os.networkInterfaces();
  const ipAddress = Object.values(interfaces)
    .flat()
    .filter(details => details && details.family === 'IPv4' && !details.internal)[0]?.address || 'localhost';
  
  const serverUrl = `http://${ipAddress}:${PORT}`;
});
