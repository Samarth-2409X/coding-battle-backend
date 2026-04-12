import { Router } from "express";
import {
  submitCode,
  getMySubmissions,
  getSubmissionById,
  submitCodeSchema,
} from "../controllers/submission.controller";
import { protect } from "../middleware/auth";
import { validate } from "../middleware/validate";

const router = Router();


router.use(protect);

router.post("/", validate(submitCodeSchema), submitCode);
router.get("/my", getMySubmissions);
router.get("/:id", getSubmissionById);

export default router;