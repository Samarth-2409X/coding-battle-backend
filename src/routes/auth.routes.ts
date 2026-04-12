import { Router } from "express";
import { register, login, getMe, getLeaderboard, registerSchema, loginSchema } from "../controllers/auth.controller";
import { protect } from "../middleware/auth";
import { validate } from "../middleware/validate";

const router = Router();


router.post("/register", validate(registerSchema), register);
router.post("/login", validate(loginSchema), login);
router.get("/leaderboard", getLeaderboard);


router.get("/me", protect, getMe);

export default router;