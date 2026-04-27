/**
 * @file Defines the AgentStats model for tracking global AI agent usage.
 *
 * Mirrors the DetectionStats singleton-document pattern: one document with
 * `_id: "global"`, atomic `$inc` updates, fire-and-forget callers.
 */

import mongoose from "mongoose";

export interface AgentStatsDocument extends mongoose.Document {
  totalAgentCalls: number;
  totalUserMessages: number;
  totalToolCalls: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCacheReadTokens: number;
  totalCacheWriteTokens: number;
  lastUpdated: Date;
}

const agentStatsSchema = new mongoose.Schema({
  _id: {
    type: String,
    required: true,
  },
  totalAgentCalls: {
    type: Number,
    default: 0,
    required: true,
  },
  totalUserMessages: {
    type: Number,
    default: 0,
    required: true,
  },
  totalToolCalls: {
    type: Number,
    default: 0,
    required: true,
  },
  totalInputTokens: {
    type: Number,
    default: 0,
    required: true,
  },
  totalOutputTokens: {
    type: Number,
    default: 0,
    required: true,
  },
  totalCacheReadTokens: {
    type: Number,
    default: 0,
    required: true,
  },
  totalCacheWriteTokens: {
    type: Number,
    default: 0,
    required: true,
  },
  lastUpdated: {
    type: Date,
    default: Date.now,
  },
});

export const AgentStats = mongoose.model<AgentStatsDocument>(
  "AgentStats",
  agentStatsSchema
);

export interface AgentStatsIncrement {
  agentCalls?: number;
  userMessages?: number;
  toolCalls?: number;
  inputTokens?: number;
  outputTokens?: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
}

/**
 * Atomically increment agent statistics. Failures are swallowed — telemetry
 * must never break the agent request path.
 */
export async function updateAgentStats(inc: AgentStatsIncrement): Promise<void> {
  const $inc: Record<string, number> = {};
  if (inc.agentCalls) $inc.totalAgentCalls = inc.agentCalls;
  if (inc.userMessages) $inc.totalUserMessages = inc.userMessages;
  if (inc.toolCalls) $inc.totalToolCalls = inc.toolCalls;
  if (inc.inputTokens) $inc.totalInputTokens = inc.inputTokens;
  if (inc.outputTokens) $inc.totalOutputTokens = inc.outputTokens;
  if (inc.cacheReadTokens) $inc.totalCacheReadTokens = inc.cacheReadTokens;
  if (inc.cacheWriteTokens) $inc.totalCacheWriteTokens = inc.cacheWriteTokens;

  if (Object.keys($inc).length === 0) return;

  try {
    await AgentStats.findOneAndUpdate(
      { _id: "global" },
      {
        $inc,
        $set: { lastUpdated: new Date() },
      },
      { upsert: true, new: true }
    );
  } catch (error) {
    console.error("Failed to update agent stats:", error);
  }
}

export async function getAgentStats(): Promise<AgentStatsDocument | null> {
  try {
    const stats = await AgentStats.findOne({ _id: "global" });
    if (!stats) {
      return await AgentStats.create({
        _id: "global",
        totalAgentCalls: 0,
        totalUserMessages: 0,
        totalToolCalls: 0,
        totalInputTokens: 0,
        totalOutputTokens: 0,
        totalCacheReadTokens: 0,
        totalCacheWriteTokens: 0,
        lastUpdated: new Date(),
      });
    }
    return stats;
  } catch (error) {
    console.error("Failed to get agent stats:", error);
    return null;
  }
}
