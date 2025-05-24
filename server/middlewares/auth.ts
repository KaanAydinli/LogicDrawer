import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || "a";

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
  };
}

export const authMiddleware = (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      // Enhanced debugging for cookie authentication
      console.log("------- Auth Debug -------");
      console.log("Request path:", req.path);
      console.log("Request cookies:", req.cookies);
      console.log("auth_token cookie:", req.cookies.auth_token || "NOT FOUND");
      
      // Get token from cookie ONLY (no fallback to headers)
      const token = req.cookies.auth_token;
      
      if (!token) {
        console.log("No auth_token cookie found - authentication failed");
        return res.status(401).json({ error: "Authentication token missing" });
      }
      
      try {
        // Verify the token using the same secret used for signing
        const decodedToken = jwt.verify(token, JWT_SECRET) as { id: string, email: string };
        req.user = { id: decodedToken.id, email: decodedToken.email };
        console.log(`Authentication successful for user: ${decodedToken.email} (${decodedToken.id})`);
        next();
      } catch (tokenError) {
        console.error("Token verification failed:", tokenError);
        return res.status(401).json({ error: "Invalid token" });
      }
    } catch (error) {
      console.error("Auth middleware error:", error);
      return res.status(500).json({ error: "Authentication error" });
    }
};