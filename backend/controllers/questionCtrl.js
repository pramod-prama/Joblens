import asyncHandler from "express-async-handler";
import JobDescription from "../model/jobDescription.js";
import { readTxtFromPath } from "../utils/readPdf.js"; // or your readPdf util
import { callOllamaGenerate, safeParseJSON } from "../utils/ollama.js";
import { buildQuestionPrompt } from "../utils/questionPrompt.js"; // We'll create this

// Generate interview questions from JD
export const generateQuestionsFromJD = asyncHandler(async (req, res) => {
  // 1. Get latest JD
  const jdRecord = await JobDescription.findOne().sort({ createdAt: -1 });
  if (!jdRecord)
    return res.status(404).json({ message: "No job description found" });

  let jdText = jdRecord.description || "";
  if (!jdText && jdRecord?.pdfFile) {
    jdText = await readTxtFromPath(jdRecord.pdfFile);
  }

  if (!jdText) return res.status(400).json({ message: "JD content is empty" });

  // 2. Build prompt and call Ollama
  const prompt = buildQuestionPrompt(jdText);
  const raw = await callOllamaGenerate(prompt);
  const parsed = safeParseJSON(raw, { questions: [] });

  // 3. Return questions
  res.status(200).json({
    status: "success",
    totalQuestions: parsed.questions.length,
    questions: parsed.questions,
  });
});
