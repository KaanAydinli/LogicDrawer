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

  comments: [
    {
      userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },
      text: String,
      authorName: String,
      date: {
        type: Date,
        default: Date.now,
      },
    },
  ],
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },

  sharedWith: { type: [String], default: [] },
  isShared: {
    type: Boolean,
    required: false,
  },
  likedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  isPublic: {
    type: Boolean,
    required: false,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  likes: {
    type: Number,
    default: 0,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

export const Circuit = mongoose.model("Circuit", circuitSchema);
