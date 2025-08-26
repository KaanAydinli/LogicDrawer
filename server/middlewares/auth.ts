import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { User } from "../models/User";

const JWT_SECRET = process.env.JWT_SECRET || "a";

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    name?: string;
    role?: string;
  };
}

/**
 * Enhanced authentication middleware with token refresh logic.
 * @param {AuthRequest} req - The Express request object.
 * @param {Response} res - The Express response object.
 * @param {NextFunction} next - The next middleware function.
 */
export const authMiddleware = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    // Get token from cookie
    const token = req.cookies.auth_token;

    if (!token) {
      return res.status(401).json({ error: "Authentication token missing" });
    }

    try {
      // Verify token
      const decodedToken = jwt.verify(token, JWT_SECRET) as {
        id: string;
        email: string;
        name?: string;
        role?: string;
        exp?: number;
      };

      // Add user information to the request
      req.user = {
        id: decodedToken.id,
        email: decodedToken.email,
        name: decodedToken.name,
        role: decodedToken.role,
      };

      // Optional: Token refresh check
      // Refresh the token if it's about to expire in less than 30 minutes
      const tokenExp = decodedToken.exp || 0;
      const currentTime = Math.floor(Date.now() / 1000);

      if (tokenExp && tokenExp - currentTime < 30 * 60) {
        // 30 minutes
        try {
          // Get current user information
          const user = await User.findById(decodedToken.id).select("-password");

          if (user) {
            const newToken = jwt.sign(
              {
                id: user._id,
                email: user.email,
                name: user.name,
              },
              JWT_SECRET,
              { expiresIn: "1h" }
            );

            // Set the new token
            res.cookie("auth_token", newToken, {
              httpOnly: true,
              secure: process.env.NODE_ENV === "production",
              sameSite: "lax",
              path: "/",
              maxAge: 60 * 60 * 1000, // 1 hour
            });
          }
        } catch (refreshError) {
          // Do not interrupt the flow even if token refresh fails
        }
      }

      next();
    } catch (tokenError) {
      return res.status(401).json({ error: "Invalid token" });
    }
  } catch (error) {
    return res.status(500).json({ error: "Authentication error" });
  }
};

/**
 * Middleware to check for admin role.
 * @param {AuthRequest} req - The Express request object.
 * @param {Response} res - The Express response object.
 * @param {NextFunction} next - The next middleware function.
 */
export const adminRequired = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({ error: "Authentication required" });
  }

  if (req.user.role !== "admin") {
    return res.status(403).json({ error: "Admin privileges required" });
  }

  next();
};

/**
 * Middleware to check for resource ownership.
 * @param {string} resourceUserId - The ID of the user who owns the resource.
 * @returns {Function} - The middleware function.
 */
export const ownerRequired = (resourceUserId: string) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: "Authentication required" });
    }

    // Is the user the owner of the resource?
    if (req.user.id === resourceUserId) {
      next();
    } else {
      return res.status(403).json({ error: "Permission denied" });
    }
  };
};
