import { Server, Socket } from "socket.io";
import jwt from "jsonwebtoken";
import BattleRoom from "../models/BattleRoom";
import Problem from "../models/Problem";
import User from "../models/User";
import Submission from "../models/Submission";
import { runAgainstTestCases, LANGUAGE_IDS } from "../services/judge.service";
import { JwtPayload, SubmissionStatus } from "../types";

// ─── Authenticate socket via JWT in handshake ─────────────────
const authenticateSocket = (socket: Socket): JwtPayload | null => {
  try {
    const token =
      socket.handshake.auth?.token ||
      socket.handshake.headers?.authorization?.split(" ")[1];

    if (!token) return null;

    const secret = process.env.JWT_SECRET!;
    return jwt.verify(token, secret) as JwtPayload;
  } catch {
    return null;
  }
};

// ─── Main socket handler ──────────────────────────────────────
export const initializeSocket = (io: Server): void => {
  // ── Auth middleware for every socket connection ──
  io.use((socket, next) => {
    const user = authenticateSocket(socket);
    if (!user) {
      return next(new Error("Authentication failed"));
    }
    (socket as any).user = user;
    next();
  });

  io.on("connection", (socket: Socket) => {
    const user = (socket as any).user as JwtPayload;
    console.log(`🔌 User connected: ${user.username} (${socket.id})`);

    // ── JOIN ROOM ──────────────────────────────────
    socket.on("JOIN_ROOM", async ({ roomCode }: { roomCode: string }) => {
      try {
        const room = await BattleRoom.findOne({ roomCode: roomCode.toUpperCase() });

        if (!room) {
          socket.emit("ERROR", { message: "Room not found" });
          return;
        }

        if (room.status === "finished") {
          socket.emit("ERROR", { message: "This battle has already ended" });
          return;
        }

        const alreadyInRoom = room.players.find(
          (p) => p.userId.toString() === user.userId
        );

        if (!alreadyInRoom) {
          if (room.players.length >= room.maxPlayers) {
            socket.emit("ERROR", { message: "Room is full" });
            return;
          }

          // Add player to room
          room.players.push({
            userId: user.userId as any,
            username: user.username,
            socketId: socket.id,
            isReady: false,
            submissionStatus: "pending",
            score: 0,
            code: "",
            language: "javascript",
          });

          await room.save();

          // Notify all players in room
          io.to(roomCode).emit("PLAYER_JOINED", {
            userId: user.userId,
            username: user.username,
          });
        } else {
          // Reconnecting — update socket ID
          alreadyInRoom.socketId = socket.id;
          await room.save();
        }

        socket.join(roomCode);
        (socket as any).currentRoom = roomCode;

        // Send updated room state to joining player
        const populatedRoom = await BattleRoom.findOne({ roomCode })
          .populate("problem", "title difficulty description examples starterCode constraints");

        socket.emit("ROOM_UPDATED", { room: populatedRoom });

      } catch (error) {
        console.error("JOIN_ROOM error:", error);
        socket.emit("ERROR", { message: "Failed to join room" });
      }
    });

    // ── PLAYER READY ───────────────────────────────
    socket.on("PLAYER_READY", async ({ roomCode }: { roomCode: string }) => {
      try {
        const room = await BattleRoom.findOne({ roomCode });
        if (!room || room.status !== "waiting") return;

        const player = room.players.find(
          (p) => p.userId.toString() === user.userId
        );
        if (player) {
          player.isReady = true;
          await room.save();
        }

        io.to(roomCode).emit("ROOM_UPDATED", { room });

        // Check if all players are ready (min 2 players)
        const allReady =
          room.players.length >= 2 &&
          room.players.every((p) => p.isReady);

        if (allReady) {
          await startCountdown(io, roomCode);
        }
      } catch (error) {
        socket.emit("ERROR", { message: "Failed to mark ready" });
      }
    });

    // ── CODE CHANGE (live broadcast to opponent) ───
    socket.on(
      "CODE_CHANGE",
      async ({
        roomCode,
        code,
        language,
      }: {
        roomCode: string;
        code: string;
        language: string;
      }) => {
        try {
          // Save latest code to DB (for reconnect recovery)
          await BattleRoom.updateOne(
            { roomCode, "players.userId": user.userId },
            {
              $set: {
                "players.$.code": code,
                "players.$.language": language,
              },
            }
          );

          // Broadcast to everyone else in the room (not the sender)
          socket.to(roomCode).emit("OPPONENT_CODE_CHANGE", {
            userId: user.userId,
            language,
          });
        } catch (error) {
          // Silently fail — code change is high-frequency, don't block UI
        }
      }
    );

    // ── SUBMIT CODE ────────────────────────────────
    socket.on(
      "SUBMIT_CODE",
      async ({
        roomCode,
        code,
        language,
        languageId,
      }: {
        roomCode: string;
        code: string;
        language: string;
        languageId: number;
      }) => {
        try {
          const room = await BattleRoom.findOne({ roomCode }).populate("problem");
          if (!room || room.status !== "active") {
            socket.emit("ERROR", { message: "Battle is not active" });
            return;
          }

          const problem = room.problem as any;
          if (!problem) {
            socket.emit("ERROR", { message: "Problem not found" });
            return;
          }

          // Notify room that this player submitted
          io.to(roomCode).emit("SUBMISSION_RESULT", {
            userId: user.userId,
            status: "pending" as SubmissionStatus,
            passedCases: 0,
            total: problem.testCases.length,
          });

          // Run against test cases
          const { testResults, passedTestCases, status } =
            await runAgainstTestCases(code, languageId, problem.testCases);

          // Save submission to DB
          await Submission.create({
            userId: user.userId,
            problemId: problem._id,
            battleRoomId: room._id,
            code,
            language,
            languageId,
            status,
            testResults,
            passedTestCases,
            totalTestCases: problem.testCases.length,
          });

          // Update player status in room
          await BattleRoom.updateOne(
            { roomCode, "players.userId": user.userId },
            {
              $set: {
                "players.$.submissionStatus":
                  status === "accepted" ? "accepted" : "wrong_answer",
                "players.$.submittedAt": new Date(),
                "players.$.score": passedTestCases,
              },
            }
          );

          // Broadcast result to room
          io.to(roomCode).emit("SUBMISSION_RESULT", {
            userId: user.userId,
            status,
            passedCases: passedTestCases,
            total: problem.testCases.length,
          });

          // If accepted → end battle
          if (status === "accepted") {
            await endBattle(io, roomCode, user.userId, user.username);
          }

        } catch (error) {
          console.error("SUBMIT_CODE error:", error);
          socket.emit("ERROR", { message: "Submission failed" });
        }
      }
    );

    // ── LEAVE ROOM ─────────────────────────────────
    socket.on("LEAVE_ROOM", async ({ roomCode }: { roomCode: string }) => {
      await handleLeaveRoom(io, socket, user, roomCode);
    });

    // ── DISCONNECT ─────────────────────────────────
    socket.on("disconnect", async () => {
      const roomCode = (socket as any).currentRoom;
      if (roomCode) {
        await handleLeaveRoom(io, socket, user, roomCode);
      }
      console.log(`🔌 User disconnected: ${user.username}`);
    });
  });
};

