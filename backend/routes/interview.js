import exppress from "express";
import {
  cleanupAllInterviews,
  saveInterview,
} from "../controllers/interviewCtr.js";
import { isLoggedIin } from "../middleware/isLoggedIn.js";

const interviewRoutes = exppress.Router();

interviewRoutes.post("/save", isLoggedIin, saveInterview);
interviewRoutes.delete("/emotion-cleanup", isLoggedIin, cleanupAllInterviews); // ✅ new route

export default interviewRoutes;
