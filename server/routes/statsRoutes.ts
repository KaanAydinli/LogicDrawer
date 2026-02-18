/**
 * @file Defines the routes for statistics and analytics.
 */

import express from "express";
import { getDetectionStats } from "../models/DetectionStats";
import { Circuit } from "../models/Circuit";
import { User } from "../models/User";
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

/**
 * Get total stored circuits and components statistics
 * Public endpoint - no authentication required
 */
router.get("/overview", async (req, res) => {
  try {
    const stats = await Circuit.aggregate([
      {
        $group: {
          _id: null,
          totalCircuits: { $sum: 1 },
          totalComponents: { $sum: { $size: "$components" } },
        },
      },
    ]);

    if (stats.length > 0) {
      res.json({
        totalCircuits: stats[0].totalCircuits,
        totalComponents: stats[0].totalComponents,
      });
    } else {
      res.json({
        totalCircuits: 0,
        totalComponents: 0,
      });
    }
  } catch (error) {
    Logger.error("Error fetching overview stats:", error);
    res.status(500).json({
      error: "Failed to fetch overview statistics",
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * Get total registered user count
 * Public endpoint - no authentication required
 */
router.get("/users", async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    res.json({ totalUsers });
  } catch (error) {
    Logger.error("Error fetching user count:", error);
    res.status(500).json({
      error: "Failed to fetch user statistics",
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * Get all public stats in a single request
 * Public endpoint - no authentication required
 */
router.get("/all", async (req, res) => {
  try {
    const [detectionStats, circuitStats, totalUsers] = await Promise.all([
      getDetectionStats(),
      Circuit.aggregate([
        {
          $group: {
            _id: null,
            totalCircuits: { $sum: 1 },
            totalComponents: { $sum: { $size: "$components" } },
          },
        },
      ]),
      User.countDocuments(),
    ]);

    const overview =
      circuitStats.length > 0
        ? {
            totalCircuits: circuitStats[0].totalCircuits,
            totalComponents: circuitStats[0].totalComponents,
          }
        : { totalCircuits: 0, totalComponents: 0 };

    res.json({
      totalCircuits: overview.totalCircuits,
      totalComponents: overview.totalComponents,
      totalUsers,
      totalCircuitsDetected: detectionStats?.totalCircuitsDetected ?? 0,
      totalComponentsDetected: detectionStats?.totalComponentsDetected ?? 0,
      lastUpdated: detectionStats?.lastUpdated ?? null,
    });
  } catch (error) {
    Logger.error("Error fetching all stats:", error);
    res.status(500).json({
      error: "Failed to fetch statistics",
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

export default router;
