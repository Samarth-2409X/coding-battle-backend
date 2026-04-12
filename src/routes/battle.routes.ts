import { Router } from "express";
import {
  createRoom,
  getRoom,
  getActiveRooms,
  getBattleHistory,
} from "../controllers/battle.controller";
import { protect } from "../middleware/auth";

const router = Router();


router.use(protect);

router.post("/create", createRoom);
router.get("/active", getActiveRooms);
router.get("/history", getBattleHistory);
router.get("/:roomCode", getRoom);

export default router;