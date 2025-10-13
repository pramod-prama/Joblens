// controllers/interview.js
import asyncHandler from "express-async-handler";
import Candidate from "../model/candidate.js";

// @desc    Save interview emotion data
// @route   POST /api/v1/interview/save
// @access  Private
const saveInterview = asyncHandler(async (req, res) => {
  const { email, name, emotions } = req.body;

  if (!email || !name || !emotions) {
    res.status(400);
    throw new Error("Missing required fields");
  }

  // Find candidate by email
  let candidate = await Candidate.findOne({ email });
  if (!candidate) {
    // create candidate if doesn't exist
    candidate = new Candidate({ email, name });
  }

  // Save MorphCast emotion data
  candidate.videoAnalysis = {
    happy: emotions.happy || 0,
    neutral: emotions.neutral || 0,
    sad: emotions.sad || 0,
    angry: emotions.angry || 0,
    disgust: emotions.disgust || 0,
    fear: emotions.fear || 0,
    surprise: emotions.surprise || 0,
    dominant: emotions.dominant || "Neutral",
  };
  candidate.videoInterviewStatus = "Completed";

  await candidate.save();

  res.status(200).json({ message: "Interview saved successfully", candidate });
});

// @desc    Delete all candidate interview data
// @route   DELETE /api/v1/interview/cleanup
// @access  Private/Admin
const cleanupAllInterviews = asyncHandler(async (req, res) => {
  // 1️⃣ Check if there are any candidates
  const count = await Candidate.countDocuments();
  if (count === 0) {
    return res.status(200).json({
      status: "success",
      message: "No candidates found — cleanup skipped.",
    });
  }

  try {
    const result = await Candidate.deleteMany({});
    res.status(200).json({
      status: "success",
      message: "All candidate interview data deleted successfully.",
      deletedRecords: result.deletedCount,
    });
  } catch (err) {
    console.error("Error deleting candidates:", err);
    res.status(500).json({
      status: "error",
      message: "Failed to delete candidate interview data.",
      error: err.message,
    });
  }
});

export { saveInterview, cleanupAllInterviews };
