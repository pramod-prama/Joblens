import exppress from "express";
import { generateQuestionsFromJD } from "../controllers/questionCtrl.js";
import { isLoggedIin } from "../middleware/isLoggedIn.js";

const questionRoute = exppress.Router();

questionRoute.get("/generate-questions", isLoggedIin, generateQuestionsFromJD);

export default questionRoute;
