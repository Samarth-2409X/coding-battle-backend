import { Request, Response } from "express";
import BattleRoom from "../models/BattleRoom";
import Problem from "../models/Problem";


export const createRoom = async (req: Request, res: Response): Promise<void> => {
  try {
    const { mode = "1v1", timeLimit = 30 } = req.body;

    
    let roomCode = "";
    let isUnique = false;
    while (!isUnique) {
      const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
      roomCode = Array.from({ length: 6 }, () =>
        chars.charAt(Math.floor(Math.random() * chars.length))
      ).join("");
      const existing = await BattleRoom.findOne({ roomCode });
      if (!existing) isUnique = true;
    }

    const room = await BattleRoom.create({
      roomCode,
      mode,
      timeLimit,
      createdBy: req.user?.userId,
      players: [],
    });

    res.status(201).json({
      success: true,
      message: "Battle room created",
      data: { room },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};


export const getRoom = async (req: Request, res: Response): Promise<void> => {
  try {
    const room = await BattleRoom.findOne({
      roomCode: (req.params.roomCode as string).toUpperCase(),
    }).populate("problem", "title difficulty description examples starterCode constraints");

    if (!room) {
      res.status(404).json({ success: false, message: "Room not found" });
      return;
    }

    res.status(200).json({ success: true, data: { room } });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};


export const getActiveRooms = async (_req: Request, res: Response): Promise<void> => {
  try {
    const rooms = await BattleRoom.find({ status: "waiting" })
      .select("roomCode mode players maxPlayers timeLimit createdAt")
      .sort({ createdAt: -1 })
      .limit(20);

    res.status(200).json({ success: true, data: { rooms } });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};


export const getBattleHistory = async (req: Request, res: Response): Promise<void> => {
  try {
    const rooms = await BattleRoom.find({
      "players.userId": req.user?.userId,
      status: "finished",
    })
      .populate("problem", "title difficulty")
      .select("-players.code") 
      .sort({ finishedAt: -1 })
      .limit(20);

    res.status(200).json({ success: true, data: { rooms } });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};