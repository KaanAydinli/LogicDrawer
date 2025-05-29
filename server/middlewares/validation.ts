import { Request, Response, NextFunction } from 'express';
import { sanitizeObject } from './security';

/**
 * Genel input doğrulama middleware
 */
export const validateInput = (req: Request, res: Response, next: NextFunction) => {
  try {
    // Request body, query ve params sanitize işlemi
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
    console.error("Input validation error:", error);
    return res.status(400).json({ error: "Invalid input data" });
  }
};

/**
 * Devre verisi doğrulama
 */
export const validateCircuitData = (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, components, wires } = req.body;
    
    if (!name || typeof name !== 'string') {
      return res.status(400).json({ error: "Circuit name is required and must be a string" });
    }
    
    if (!Array.isArray(components)) {
      return res.status(400).json({ error: "Components must be an array" });
    }
    
    if (!Array.isArray(wires)) {
      return res.status(400).json({ error: "Wires must be an array" });
    }
    
    // components doğrulama
    for (const component of components) {
      if (!component.type || typeof component.type !== 'string') {
        return res.status(400).json({ error: "All components must have a valid type" });
      }
      
      if (!component.position || typeof component.position !== 'object') {
        return res.status(400).json({ error: "All components must have a valid position" });
      }
    }
    
    next();
  } catch (error) {
    console.error("Circuit validation error:", error);
    return res.status(400).json({ error: "Invalid circuit data" });
  }
};