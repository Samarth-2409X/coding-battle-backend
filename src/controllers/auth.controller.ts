import { Request, Response } from "express";
import { z } from "zod";
import User from "../models/User";
import { generateToken } from "../middleware/auth";

// ─── Zod Schemas ──────────────────────────────────────────────
export const registerSchema = z.object({
  username: z
    .string()
    .min(3, "Username must be at least 3 characters")
    .max(20, "Username cannot exceed 20 characters")
    .regex(/^[a-zA-Z0-9_]+$/, "Username can only contain letters, numbers, underscores"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

// ─── POST /api/auth/register ──────────────────────────────────
export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const { username, email, password } = req.body;

    const existingUser = await User.findOne({
      $or: [{ email }, { username }],
    });

    if (existingUser) {
      res.status(400).json({
        success: false,
        message:
          existingUser.email === email
            ? "Email already registered"
            : "Username already taken",
      });
      return;
    }

    const user = await User.create({ username, email, password });

    const token = generateToken({
      userId: user._id.toString(),
      username: user.username,
      email: user.email,
    });

    res.status(201).json({
      success: true,
      message: "Account created successfully",
      data: {
        token,
        user: {
          _id: user._id,
          username: user.username,
          email: user.email,
          stats: user.stats,
          createdAt: user.createdAt,
        },
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ─── POST /api/auth/login ─────────────────────────────────────
export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    // Include password field (it's hidden by default via select: false)
    const user = await User.findOne({ email }).select("+password");

    if (!user || !(await user.comparePassword(password))) {
      res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
      return;
    }

    const token = generateToken({
      userId: user._id.toString(),
      username: user.username,
      email: user.email,
    });

    res.status(200).json({
      success: true,
      message: "Login successful",
      data: {
        token,
        user: {
          _id: user._id,
          username: user.username,
          email: user.email,
          stats: user.stats,
          createdAt: user.createdAt,
        },
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ─── GET /api/auth/me ─────────────────────────────────────────
export const getMe = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await User.findById(req.user?.userId);

    if (!user) {
      res.status(404).json({ success: false, message: "User not found" });
      return;
    }

    res.status(200).json({
      success: true,
      data: { user },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ─── GET /api/auth/leaderboard ────────────────────────────────
export const getLeaderboard = async (_req: Request, res: Response): Promise<void> => {
  try {
    const users = await User.find()
      .select("username stats avatar")
      .sort({ "stats.rating": -1 })
      .limit(20);

    res.status(200).json({
      success: true,
      data: { users },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};