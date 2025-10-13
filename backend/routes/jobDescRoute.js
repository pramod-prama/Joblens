import exppress from "express";

import {
  cleanupAllJobDescriptionsCtrl,
  createOrUpdateJobDescriptionCtrl,
  getJobDescriptionsCtrl,
} from "../controllers/jobDescriptionCtrl.js";
import { isLoggedIin } from "../middleware/isLoggedIn.js";
import { upload } from "../middleware/upload.js";

const jobDescRoutes = exppress.Router();

// private URL with file upload
jobDescRoutes.post(
  "/jd",
  isLoggedIin, // authentication middleware
  upload.single("file"), // multer file upload
  createOrUpdateJobDescriptionCtrl
);
jobDescRoutes.get("/jd", isLoggedIin, getJobDescriptionsCtrl);
jobDescRoutes.delete("/deleteAll", isLoggedIin, cleanupAllJobDescriptionsCtrl); // 👈 new DELETE route

export default jobDescRoutes;
