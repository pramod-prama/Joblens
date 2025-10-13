import asyncHandler from "express-async-handler";
import JobDescription from "../model/jobDescription.js";
import CVUpload from "../model/Cv.js";
import Candidate from "../model/candidate.js";
import path from "path";
import fs from "fs/promises";
import { readPdfFromPath, readTxtFromPath } from "../utils/readPdf.js";
import {
  buildKeywordExtractPrompt,
  callOllamaGenerate,
  safeParseJSON,
} from "../utils/ollama.js";

// ------------------------------
// Utility: Extract JD skills using Ollama
// ------------------------------
async function extractSkillsFromJDWithOllama(jdText) {
  const prompt = buildKeywordExtractPrompt(jdText);
  const raw = await callOllamaGenerate(prompt);
  const parsed = safeParseJSON(raw);
  if (parsed && Array.isArray(parsed.skills)) {
    return parsed.skills.map((s) => s.toLowerCase().trim());
  }
  return [];
}

// ------------------------------
// Utility: Extract candidate details
// ------------------------------
const extractCandidateDetails = (text, fileName) => {
  const emailMatch = text.match(/[\w.-]+@[\w.-]+\.\w+/);
  const phoneMatch = text.match(
    /(\+?\d{1,4}[\s-]?\(?\d{1,4}\)?[\s-]?\d{3,4}[\s-]?\d{3,4})/
  );

  let name = "";
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  for (let line of lines) {
    if (
      !line.includes("@") &&
      !/\d{4,}/.test(line) &&
      line.split(" ").length <= 5
    ) {
      name = line.replace(/[^a-zA-Z\s]/g, "");
      break;
    }
  }

  if (!name) name = path.basename(fileName, path.extname(fileName));

  return {
    name,
    email: emailMatch ? emailMatch[0] : "",
    phone: phoneMatch ? phoneMatch[0].replace(/\s+/g, "") : "",
  };
};

// ------------------------------
// Utility: Calculate score
// ------------------------------
const STOPWORDS = new Set([
  "a",
  "an",
  "the",
  "and",
  "or",
  "of",
  "in",
  "on",
  "for",
  "with",
  "to",
  "be",
  "is",
  "are",
  "it",
  "at",
  "from",
  "as",
  "by",
  "that",
  "this",
  "if",
  "we",
  "you",
]);

const calculateScore = (cvText, jdSkills) => {
  const cvTextLower = cvText
    .toLowerCase()
    .replace(
      /\b(an|the|and|or|of|in|on|for|with|to|be|is|are|it|at|from|as|by|that|this|if|we|you)\b/g,
      ""
    )
    .replace(/[^a-z0-9+#.-]/g, " ");

  const matched = [...jdSkills].filter((s) => cvTextLower.includes(s));
  const gap = [...jdSkills].filter((s) => !cvTextLower.includes(s));

  let score = jdSkills.length ? (matched.length / jdSkills.length) * 100 : 0;
  let bonus = 0;
  let reasons = [];

  if (/bachelor|master|degree/.test(cvTextLower)) {
    bonus += 10;
    reasons.push("Degree +10");
  }

  if (/experience|\d+\s+(years|year)/.test(cvTextLower)) {
    bonus += 10;
    reasons.push("Experience +10");
  }

  score = Math.min(100, score + bonus);
  return { score, matched, gap, bonus, reasons: reasons.join("; ") };
};

// ------------------------------
// Utility: Get latest JD file (.txt) if description missing
// ------------------------------
async function getLatestJDFile() {
  const folder = path.join("uploads");
  const files = await fs.readdir(folder);
  const txtFiles = files.filter((f) => f.endsWith(".txt"));
  if (!txtFiles.length) return null;

  const stats = await Promise.all(
    txtFiles.map(async (f) => ({
      file: f,
      stat: await fs.stat(path.join(folder, f)),
    }))
  );
  stats.sort((a, b) => b.stat.mtimeMs - a.stat.mtimeMs);
  return path.join(folder, stats[0].file);
}

// ------------------------------
// Controller: Rank CVs against JD
// ------------------------------
export const rankCVsAgainstJD = asyncHandler(async (req, res) => {
  // 1️⃣ Get JD from DB
  let jdRecord = await JobDescription.findOne().sort({ createdAt: -1 });
  let jdText = jdRecord?.description || "";

  // 2️⃣ If no JD in DB, try latest .txt file
  if (!jdText) {
    const latestFile = await getLatestJDFile();
    if (!latestFile) {
      return res
        .status(400)
        .json({ status: "fail", message: "No job description found" });
    }
    try {
      jdText = await readTxtFromPath(latestFile);
    } catch (err) {
      console.error("Failed to read JD file:", latestFile, err);
      return res
        .status(500)
        .json({ status: "error", message: "Failed to read JD file" });
    }
  }

  const jdSkills = await extractSkillsFromJDWithOllama(jdText);

  // 3️⃣ Get all CVs
  const cvs = await CVUpload.find();
  if (!cvs.length)
    return res.status(404).json({ status: "fail", message: "No CVs uploaded" });

  const results = [];

  // 4️⃣ Process each CV
  for (let cv of cvs) {
    try {
      const filePath = path.join("uploads/cv", cv.filename);
      let text = "";
      try {
        text = await readPdfFromPath(filePath);
      } catch (err) {
        console.error("Failed to read PDF:", filePath, err);
        continue; // skip corrupted PDF
      }
      if (!text) continue;

      const { name, email, phone } = extractCandidateDetails(
        text,
        cv.originalName
      );
      const { score, matched, gap, bonus, reasons } = calculateScore(
        text,
        jdSkills
      );

      // 🔍 Merge emotion data
      const candidate = await Candidate.findOne({ $or: [{ email }, { name }] });
      let videoData = null;
      if (candidate) {
        videoData = {
          Status: candidate.videoInterviewStatus || "Pending",
          Happy: candidate.videoAnalysis?.happy ?? 0,
          Neutral: candidate.videoAnalysis?.neutral ?? 0,
          Sad: candidate.videoAnalysis?.sad ?? 0,
          Angry: candidate.videoAnalysis?.angry ?? 0,
          Dominant: candidate.videoAnalysis?.dominant ?? "Neutral",
        };
      }

      results.push({
        "Candidate File": cv.originalName,
        Name: name,
        Email: email,
        Phone: phone,
        Score: score,
        "Bonus Points": bonus,
        "Bonus Reasons": reasons,
        "Matched Skills": matched.join(", "),
        "Missing Skills": gap.join(", "),
        "JD Skills": [...jdSkills].join(", "),
        "Video Interview": videoData,
      });
    } catch (err) {
      console.error("Error processing CV:", cv.originalName, err);
    }
  }

  // 5️⃣ Sort by score
  results.sort((a, b) => b.Score - a.Score);

  res.status(200).json({
    status: "success",
    totalCandidates: results.length,
    message: "CVs ranked against JD (with interview data)",
    results,
  });
});
