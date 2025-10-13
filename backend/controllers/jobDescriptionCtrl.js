import asyncHandler from "express-async-handler";
import JobDescription from "../model/jobDescription.js";
import fs from "fs/promises";

// @desc Create or Update Job Description
// @route POST /api/v1/jobDescription/jd
// @access Private/Admin
export const createOrUpdateJobDescriptionCtrl = asyncHandler(
  async (req, res) => {
    const description = req.body?.description || null;
    const pdfFile = req.file ? req.file.path : null;

    if (!description && !pdfFile) {
      res.status(400);
      throw new Error("Job description text or file is required");
    }

    // 🔹 Check if an existing JD already exists
    const existingJD = await JobDescription.findOne().sort({ createdAt: -1 });

    if (existingJD) {
      // 🔸 Update existing JD
      if (description) existingJD.description = description;
      if (pdfFile) {
        // If a new file is uploaded, delete the old one
        if (existingJD.pdfFile && existingJD.pdfFile !== pdfFile) {
          try {
            await fs.unlink(existingJD.pdfFile);
          } catch (err) {
            console.warn("⚠️ Could not delete old JD file:", err.message);
          }
        }
        existingJD.pdfFile = pdfFile;
      }

      await existingJD.save();

      res.status(200).json({
        status: "success",
        message: "Job description updated successfully",
        jobDes: existingJD,
      });
    } else {
      // 🔹 No JD exists, create a new one
      const jobDes = await JobDescription.create({
        description,
        pdfFile,
      });

      res.status(201).json({
        status: "success",
        message: "Job description created successfully",
        jobDes,
      });
    }
  }
);

// @desc Get All Job Descriptions (with pagination)
// @route GET /api/v1/jobDescription
// @access Public
export const getJobDescriptionsCtrl = asyncHandler(async (req, res) => {
  let jobDescriptionQuery = JobDescription.find();

  // Pagination
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const startIndex = (page - 1) * limit;
  const endIndex = page * limit;
  const total = await JobDescription.countDocuments();

  jobDescriptionQuery = jobDescriptionQuery.skip(startIndex).limit(limit);

  const jobDescriptions = await jobDescriptionQuery;
  const pagination = {};

  if (endIndex < total) pagination.next = { page: page + 1, limit };
  if (startIndex > 0) pagination.prev = { page: page - 1, limit };

  res.json({
    status: "Success",
    total,
    result: jobDescriptions.length,
    pagination,
    message: "Job descriptions fetched successfully",
    jobDescriptions,
  });
});

// @desc Delete all job descriptions and .txt JD files (only if JD exists)
// @route DELETE /api/v1/jobDescription/cleanup
// @access Private/Admin
export const cleanupAllJobDescriptionsCtrl = asyncHandler(async (req, res) => {
  // 1️⃣ Check if any Job Descriptions exist in DB
  const jdCount = await JobDescription.countDocuments();

  if (jdCount === 0) {
    return res.status(200).json({
      status: "success",
      message: "No Job Descriptions found — cleanup skipped.",
    });
  }

  const uploadFolder = path.join("uploads");

  try {
    // 2️⃣ Delete all .txt files in uploads/
    const files = await fs.readdir(uploadFolder);
    let deletedFiles = 0;

    for (const file of files) {
      const filePath = path.join(uploadFolder, file);
      const ext = path.extname(file).toLowerCase();

      if (ext === ".txt") {
        try {
          await fs.unlink(filePath);
          deletedFiles++;
          console.log(`🗑️ Deleted JD file: ${filePath}`);
        } catch (err) {
          console.warn(`⚠️ Could not delete ${filePath}: ${err.message}`);
        }
      }
    }

    // 3️⃣ Delete all JobDescription records from MongoDB
    const dbResult = await JobDescription.deleteMany({});

    res.status(200).json({
      status: "success",
      message: "All job descriptions and .txt files deleted successfully.",
      deletedTxtFiles: deletedFiles,
      deletedDbRecords: dbResult.deletedCount,
    });
  } catch (err) {
    console.error("❌ Error cleaning up job descriptions:", err);
    res.status(500).json({
      status: "error",
      message: "Failed to clean up job descriptions.",
      error: err.message,
    });
  }
});
