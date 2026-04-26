import { Server, Socket } from "socket.io";
import jwt from "jsonwebtoken";
import BattleRoom from "../models/BattleRoom";
import Problem from "../models/Problem";
import User from "../models/User";
import Submission from "../models/Submission";
import { runAgainstTestCases, LANGUAGE_IDS } from "../services/judge.service";
import { JwtPayload, SubmissionStatus, LanguageId } from "../types";


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


export const initializeSocket = (io: Server): void => {

  
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

    
    socket.on("JOIN_ROOM", async ({ roomCode }: { roomCode: string }) => {
      try {
        const upperCode = roomCode.toUpperCase();
        const room = await BattleRoom.findOne({ roomCode: upperCode });

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

          
          const updated = await BattleRoom.findOneAndUpdate(
            {
              roomCode: upperCode,
              status: { $ne: "finished" },
              $expr: { $lt: [{ $size: "$players" }, "$maxPlayers"] },
              "players.userId": { $ne: user.userId },
            },
            {
              $push: {
                players: {
                  userId: user.userId as any,
                  username: user.username,
                  socketId: socket.id,
                  isReady: false,
                  submissionStatus: "pending",
                  score: 0,
                  code: "",
                  language: "javascript",
                },
              },
            },
            { new: true }
          );

          if (updated) {
            io.to(upperCode).emit("PLAYER_JOINED", {
              userId: user.userId,
              username: user.username,
            });
          }

        } else {
         
          await BattleRoom.updateOne(
            { roomCode: upperCode, "players.userId": user.userId },
            { $set: { "players.$.socketId": socket.id } }
          );
        }

        socket.join(upperCode);
        (socket as any).currentRoom = upperCode;

       
        const populatedRoom = await BattleRoom.findOne({
          roomCode: upperCode,
        }).populate(
          "problem",
          "title difficulty description examples starterCode constraints tags"
        );

        socket.emit("ROOM_UPDATED", { room: populatedRoom });

      } catch (error) {
        console.error("JOIN_ROOM error:", error);
        socket.emit("ERROR", { message: "Failed to join room" });
      }
    });

    
    socket.on("PLAYER_READY", async ({ roomCode }: { roomCode: string }) => {
      try {
        const result = await BattleRoom.findOneAndUpdate(
          {
            roomCode,
            status: "waiting",
            "players.userId": user.userId,
          },
          { $set: { "players.$.isReady": true } },
          { new: true }
        );

        if (!result) return;

        io.to(roomCode).emit("ROOM_UPDATED", { room: result });

        const allReady =
          result.players.length >= 2 &&
          result.players.every((p) => p.isReady);

        if (allReady) {
          await startCountdown(io, roomCode);
        }
      } catch (error) {
        socket.emit("ERROR", { message: "Failed to mark ready" });
      }
    });

    
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
          await BattleRoom.updateOne(
            { roomCode, "players.userId": user.userId },
            {
              $set: {
                "players.$.code": code,
                "players.$.language": language,
              },
            }
          );

         
          socket.to(roomCode).emit("OPPONENT_CODE_CHANGE", {
            userId: user.userId,
            language,
          });
        } catch (_) {
         
        }
      }
    );

    
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

          
          io.to(roomCode).emit("SUBMISSION_RESULT", {
            userId: user.userId,
            status: "pending" as SubmissionStatus,
            passedCases: 0,
            total: problem.testCases.length,
          });

          
          const { testResults, passedTestCases, status } =
            await runAgainstTestCases(code, languageId, problem.testCases);

          
          await Submission.create({
            userId: user.userId as any,
            problemId: problem._id,
            battleRoomId: room._id,
            code,
            language,
            languageId: languageId as LanguageId,
            status,
            testResults,
            passedTestCases,
            totalTestCases: problem.testCases.length,
          });

          
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

          
          io.to(roomCode).emit("SUBMISSION_RESULT", {
            userId: user.userId,
            status,
            passedCases: passedTestCases,
            total: problem.testCases.length,
          });

          
          if (status === "accepted") {
            await endBattle(io, roomCode, user.userId, user.username);
          }

        } catch (error) {
          console.error("SUBMIT_CODE error:", error);
          socket.emit("ERROR", { message: "Submission failed" });
        }
      }
    );

    
    socket.on("LEAVE_ROOM", async ({ roomCode }: { roomCode: string }) => {
      await handleLeaveRoom(io, socket, user, roomCode);
    });

    
    socket.on("disconnect", async () => {
      const roomCode = (socket as any).currentRoom;
      console.log(`🔌 User disconnected: ${user.username}, room: ${roomCode}`);

      if (roomCode) {
        
        setTimeout(async () => {
          try {
            const room = await BattleRoom.findOne({ roomCode });
            if (!room) return;

            const player = room.players.find(
              (p) => p.userId.toString() === user.userId
            );

            
            if (player && player.socketId !== socket.id) {
              console.log(`${user.username} reconnected, skipping disconnect leave`);
              return;
            }

            await handleLeaveRoom(io, socket, user, roomCode);
          } catch (err) {
            console.error("disconnect timeout error:", err);
          }
        }, 3000);
      }
    });
  });
};


