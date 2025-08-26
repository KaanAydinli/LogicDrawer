/**
 * @file Contains middleware for input validation and sanitization.
 */

import { Request, Response, NextFunction } from "express";
import { sanitizeObject } from "./security";

/**
 * General-purpose middleware to sanitize request body, query, and params.
 * @param {Request} req - The Express request object.
 * @param {Response} res - The Express response object.
 * @param {NextFunction} next - The next middleware function.
 */
export const validateInput = (req: Request, res: Response, next: NextFunction) => {
  try {
    // Sanitize request body, query, and params
    if (req.body) {
      req.body = sanitizeObject(req.body);
    }

    if (req.query) {
      req.query = sanitizeObject(req.query);
    }

    if (req.params) {
      req.params = sanitizeObject(req.params);
    }

    next();
  } catch (error) {
    return res.status(400).json({ error: "Invalid input data" });
  }
};

/**
 * Middleware to validate the data for a circuit.
 * @param {Request} req - The Express request object.
 * @param {Response} res - The Express response object.
 * @param {NextFunction} next - The next middleware function.
 */
export const validateCircuitData = (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, components, wires } = req.body;

    if (!name || typeof name !== "string") {
      return res.status(400).json({ error: "Circuit name is required and must be a string" });
    }

    if (!Array.isArray(components)) {
      return res.status(400).json({ error: "Components must be an array" });
    }

    if (!Array.isArray(wires)) {
      return res.status(400).json({ error: "Wires must be an array" });
    }

    // Validate components
    for (const component of components) {
      if (!component.type || typeof component.type !== "string") {
        return res.status(400).json({ error: "All components must have a valid type" });
      }

      if (!component.position || typeof component.position !== "object") {
        return res.status(400).json({ error: "All components must have a valid position" });
      }
    }

    next();
  } catch (error) {
    return res.status(400).json({ error: "Invalid circuit data" });
  }
};
