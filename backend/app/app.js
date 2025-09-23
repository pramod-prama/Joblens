// backend/server.js
import express from "express";
import cors from "cors";
import multer from "multer";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";
dotenv.config();
import { google } from "googleapis";
import { fileURLToPath } from "url";
import { dirname } from "path";
import { getOAuthDrive } from "./driveAuth.js"; // keep as in your project
import dbConnect from "../config/dbConnect.js";
import { globalErrhandler, notFound } from "../middleware/globalErrHandler.js";

// Your existing route modules
import userRoutes from "../routes/userRoute.js";
import jobDescRoutes from "../routes/jobDescRoute.js";
import cvRoutes from "../routes/cvRoute.js";
import scoreRoute from "../routes/cvRankingRoute.js";

// ------------------------------
// Mount your existing routes
// ------------------------------
import numberRoute from "../routes/numberRoute.js";

// dbConnect
dbConnect();

// __dirname replacement for ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
app.use(cors());
// middleware - pass incoming data
app.use(express.json());

// routes
app.use("/api/v1/users", userRoutes);
app.use("/api/v1/jobDesc", jobDescRoutes);
app.use("/api/v1/cv", cvRoutes);
app.use("/api/v1/score", scoreRoute);
app.use("/api/v1/ats", numberRoute);

// =====================================================================
// 🔽🔽🔽  O L L A M A   H E L P E R S   (for dynamic questions)  🔽🔽🔽
// =====================================================================

/**
 * Build a strict JSON-only prompt so Ollama returns parseable output.
 */
function buildOllamaPrompt({
  resumeText = "",
  jobDescription = "",
  matchedSkills = [],
  numQuestions = 8,
}) {
  const kwLine = matchedSkills?.length
    ? `Focus keywords: ${matchedSkills.join(", ")}`
    : "Focus keywords: (not provided)";
  const n = Math.min(Math.max(parseInt(numQuestions || 8, 10), 3), 20);

  return `You are an interview question generator for HR screening and technical rounds.
Use the candidate CV and the Job Description to propose ${n} diverse, specific, non-redundant, and role-aligned questions.
Mix types: technical, behavioral, situational, and screening.
For each question, include:
- "question": the question text
- "type": one of ["technical","behavioral","situational","screening"]
- "focus": 1-3 short keywords/skills
- "why": 1 sentence rationale

${kwLine}

=== CV ===
${resumeText || "(none)"}

=== JOB DESCRIPTION ===
${jobDescription || "(none)"}

Return ONLY valid JSON of the form:
{ "questions": [ { "question": "...", "type": "...", "focus": ["..."], "why":"..." }, ... ] }`;
}

/**
 * Call local Ollama /api/generate
 * Requires: `ollama serve` and a pulled model (e.g., `ollama pull llama3.1:8b`)
 * Node 18+ has global fetch. If on older Node, install node-fetch and import it.
 */
async function callOllamaGenerate(prompt) {
  const base = process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434";
  const model = process.env.OLLAMA_MODEL || "llama3.1:8b";
  const temperature = parseFloat(process.env.DYNQ_TEMPERATURE || "0.35");
  const maxTokens = parseInt(process.env.DYNQ_MAX_TOKENS || "700", 10);

  const res = await fetch(`${base}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      prompt,
      options: { temperature, num_predict: maxTokens },
      stream: false,
    }),
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Ollama error ${res.status}: ${txt}`);
  }
  const data = await res.json(); // { response: "...", ... }
  return data.response || "";
}

/**
 * Safely parse JSON even if the model adds extra text around it.
 */
function safeParseJSON(text) {
  try {
    return JSON.parse(text);
  } catch {}
  const s = text.indexOf("{");
  const e = text.lastIndexOf("}");
  if (s !== -1 && e !== -1 && e > s) {
    try {
      return JSON.parse(text.slice(s, e + 1));
    } catch {}
  }
  return null;
}

// Optional health check for questions service
app.get("/api/v1/questions/health", (_req, res) => {
  res.json({
    ok: true,
    model: process.env.OLLAMA_MODEL || "llama3.1:8b",
    base: process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434",
  });
});

