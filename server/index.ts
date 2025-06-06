import dotenv from "dotenv";
dotenv.config();

import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import cookieParser from "cookie-parser";
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

// Middleware'ler
app.use(express.json({ limit: "25mb" }));
app.use(express.urlencoded({ limit: "25mb", extended: true }));
app.use(cookieParser());

// CORS middleware

// Şüpheli User-Agent'lar için middleware - BURAYA TAŞIYIN
app.use((req, res, next) => {
  const userAgent = req.headers["user-agent"] || "Unknown";

  // Şüpheli User-Agent'lar için basit bir kontrol
  if (
    userAgent.includes("Hack") ||
    userAgent.includes("bot") ||
    userAgent.includes("curl") ||
    userAgent.length < 10
  ) {
    console.warn(
      `\x1b[41m\x1b[97m [UYARI] Şüpheli User-Agent: ${userAgent} | IP: ${req.ip} | Yol: ${req.path} \x1b[0m`
    );
  }
 
  next();
});
mongoose
  .connect(MONGODB_URI)
  .then(() => {
    console.log("MongoDB connected successfully");
  })
  .catch(err => {
    console.error("MongoDB connection error:", err);
    console.log("Connection URI:", MONGODB_URI.replace(/:[^\/]+@/, ":****@")); // Şifreyi gizle
  });

// Güvenlik middleware'leri
configureSecurityMiddleware(app);

// Genel input doğrulama
app.use(validateInput);

// Router'ları uygula
app.use("/api/auth", authRoutes);
app.use("/api/circuits", circuitRoutes);
app.use("/api", aiRoutes);

// Sağlık kontrolü
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    ip: req.ip,
  });
});

const distPath = path.join(__dirname, "../../dist");
app.use(express.static(distPath));

// API dışındaki tüm istekleri index.html'e yönlendir
app.get("*", (req, res) => {
  res.sendFile(path.join(distPath, "index.html"));
});

// Server'ı başlat
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