// ─── Helper: countdown then start battle ─────────────────────
const startCountdown = async (io: Server, roomCode: string): Promise<void> => {
  await BattleRoom.updateOne({ roomCode }, { status: "countdown" });

  let seconds = 5;
  const interval = setInterval(async () => {
    io.to(roomCode).emit("COUNTDOWN", { seconds });
    seconds--;

    if (seconds < 0) {
      clearInterval(interval);
      await startBattle(io, roomCode);
    }
  }, 1000);
};

// ─── Helper: start the actual battle ─────────────────────────
const startBattle = async (io: Server, roomCode: string): Promise<void> => {
  try {
    const room = await BattleRoom.findOne({ roomCode });
    if (!room) return;

    // Pick a random active problem
    const count = await Problem.countDocuments({ isActive: true });
    const random = Math.floor(Math.random() * count);
    const problem = await Problem.findOne({ isActive: true }).skip(random);

    if (!problem) {
      io.to(roomCode).emit("ERROR", { message: "No problems available" });
      return;
    }

    await BattleRoom.updateOne(
      { roomCode },
      {
        status: "active",
        problem: problem._id,
        startedAt: new Date(),
      }
    );

    io.to(roomCode).emit("BATTLE_STARTED", {
      problem: {
        _id: problem._id,
        title: problem.title,
        description: problem.description,
        difficulty: problem.difficulty,
        examples: problem.examples,
        starterCode: problem.starterCode,
        constraints: problem.constraints,
        tags: problem.tags,
      },
      timeLimit: room.timeLimit,
    });

    // Set a server-side timer to end battle when time runs out
    setTimeout(async () => {
      const currentRoom = await BattleRoom.findOne({ roomCode });
      if (currentRoom && currentRoom.status === "active") {
        await forceEndBattle(io, roomCode);
      }
    }, room.timeLimit * 60 * 1000);

  } catch (error) {
    console.error("startBattle error:", error);
  }
};