const startCountdown = async (io: Server, roomCode: string): Promise<void> => {
  
  const flipped = await BattleRoom.findOneAndUpdate(
    { roomCode, status: "waiting" },
    { $set: { status: "countdown" } }
  );

  if (!flipped) return; 

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


const startBattle = async (io: Server, roomCode: string): Promise<void> => {
  try {
    const room = await BattleRoom.findOne({ roomCode });
    if (!room) return;

    
    const count = await Problem.countDocuments({ isActive: true });
    if (count === 0) {
      io.to(roomCode).emit("ERROR", { message: "No problems available. Please add problems first." });
      return;
    }

    const random = Math.floor(Math.random() * count);
    const problem = await Problem.findOne({ isActive: true }).skip(random);

    if (!problem) {
      io.to(roomCode).emit("ERROR", { message: "No problems available" });
      return;
    }

    
    await BattleRoom.updateOne(
      { roomCode },
      {
        $set: {
          status: "active",
          problem: problem._id,
          startedAt: new Date(),
        },
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


const endBattle = async (
  io: Server,
  roomCode: string,
  winnerId: string,
  winnerUsername: string
): Promise<void> => {
  try {
    const finished = await BattleRoom.findOneAndUpdate(
      { roomCode, status: "active" },
      {
        $set: {
          status: "finished",
          finishedAt: new Date(),
          winnerId,
        },
      },
      { new: true }
    );

    if (!finished) return;

    
    for (const player of finished.players) {
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

    io.to(roomCode).emit("BATTLE_FINISHED", { winnerId, winnerUsername });

  } catch (error) {
    console.error("endBattle error:", error);
  }
};


const forceEndBattle = async (io: Server, roomCode: string): Promise<void> => {
  try {
    const room = await BattleRoom.findOne({ roomCode });
    if (!room || room.status !== "active") return;

   
    const sorted = [...room.players].sort((a, b) => b.score - a.score);
    const winner = sorted[0];

    const finished = await BattleRoom.findOneAndUpdate(
      { roomCode, status: "active" },
      {
        $set: {
          status: "finished",
          finishedAt: new Date(),
          winnerId: winner?.userId,
        },
      },
      { new: true }
    );

    if (!finished) return;

    io.to(roomCode).emit("BATTLE_FINISHED", {
      winnerId: winner?.userId?.toString() || "",
      winnerUsername: winner?.username || "Nobody",
    });

  } catch (error) {
    console.error("forceEndBattle error:", error);
  }
};


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

    
    if (room.status === "active") {
      await BattleRoom.updateOne(
        { roomCode, "players.userId": user.userId },
        { $set: { "players.$.socketId": "" } }
      );
      io.to(roomCode).emit("PLAYER_LEFT", {
        userId: user.userId,
        username: user.username,
      });
      return;
    }

    const updated = await BattleRoom.findOneAndUpdate(
      { roomCode, status: { $ne: "finished" } },
      { $pull: { players: { userId: user.userId } } },
      { new: true }
    );

    if (!updated) return;

    if (updated.players.length === 0) {
      
      setTimeout(async () => {
        const checkRoom = await BattleRoom.findOne({ roomCode });
        if (
          checkRoom &&
          checkRoom.players.length === 0 &&
          checkRoom.status === "waiting"
        ) {
          await BattleRoom.deleteOne({ roomCode });
          console.log(`🗑 Room ${roomCode} deleted after 2 min timeout`);
        }
      }, 2 * 60 * 1000);

    } else {
      io.to(roomCode).emit("PLAYER_LEFT", {
        userId: user.userId,
        username: user.username,
      });
      io.to(roomCode).emit("ROOM_UPDATED", { room: updated });
    }

  } catch (error) {
    console.error("handleLeaveRoom error:", error);
  }
};