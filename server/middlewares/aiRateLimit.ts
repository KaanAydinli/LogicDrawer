/**
 * @file Rate limiting middleware specifically for AI API routes.
 * Limits unauthenticated users to 2 messages per day while allowing unlimited access for authenticated users.
 */

import { Request, Response, NextFunction } from "express";
import { AuthRequest } from "./auth";

interface RateLimitStore {
  [key: string]: {
    count: number;
    resetTime: number;
  };
}

// In-memory store for rate limiting (consider using Redis for production)
const rateLimitStore: RateLimitStore = {};

// Clean up expired entries every hour
setInterval(
  () => {
    const now = Date.now();
    Object.keys(rateLimitStore).forEach(key => {
      if (rateLimitStore[key].resetTime <= now) {
        delete rateLimitStore[key];
      }
    });
  },
  60 * 60 * 1000
); // 1 hour

/**
 * Custom rate limiting middleware for AI routes.
 * - Authenticated users: unlimited requests
 * - Unauthenticated users: 2 requests per day (24 hours)
 */
export const aiRateLimit = (req: AuthRequest, res: Response, next: NextFunction) => {
  // If user is authenticated, allow unlimited access
  if (req.user) {
    return next();
  }

  const clientIp = req.ip || req.connection.remoteAddress || "unknown";
  const key = `ai_rate_limit:${clientIp}`;
  const now = Date.now();
  const dailyWindow = 24 * 60 * 60 * 1000;

  let rateLimitData = rateLimitStore[key];

  if (!rateLimitData || rateLimitData.resetTime <= now) {
    rateLimitData = {
      count: 0,
      resetTime: now + dailyWindow,
    };
    rateLimitStore[key] = rateLimitData;
  }

  if (rateLimitData.count >= 2) {
    const resetTimeHours = Math.ceil((rateLimitData.resetTime - now) / (60 * 60 * 1000));

    return res.status(429).json({
      error: "Daily message limit exceeded",
      message:
        "You have reached the daily limit of 2 messages. Please create an account for unlimited access or try again tomorrow.",
      resetIn: `${resetTimeHours} hour(s)`,
      resetTime: new Date(rateLimitData.resetTime).toISOString(),
    });
  }

  rateLimitData.count += 1;
  rateLimitStore[key] = rateLimitData;
  res.setHeader("X-RateLimit-Limit", "2");
  res.setHeader("X-RateLimit-Remaining", Math.max(0, 2 - rateLimitData.count));
  res.setHeader("X-RateLimit-Reset", new Date(rateLimitData.resetTime).toISOString());

  next();
};

/**
 * Get current rate limit status for an IP (useful for debugging)
 */
export const getRateLimitStatus = (ip: string) => {
  const key = `ai_rate_limit:${ip}`;
  const rateLimitData = rateLimitStore[key];

  if (!rateLimitData) {
    return {
      count: 0,
      limit: 2,
      remaining: 2,
      resetTime: null,
    };
  }

  const now = Date.now();
  if (rateLimitData.resetTime <= now) {
    return {
      count: 0,
      limit: 2,
      remaining: 2,
      resetTime: null,
    };
  }

  return {
    count: rateLimitData.count,
    limit: 2,
    remaining: Math.max(0, 2 - rateLimitData.count),
    resetTime: new Date(rateLimitData.resetTime).toISOString(),
  };
};
