/**
 * @file Defines the routes for circuit management.
 */

import express from "express";
import mongoose from "mongoose";
import { authMiddleware, AuthRequest } from "../middlewares/auth";
import { Circuit } from "../models/Circuit";
import { User } from "../models/User";
import { validateCircuitData } from "../middlewares/validation";

const router = express.Router();

// Apply auth middleware to all routes
router.use(authMiddleware);

/**
 * Get all circuits for the authenticated user.
 */
router.get("/", async (req: AuthRequest, res) => {
  try {
    const ownCircuits = await Circuit.find({ userId: req.user?.id })
      .populate("userId", "name email")
      .sort({ createdAt: -1 });

    const sharedCircuits = await Circuit.find({
      sharedWith: req.user?.id,
    })
      .populate("userId", "name email")
      .sort({ createdAt: -1 });

    const publicCircuits = await Circuit.find({
      userId: { $ne: req.user?.id },
      isPublic: true,
    })
      .populate("userId", "name email")
      .sort({ createdAt: -1 });

    const sharedCircuitsWithFlag = sharedCircuits.map(circuit => {
      const circuitObj = circuit.toObject();
      circuitObj.isShared = true;
      return circuitObj;
    });

    const publicCircuitsWithFlag = publicCircuits.map(circuit => {
      const circuitObj = circuit.toObject();
      circuitObj.isPublic = true;
      return circuitObj;
    });

    const allCircuits = [...ownCircuits, ...sharedCircuitsWithFlag, ...publicCircuitsWithFlag];

    res.json(allCircuits);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch circuits" });
  }
});

/**
 * Search for circuits.
 */
router.get("/search", async (req: AuthRequest, res) => {
  try {
    const query = req.query.q as string;

    if (!query || typeof query !== "string") {
      return res.status(400).json({ error: "Search query is required" });
    }

    const searchPattern = new RegExp(`^${query}`, "i");

    const matchingCircuits = await Circuit.find({
      $or: [{ name: searchPattern }, { description: searchPattern }],
      $and: [
        {
          $or: [{ userId: req.user?.id }, { sharedWith: req.user?.id }, { isPublic: true }],
        },
      ],
    })
      .populate("userId", "name email")
      .sort({ createdAt: -1 });

    res.json(matchingCircuits);
  } catch (error) {
    res.status(500).json({ error: "Failed to search circuits" });
  }
});

/**
 * Get circuits shared with me.
 */
router.get("/shared-with-me", async (req: AuthRequest, res) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    try {
      const circuits = await Circuit.find({ sharedWith: user.name })
        .populate("userId", "name email")
        .sort({ dateCreated: -1 });

      res.json(circuits);
    } catch (queryError) {
      return res.status(500).json({ error: "Database query error" });
    }
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch shared circuits" });
  }
});

/**
 * Get public circuits.
 */
router.get("/public", async (req, res) => {
  try {
    const circuits = await Circuit.find({ isPublic: true })
      .populate("userId", "name email")
      .sort({ dateCreated: -1 });

    res.json(circuits);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch public circuits" });
  }
});

/**
 * Update visibility of a circuit.
 */
router.put("/:id/visibility", async (req: AuthRequest, res) => {
  try {
    const { isPublic } = req.body;

    if (isPublic === undefined) {
      return res.status(400).json({ error: "isPublic field is required" });
    }

    const circuit = await Circuit.findOneAndUpdate(
      { _id: req.params.id, userId: req.user?.id },
      { isPublic: Boolean(isPublic) },
      { new: true }
    );

    if (!circuit) {
      return res.status(404).json({ error: "Circuit not found or you don't have permission" });
    }

    res.json({
      isPublic: circuit.isPublic,
      message: `Circuit is now ${circuit.isPublic ? "public" : "private"}`,
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to update circuit visibility" });
  }
});

/**
 * Like a circuit.
 */
router.post("/:id/like", async (req: AuthRequest, res) => {
  try {
    const circuitId = req.params.id;
    const userId = req.user?.id;

    const circuit = await Circuit.findById(circuitId);

    if (!circuit) {
      return res.status(404).json({ error: "Circuit not found" });
    }

    if (!circuit.likedBy) {
      circuit.likedBy = [];
    }

    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    const userIdStr = userId.toString();
    if (circuit.likedBy.some(id => id.toString() === userIdStr)) {
      return res.status(400).json({ error: "You have already liked this circuit" });
    }

    circuit.likedBy.push(new mongoose.Types.ObjectId(userId));
    circuit.likes = circuit.likedBy.length;

    await circuit.save();

    res.json({
      message: "Circuit liked successfully",
      likes: circuit.likes,
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to like circuit" });
  }
});

/**
 * Download a circuit.
 */
router.get("/:id/download", async (req: AuthRequest, res) => {
  try {
    const circuitId = req.params.id;
    const circuit = await Circuit.findOne({
      _id: circuitId,
      userId: req.user?.id,
    });

    if (!circuit) {
      return res.status(404).json({ error: "Circuit not found" });
    }

    res.setHeader("Content-Type", "application/json");
    res.setHeader("Content-Disposition", `attachment; filename=${circuit.name || "circuit"}.json`);

    res.json(circuit);
  } catch (error) {
    res.status(500).json({ error: "Failed to download circuit" });
  }
});

/**
 * Share a circuit.
 */
router.post("/:id/share", async (req: AuthRequest, res) => {
  try {
    const { username } = req.body;

    if (!username) {
      return res.status(400).json({ error: "Username is required" });
    }

    const targetUser = await User.findOne({ name: username });
    if (!targetUser) {
      return res.status(404).json({ error: "User not found" });
    }
    const circuit = await Circuit.findOne({
      _id: req.params.id,
      userId: req.user?.id,
    });

    if (!circuit) {
      return res.status(404).json({ error: "Circuit not found or you don't have permission" });
    }

    if (!circuit.sharedWith) {
      circuit.sharedWith = [];
    }

    if (circuit.sharedWith.includes(username)) {
      return res.status(400).json({ error: "Circuit already shared with this user" });
    }

    circuit.sharedWith.push(username);
    await circuit.save();

    res.json({
      message: `Circuit shared with ${username}`,
      circuit,
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to share circuit" });
  }
});

// Create a new circuit
router.post("/", validateCircuitData, async (req: AuthRequest, res) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: "User ID not found in token" });
    }

    const circuitData = {
      ...req.body,
      userId: req.user.id,
    };

    const circuit = new Circuit(circuitData);

    try {
      await circuit.save();
      res.status(201).json(circuit);
    } catch (validationError: any) {
      return res.status(400).json({
        error: "Invalid circuit data",
        details: validationError.message,
      });
    }
  } catch (error: any) {
    res.status(500).json({
      error: "Failed to save circuit",
      details: error.message,
    });
  }
});

// Add a comment to a circuit
router.post("/:id/comments", async (req: AuthRequest, res) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const circuitId = req.params.id;
    const { text } = req.body;

    if (!text) {
      return res.status(400).json({ error: "Comment text is required" });
    }

    // Get user
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const circuit = await Circuit.findById(circuitId);
    if (!circuit) {
      return res.status(404).json({ error: "Circuit not found" });
    }

    circuit.comments.push({
      userId: new mongoose.Types.ObjectId(req.user.id),
      text,
      date: new Date(),
      authorName: user.name,
    });
    await circuit.save();

    return res.status(201).json({
      success: true,
      message: "Comment added successfully",
      comment: {
        authorId: req.user.id,
        authorName: user.name,
        date: new Date(),
        text,
      },
    });
  } catch (error: any) {
    console.error("Error adding comment:", error);
    res.status(500).json({
      error: "Failed to add comment",
      details: error.message,
    });
  }
});

