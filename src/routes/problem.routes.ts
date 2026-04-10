import { Router } from "express";
import {
  getProblems,
  getProblemById,
  createProblem,
  updateProblem,
  deleteProblem,
  getRandomProblem,
  createProblemSchema,
} from "../controllers/problem.controller";
import { protect } from "../middleware/auth";
import { validate } from "../middleware/validate";

const router = Router();

// Public routes
router.get("/", getProblems);
router.get("/random", getRandomProblem);
router.get("/:id", getProblemById);

// Protected routes
router.post("/", protect, validate(createProblemSchema), createProblem);
router.put("/:id", protect, updateProblem);
router.delete("/:id", protect, deleteProblem);

export default router;