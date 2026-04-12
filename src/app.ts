import express from "express";
import cors from "cors";
import authRoutes from "./routes/auth.routes";
import problemRoutes from "./routes/problem.routes";
import battleRoutes from "./routes/battle.routes";
import submissionRoutes from "./routes/submission.routes";
import { errorHandler, notFound } from "./middleware/errorHandler";

const app = express();


app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);


app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));


app.get("/health", (_req, res) => {
  res.status(200).json({
    success: true,
    message: "Coding Battle API is running",
    timestamp: new Date().toISOString(),
  });
});


app.use("/api/auth", authRoutes);
app.use("/api/problems", problemRoutes);
app.use("/api/battles", battleRoutes);
app.use("/api/submissions", submissionRoutes);


app.use(notFound);
app.use(errorHandler);

export default app;