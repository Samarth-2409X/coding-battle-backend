import mongoose, { Schema } from "mongoose";
import { IBattleRoom } from "../types";

const playerSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    username: { type: String, required: true },
    socketId: { type: String, required: true },
    isReady: { type: Boolean, default: false },
    submissionStatus: {
      type: String,
      enum: ["pending", "accepted", "wrong_answer", "error"],
      default: "pending",
    },
    submittedAt: { type: Date },
    score: { type: Number, default: 0 },
    code: { type: String, default: "" },
    language: { type: String, default: "javascript" },
  },
  { _id: false }
);

const battleRoomSchema = new Schema<IBattleRoom>(
  {
    roomCode: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      length: 6,
    },
    mode: {
      type: String,
      enum: ["1v1", "tournament"],
      default: "1v1",
    },
    status: {
      type: String,
      enum: ["waiting", "countdown", "active", "finished"],
      default: "waiting",
    },
    problem: {
      type: Schema.Types.ObjectId,
      ref: "Problem",
    },
    players: {
      type: [playerSchema],
      default: [],
    },
    maxPlayers: {
      type: Number,
      default: 2,
      min: 2,
      max: 8,
    },
    timeLimit: {
      type: Number,
      default: 30,
    },
    startedAt: { type: Date },
    finishedAt: { type: Date },
    winnerId: { type: Schema.Types.ObjectId, ref: "User" },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  {
    timestamps: true,
  }
);


battleRoomSchema.index({ finishedAt: 1 }, { expireAfterSeconds: 86400 });
battleRoomSchema.index({ status: 1, createdAt: -1 });


battleRoomSchema.statics.generateRoomCode = function (): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

const BattleRoom = mongoose.model<IBattleRoom>("BattleRoom", battleRoomSchema);
export default BattleRoom;