// Get comments for a circuit
router.get("/:id/comments", async (req: AuthRequest, res) => {
  try {
    const circuitId = req.params.id;

    // Get circuit details with populated user information
    const circuit = await Circuit.findById(circuitId).populate({
      path: "comments.userId",
      model: "User",
      select: "name email",
    });

    if (!circuit) {
      return res.status(404).json({ error: "Circuit not found" });
    }

    const formattedComments = await Promise.all(
      (circuit.comments || []).map(async comment => {
        const user =
          comment.userId && typeof comment.userId === "object"
            ? comment.userId
            : await User.findById(comment.userId);

        return {
          authorId: comment.userId.toString(),

          authorName:
            comment.authorName ||
            (user && typeof user === "object" && "name" in user ? user.name : "Unknown User"),
          date: comment.date || comment.date || new Date(),
          text: comment.text,
          likes: 0,
        };
      })
    );

    return res.json(formattedComments);
  } catch (error) {
    console.error("Error fetching comments:", error);
    res.status(500).json({ error: "Failed to fetch comments" });
  }
});

// Update circuit
router.put("/:id", validateCircuitData, async (req: AuthRequest, res) => {
  try {
    const circuitId = req.params.id;
    const updateData = req.body;

    const user = await User.findById(req.user?.id);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const circuit = await Circuit.findOne({
      _id: circuitId,
      $or: [{ userId: req.user?.id }, { sharedWith: user.name }],
    });

    if (!circuit) {
      const publicCircuit = await Circuit.findOne({
        _id: circuitId,
        isPublic: true,
      });

      if (publicCircuit) {
        return res.status(403).json({
          error: "This is a public circuit. You need to fork it first.",
          circuitId: circuitId,
          isForkable: true,
        });
      }

      return res.status(404).json({ error: "Circuit not found or you don't have permission" });
    }

    const updates = {
      name: updateData.name,
      components: updateData.components,
      wires: updateData.wires,
      dateModified: new Date(),
    };

    const updatedCircuit = await Circuit.findByIdAndUpdate(circuitId, updates, { new: true });

    res.json(updatedCircuit);
  } catch (error) {
    res.status(500).json({ error: "Failed to update circuit" });
  }
});

// Get circuit details
router.get("/:id", async (req: AuthRequest, res) => {
  try {
    const user = await User.findById(req.user?.id);
    if (!user) {
      return res.status(401).json({ error: "User not found" });
    }

    let circuit = await Circuit.findOne({
      _id: req.params.id,
      userId: req.user?.id,
    });

    if (!circuit) {
      circuit = await Circuit.findOne({
        _id: req.params.id,
        sharedWith: user.name,
      });
    }

    if (!circuit) {
      circuit = await Circuit.findOne({
        _id: req.params.id,
        isPublic: true,
      });
    }

    if (!circuit) {
      return res.status(404).json({ error: "Circuit not found or you don't have permission" });
    }

    res.json(circuit);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch circuit" });
  }
});

// Delete circuit
router.delete("/:id", async (req: AuthRequest, res) => {
  try {
    const circuit = await Circuit.findOneAndDelete({
      _id: req.params.id,
      userId: req.user?.id,
    });

    if (!circuit) {
      return res.status(404).json({ error: "Circuit not found or you don't have permission" });
    }
    res.json({ message: "Circuit deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete circuit" });
  }
});

export default router;
