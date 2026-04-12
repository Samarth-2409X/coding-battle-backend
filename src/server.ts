import "dotenv/config";
import http from "http";
import { Server } from "socket.io";
import app from "./app";
import connectDB from "./config/db";
import { initializeSocket } from "./socket/battle.socket";

const PORT = process.env.PORT || 5000;


const httpServer = http.createServer(app);


const io = new Server(httpServer, {
  cors: {
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    methods: ["GET", "POST"],
    credentials: true,
  },
  pingTimeout: 60000,
  pingInterval: 25000,
});


initializeSocket(io);


const startServer = async (): Promise<void> => {
  await connectDB();

  httpServer.listen(PORT, () => {
    console.log("\n=======================================");
    console.log(`  Coding Battle Server`);
    console.log(`  Running on: http://localhost:${PORT}`);
    console.log(`  Health:     http://localhost:${PORT}/health`);
    console.log(`  Env:        ${process.env.NODE_ENV}`);
    console.log("=======================================\n");
  });
};

startServer().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});