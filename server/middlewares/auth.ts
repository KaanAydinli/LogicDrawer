import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { User } from '../models/User';

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
 * Token yenileme mantığı da içeren geliştirilmiş auth middleware
 */
export const authMiddleware = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (process.env.DEBUG_AUTH === 'true') {
        console.log("------- Auth Debug -------");
        console.log("Request path:", req.path);
        console.log("Request cookies:", req.cookies);
        console.log("auth_token cookie:", req.cookies.auth_token || "NOT FOUND");
      }
      
      // Cookie'den token al
      const token = req.cookies.auth_token;
      
      if (!token) {
        if (process.env.DEBUG_AUTH === 'true') {
          console.log("No auth_token cookie found - authentication failed");
        }
        return res.status(401).json({ error: "Authentication token missing" });
      }
      
      try {
        // Token doğrulama
        const decodedToken = jwt.verify(token, JWT_SECRET) as { 
          id: string, 
          email: string,
          name?: string,
          role?: string,
          exp?: number
        };
        
        // User bilgilerini request'e ekle
        req.user = { 
          id: decodedToken.id, 
          email: decodedToken.email,
          name: decodedToken.name,
          role: decodedToken.role
        };
        
        if (process.env.DEBUG_AUTH === 'true') {
          console.log(`Authentication successful for user: ${decodedToken.email} (${decodedToken.id})`);
        }
        
        // Token yenileme kontrolü (isteğe bağlı)
        // Son kullanma süresi 30 dakikadan az kaldıysa token'ı yenile
        const tokenExp = decodedToken.exp || 0;
        const currentTime = Math.floor(Date.now() / 1000);
        
        if (tokenExp && tokenExp - currentTime < 30 * 60) { // 30 dakika
          try {
            // Güncel kullanıcı bilgilerini al
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
              
              // Yeni token'ı ayarla
              res.cookie('auth_token', newToken, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'lax',
                path: '/',
                maxAge: 60 * 60 * 1000 // 1 saat
              });
            }
          } catch (refreshError) {
            // Token yenileme başarısız olsa bile akışı bozmaz
            console.error("Error refreshing token:", refreshError);
          }
        }
        
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

/**
 * Admin rolünü kontrol eden middleware
 */
export const adminRequired = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({ error: "Authentication required" });
  }
  
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: "Admin privileges required" });
  }
  
  next();
};

/**
 * Kaynağın sahibini kontrol eden middleware
 */
export const ownerRequired = (resourceUserId: string) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: "Authentication required" });
    }
    
    // Kullanıcı kaynak sahibi mi?
    if (req.user.id === resourceUserId) {
      next();
    } else {
      return res.status(403).json({ error: "Permission denied" });
    }
  };
};