// models/candidate.js
import mongoose from "mongoose";

const candidateSchema = new mongoose.Schema(
  {
    name: String,
    email: { type: String, unique: true },
    phone: String,
    videoAnalysis: {
      happy: Number,
      neutral: Number,
      sad: Number,
      angry: Number,
      disgust: Number,
      fear: Number,
      surprise: Number,
      dominant: String,
    },
    videoInterviewStatus: { type: String, default: "Pending" },
  },
  { timestamps: true }
);

const Candidate = mongoose.model("Candidate", candidateSchema);

export default Candidate;
