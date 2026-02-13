/**
 * @file Defines the routes for statistics and analytics.
 */

import express from "express";
import { getDetectionStats } from "../models/DetectionStats";
import { Logger } from "../utils/logger";

const router = express.Router();

/**
 * Get detection statistics
 * Public endpoint - no authentication required
 */
router.get("/detection", async (req, res) => {
  try {
    const stats = await getDetectionStats();

    if (!stats) {
      return res.status(500).json({
        error: "Failed to retrieve statistics",
      });
    }

    res.json({
      totalCircuitsDetected: stats.totalCircuitsDetected,
      totalComponentsDetected: stats.totalComponentsDetected,
      lastUpdated: stats.lastUpdated,
    });
  } catch (error) {
    Logger.error("Error fetching detection stats:", error);
    res.status(500).json({
      error: "Failed to fetch statistics",
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

export default router;
