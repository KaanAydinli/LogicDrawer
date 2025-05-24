import express from "express";
import jwt from "jsonwebtoken";
import { User } from "../models/User";
import { authMiddleware, AuthRequest } from "../middlewares/auth";

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || "a";

// Kullanıcı kaydı
router.post("/register", async (req, res) => {
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

// Kullanıcı girişi
router.post("/login", async (req, res) => {
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

    const token = jwt.sign({ id: user._id, email: user.email }, JWT_SECRET, {
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

// Kullanıcı çıkışı
router.post("/logout", (req, res) => {
  res.clearCookie('auth_token', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
  });
  res.json({ message: "Logged out successfully" });
});

// Kullanıcı bilgilerini getir
router.get("/me", (req, res) => {
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

// Auth durumunu kontrol et
router.get("/check", authMiddleware, (req: AuthRequest, res) => {
  res.json({
    authenticated: true,
    user: {
      id: req.user?.id,
      email: req.user?.email,
    },
  });
});

// Token yenile
router.post("/refresh", async (req, res) => {
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

export default router;