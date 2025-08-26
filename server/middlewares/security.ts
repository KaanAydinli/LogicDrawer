/**
 * @file Configures various security middlewares for the Express application.
 */

import { Request, Response, NextFunction } from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import mongoSanitize from "express-mongo-sanitize";
import xssFilters from "xss-filters";
import hpp from "hpp";

/**
 * Configures and registers all security-related middlewares.
 * @param {any} app - The Express application instance.
 */
export const configureSecurityMiddleware = (app: any) => {
  // Set security-related HTTP headers
  app.use(
    helmet({
      contentSecurityPolicy: process.env.NODE_ENV === "production" ? undefined : false,
    })
  );

  // Rate limiting to prevent brute-force attacks
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // Max requests per IP
    standardHeaders: true,
    legacyHeaders: false,
    message: "Too many login attempts. Please try again in 15 minutes.",
  });

  // Apply rate limiter to auth routes
  app.use("/api/auth/login", authLimiter);
  app.use("/api/auth/register", authLimiter);

  // General API rate limiter
  const apiLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 100, // Max requests per IP
    standardHeaders: true,
    legacyHeaders: false,
  });

  app.use("/api", apiLimiter);

  const generalLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 150, // Max requests per IP
    standardHeaders: true,
    legacyHeaders: false,
  });
  app.use(generalLimiter);

  // Sanitize user input to prevent NoSQL injection attacks
  app.use(mongoSanitize());

  // Prevent HTTP Parameter Pollution
  app.use(hpp());

  // Set additional security headers
  app.use((req: Request, res: Response, next: NextFunction) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("X-XSS-Protection", "1; mode=block");
    next();
  });
};

/**
 * Sanitizes a string to prevent XSS attacks.
 * Uses xss-filters instead of the deprecated xss-clean.
 * @param {string} str - The string to sanitize.
 * @returns {string} - The sanitized string.
 */
export const sanitizeString = (str: string): string => {
  return xssFilters.inHTMLData(str);
};

/**
 * Recursively sanitizes an object or an array.
 * @param {any} obj - The object or array to sanitize.
 * @returns {any} - The sanitized object or array.
 */
export const sanitizeObject = (obj: any): any => {
  if (typeof obj !== "object" || obj === null) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item));
  }

  const result: any = {};
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === "string") {
      result[key] = sanitizeString(value);
    } else if (typeof value === "object" && value !== null) {
      result[key] = sanitizeObject(value);
    } else {
      result[key] = value;
    }
  }

  return result;
};
