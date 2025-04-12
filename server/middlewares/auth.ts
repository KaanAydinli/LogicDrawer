import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || "s";

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
  };
}

// Review this code to ensure it's working correctly
export const authMiddleware = (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const authHeader = req.headers.authorization;
      console.log("Auth header:", authHeader || "Missing");
      
      if (!authHeader) {
        console.log("No authorization header");
        return res.status(401).json({ error: "Authorization header missing" });
      }
      
      const token = authHeader.split(" ")[1];
      
      if (!token) {
        console.log("No token in auth header");
        return res.status(401).json({ error: "Token missing from Authorization header" });
      }
      
      try {
        const decodedToken = jwt.verify(token, JWT_SECRET) as { id: string, email: string };
        req.user = { id: decodedToken.id, email: decodedToken.email };
        console.log(`User authenticated: ${decodedToken.email} (ID: ${decodedToken.id})`);
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