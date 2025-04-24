import mongoose from "mongoose";

const circuitSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  username: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    default: "",
  },
  components: {
    type: Array,
    required: true,
  },
  wires: {
    type: Array,
    required: true,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  // Add sharedWith array to store usernames/IDs of users this circuit is shared with
  sharedWith: { type: [String], default: [] },
  isShared: {
    type: Boolean,
    required: false,
  },
  isPublic: {
    type: Boolean,
    required: false,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

export const Circuit = mongoose.model("Circuit", circuitSchema);
