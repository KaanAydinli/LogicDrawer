/**
 * @file Defines the DetectionStats model for tracking global detection statistics.
 */

import mongoose from "mongoose";

export interface DetectionStatsDocument extends mongoose.Document {
  totalCircuitsDetected: number;
  totalComponentsDetected: number;
  lastUpdated: Date;
}

const detectionStatsSchema = new mongoose.Schema({
  _id: {
    type: String,
    required: true,
  },
  totalCircuitsDetected: {
    type: Number,
    default: 0,
    required: true,
  },
  totalComponentsDetected: {
    type: Number,
    default: 0,
    required: true,
  },
  lastUpdated: {
    type: Date,
    default: Date.now,
  },
});

export const DetectionStats = mongoose.model<DetectionStatsDocument>(
  "DetectionStats",
  detectionStatsSchema
);

/**
 * Update detection statistics atomically
 * @param circuitsIncrement - Number of circuits to add (usually 1)
 * @param componentsIncrement - Number of components to add
 */
export async function updateDetectionStats(
  circuitsIncrement: number,
  componentsIncrement: number
): Promise<void> {
  try {
    // Use findOneAndUpdate with upsert to handle first-time creation
    // Uses atomic $inc to prevent race conditions
    await DetectionStats.findOneAndUpdate(
      { _id: "global" }, // Singleton document
      {
        $inc: {
          totalCircuitsDetected: circuitsIncrement,
          totalComponentsDetected: componentsIncrement,
        },
        $set: {
          lastUpdated: new Date(),
        },
      },
      {
        upsert: true, // Create if doesn't exist
        new: true,
      }
    );
  } catch (error) {
    // Log error but don't throw - stats failures shouldn't break detection
    console.error("Failed to update detection stats:", error);
  }
}

/**
 * Get current detection statistics
 */
export async function getDetectionStats(): Promise<DetectionStatsDocument | null> {
  try {
    const stats = await DetectionStats.findOne({ _id: "global" });

    // If no stats exist yet, create initial record
    if (!stats) {
      const newStats = await DetectionStats.create({
        _id: "global",
        totalCircuitsDetected: 0,
        totalComponentsDetected: 0,
        lastUpdated: new Date(),
      });
      return newStats;
    }

    return stats;
  } catch (error) {
    console.error("Failed to get detection stats:", error);
    return null;
  }
}
