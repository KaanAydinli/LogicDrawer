/**
 * @file Defines the routes for user authentication.
 */

import express from "express";
import jwt from "jsonwebtoken";
import { User } from "../models/User";
import { authMiddleware, AuthRequest } from "../middlewares/auth";

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || "a";

/**
 * Register a new user.
 */
router.post("/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // Basic input validation
    if (typeof name !== "string" || typeof email !== "string" || typeof password !== "string") {
      return res.status(400).json({ error: "Invalid input format" });
    }

    // Email format validation
    const emailRegex = /^[^S@]+@[^S@]+\.[^S@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: "Invalid email format" });
    }

    // XSS protection
    const sanitizedName = name.replace(/<[^>]*>?/gm, "");

    const existingUser = await User.findOne({ email });
    const existingNameUser = await User.findOne({ name: sanitizedName });

    if (existingNameUser) {
      return res.status(400).json({ error: "Name already in use" });
    }
    if (existingUser) {
      return res.status(400).json({ error: "Email already in use" });
    }

    const user = new User({
      name: sanitizedName,
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

/**
 * Log in a user.
 */
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    // Basic input validation
    if (typeof email !== "string" || typeof password !== "string") {
      return res.status(400).json({ error: "Invalid email or password format" });
    }

    try {
      const user = await User.findOne({ email }).maxTimeMS(8000); // Reduce from your connection timeout

      if (!user) {
        return res.status(401).json({ error: "Invalid credentials" });
      }

      const isMatch = await user.comparePassword(password);
      if (!isMatch) {
        return res.status(401).json({ error: "Invalid email or password" });
      }

      const token = jwt.sign({ id: user._id, email: user.email }, JWT_SECRET, {
        expiresIn: "1h",
      });

      res.cookie("auth_token", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 1000,
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
      return res.status(500).json({ error: "Database connection issue" });
    }
  } catch (error) {
    res.status(500).json({ error: "Server error during login" });
  }
});

/**
 * Log out a user.
 */
router.post("/logout", (req, res) => {
  res.clearCookie("auth_token", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
  });
  res.json({ message: "Logged out successfully" });
});

/**
 * Get user information.
 */
router.get("/me", (req, res) => {
  try {
    const token = req.cookies.auth_token;

    if (!token) {
      return res.status(401).json({ error: "No authentication token found" });
    }

    const decoded = jwt.verify(token, JWT_SECRET) as { id: string };

    User.findById(decoded.id)
      .select("-password")
      .then(user => {
        if (!user) {
          return res.status(404).json({ error: "User not found" });
        }

        res.json({ user });
      })
      .catch(err => {
        res.status(500).json({ error: "Server error fetching user data" });
      });
  } catch (error) {
    res.status(401).json({ error: "Invalid token" });
  }
});

/**
 * Check authentication status.
 */
router.get("/check", authMiddleware, (req: AuthRequest, res) => {
  res.json({
    authenticated: true,
    user: {
      id: req.user?.id,
      email: req.user?.email,
    },
  });
});

/**
 * Refresh authentication token (secure version).
 */
router.post("/refresh", authMiddleware, async (req: AuthRequest, res) => {
  try {
    // Token validation is handled by authMiddleware
    // We can access the validated user info from req.user
    if (!req.user || !req.user.id) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Create a new token
    const token = jwt.sign({ id: user._id, email: user.email }, JWT_SECRET, { expiresIn: "24h" });

    // Send as a cookie
    res.cookie("auth_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    });

    res.json({
      message: "Token refreshed successfully",
      expiresIn: 24 * 60 * 60, // in seconds
    });
  } catch (error) {
    res.status(500).json({ error: "Error refreshing token" });
  }
});

export default router;