// =====================================================================
// ✅ Ollama-powered dynamic questions endpoint (returns string[] for Interview.tsx)
// =====================================================================
// POST /api/v1/questions/generate
// Body: { resumeText?: string, jobDescription?: string, matchedSkills?: string[], numQuestions?: number }
app.post("/api/v1/questions/generate", async (req, res) => {
  try {
    const {
      resumeText = "",
      jobDescription = "",
      matchedSkills = [],
      numQuestions = 8,
    } = req.body || {};

    if (!resumeText && !jobDescription) {
      return res.status(400).json({
        ok: false,
        error: "Provide at least resumeText or jobDescription",
      });
    }

    // Build prompt + call Ollama
    const prompt = buildOllamaPrompt({
      resumeText,
      jobDescription,
      matchedSkills,
      numQuestions,
    });

    const raw = await callOllamaGenerate(prompt);

    // ---- Try several ways to extract questions into a string[] ----
    const stringsFromParsedJSON = (() => {
      const parsed = safeParseJSON(raw);
      if (parsed && Array.isArray(parsed.questions)) {
        return parsed.questions
          .map((q) => (typeof q === "string" ? q : q?.question))
          .filter((s) => typeof s === "string" && s.trim().length > 0);
      }
      return null;
    })();

    // Try to extract from a fenced ```json code block if present
    const stringsFromCodeFence = (() => {
      const m =
        raw.match(/```json([\s\S]*?)```/i) || raw.match(/```([\s\S]*?)```/);
      if (!m) return null;
      const parsed = safeParseJSON(m[1]);
      if (parsed && Array.isArray(parsed.questions)) {
        return parsed.questions
          .map((q) => (typeof q === "string" ? q : q?.question))
          .filter((s) => typeof s === "string" && s.trim().length > 0);
      }
      return null;
    })();

    // Heuristic: pull question-like lines if JSON failed
    const stringsFromHeuristic = (() => {
      const lines = raw.split(/\r?\n/).map((l) => l.trim());
      const candidates = lines
        .map((l) => l.replace(/^[-*]\s+/, "").replace(/^\d+\.\s+/, "")) // strip bullets/numbers
        .filter((s) => s.length >= 8 && /[?]$/.test(s)); // keep lines that end with '?'
      const uniq = Array.from(new Set(candidates)).filter(
        (s) => s.trim().length > 0
      );
      return uniq.length ? uniq : null;
    })();

    const strings =
      stringsFromParsedJSON ||
      stringsFromCodeFence ||
      stringsFromHeuristic ||
      [];

    if (!strings.length) {
      return res.status(502).json({
        ok: false,
        error: "Could not parse dynamic questions from model output",
        raw, // helpful for debugging
      });
    }

    // Keep to 5 for your UI
    const limited = strings.slice(0, 5);

    return res.json({
      ok: true,
      questions: limited, // <-- string[]
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message || "failed" });
  }
});

// ------------------------------
// Error middleware (keep as-is)
// ------------------------------
app.use(notFound);
app.use(globalErrhandler);

// --- Ensure candidate folder in Drive ---
async function ensureCandidateFolder(drive, parentFolderId, nameRaw, emailRaw) {
  const safe = (s) =>
    (s || "")
      .trim()
      .replace(/[^\w.@-]+/g, "_")
      .slice(0, 80);
  const folderName =
    `${safe(nameRaw)}_${safe(emailRaw)}` || "Unknown_Candidate";

  // Search for existing folder
  const q = [
    `name='${folderName.replace(/'/g, "\\'")}'`,
    `mimeType='application/vnd.google-apps.folder'`,
    `'${parentFolderId}' in parents`,
    "trashed=false",
  ].join(" and ");

  const list = await drive.files.list({
    q,
    fields: "files(id, name)",
  });

  if (list.data.files && list.data.files.length) {
    return list.data.files[0].id;
  }

  // Create if not exists
  const created = await drive.files.create({
    requestBody: {
      name: folderName,
      mimeType: "application/vnd.google-apps.folder",
      parents: [parentFolderId],
    },
    fields: "id, name",
  });
  return created.data.id;
}

// --- TEMP LOCAL SAVE DIR ---
const UPLOAD_DIR = path.join(__dirname, "uploads");
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// Optional: serve local files for debugging in browser
app.use("/uploads", express.static(UPLOAD_DIR));

// --- Multer for receiving the file ---
const storage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const safe = (file.originalname || "recording.webm").replace(
      /[^\w.\-]/g,
      "_"
    );
    cb(null, `${Date.now()}_${safe}`);
  },
});
const upload = multer({ storage });

// --- Health check ---
app.get("/health", (_, res) => res.json({ ok: true }));

// --- MAIN UPLOAD ROUTE ---
app.post("/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ ok: false, error: "No file uploaded" });
    }

    const localPath = req.file.path;
    const filename = req.file.originalname || path.basename(localPath);
    const mimeType = req.file.mimetype || "video/webm";

    const candidateName = (req.body.candidateName || "").trim();
    const candidateEmail = (req.body.candidateEmail || "").trim();
    const jobRole = (req.body.jobRole || "").trim();

    console.log("📥 /upload hit");
    console.log("   file:", filename);
    console.log("   saved:", localPath);
    console.log("   DRIVE_FOLDER_ID:", process.env.DRIVE_FOLDER_ID);
    console.log("   candidate:", candidateName, candidateEmail, jobRole);

    // Get an authenticated Drive client
    const drive = await getOAuthDrive();

    // 1) Ensure subfolder "<Name>_<Email>" under main Joblens folder
    const subFolderId = await ensureCandidateFolder(
      drive,
      process.env.DRIVE_FOLDER_ID,
      candidateName,
      candidateEmail
    );

    // 2) Upload file into that subfolder
    const created = await drive.files.create({
      requestBody: { name: filename, parents: [subFolderId] },
      media: { mimeType, body: fs.createReadStream(localPath) },
      fields: "id,name,webViewLink,webContentLink",
    });

    // Make file public (optional)
    try {
      await drive.permissions.create({
        fileId: created.data.id,
        requestBody: { role: "reader", type: "anyone" },
      });
    } catch (e) {
      console.warn("Permission set failed (non-fatal):", e.message);
    }

    // Cleanup local temp
    fs.unlink(localPath, () => {});

    return res.json({
      ok: true,
      id: created.data.id,
      name: created.data.name,
      viewLink: created.data.webViewLink,
      downloadLink: created.data.webContentLink,
      folderId: subFolderId,
    });
  } catch (e) {
    console.error("❌ Upload error:", e?.response?.data || e);
    return res
      .status(500)
      .json({ ok: false, error: e.message || "Upload failed" });
  }
});

export default app;