// ─── Helper: end battle with a winner ────────────────────────
const endBattle = async (
  io: Server,
  roomCode: string,
  winnerId: string,
  winnerUsername: string
): Promise<void> => {
  try {
    await BattleRoom.updateOne(
      { roomCode },
      {
        status: "finished",
        finishedAt: new Date(),
        winnerId,
      }
    );

    // Update winner/loser stats
    const room = await BattleRoom.findOne({ roomCode });
    if (room) {
      for (const player of room.players) {
        const isWinner = player.userId.toString() === winnerId;
        await User.updateOne(
          { _id: player.userId },
          {
            $inc: {
              "stats.totalBattles": 1,
              "stats.wins": isWinner ? 1 : 0,
              "stats.losses": isWinner ? 0 : 1,
              "stats.rating": isWinner ? 25 : -15,
            },
          }
        );
      }
    }

    io.to(roomCode).emit("BATTLE_FINISHED", { winnerId, winnerUsername });
  } catch (error) {
    console.error("endBattle error:", error);
  }
};

// ─── Helper: force-end battle on time expiry ─────────────────
const forceEndBattle = async (io: Server, roomCode: string): Promise<void> => {
  try {
    const room = await BattleRoom.findOne({ roomCode });
    if (!room) return;

    // Find player with highest score
    const sorted = [...room.players].sort((a, b) => b.score - a.score);
    const winner = sorted[0];

    await BattleRoom.updateOne(
      { roomCode },
      { status: "finished", finishedAt: new Date(), winnerId: winner?.userId }
    );

    io.to(roomCode).emit("BATTLE_FINISHED", {
      winnerId: winner?.userId?.toString() || "",
      winnerUsername: winner?.username || "Nobody",
    });
  } catch (error) {
    console.error("forceEndBattle error:", error);
  }
};

// ─── Helper: leave room logic ─────────────────────────────────
const handleLeaveRoom = async (
  io: Server,
  socket: Socket,
  user: JwtPayload,
  roomCode: string
): Promise<void> => {
  try {
    socket.leave(roomCode);

    const room = await BattleRoom.findOne({ roomCode });
    if (!room || room.status === "finished") return;

    // Remove player from room
    room.players = room.players.filter(
      (p) => p.userId.toString() !== user.userId
    );

    if (room.players.length === 0) {
      // Empty room — delete it
      await BattleRoom.deleteOne({ roomCode });
    } else {
      await room.save();
      io.to(roomCode).emit("PLAYER_LEFT", {
        userId: user.userId,
        username: user.username,
      });
      io.to(roomCode).emit("ROOM_UPDATED", { room });
    }
  } catch (error) {
    console.error("handleLeaveRoom error:", error);
  }
};