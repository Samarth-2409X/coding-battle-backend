import { Request, Response } from "express";
import { z } from "zod";
import Problem from "../models/Problem";


export const createProblemSchema = z.object({
  title: z.string().min(3).max(100),
  description: z.string().min(10),
  difficulty: z.enum(["easy", "medium", "hard"]),
  tags: z.array(z.string()).optional().default([]),
  testCases: z
    .array(
      z.object({
        input: z.string(),
        expectedOutput: z.string(),
        isHidden: z.boolean().optional().default(false),
      })
    )
    .min(1, "At least one test case required"),
  starterCode: z
    .object({
      javascript: z.string().optional(),
      python: z.string().optional(),
      cpp: z.string().optional(),
      java: z.string().optional(),
    })
    .optional(),
  constraints: z.string().optional().default(""),
  examples: z
    .array(
      z.object({
        input: z.string(),
        output: z.string(),
        explanation: z.string().optional(),
      })
    )
    .optional()
    .default([]),
});


export const getProblems = async (req: Request, res: Response): Promise<void> => {
  try {
    const { difficulty, tags, page = 1, limit = 20 } = req.query;

    const filter: Record<string, unknown> = { isActive: true };
    if (difficulty) filter.difficulty = difficulty;
    if (tags) filter.tags = { $in: (tags as string).split(",") };

    const skip = (Number(page) - 1) * Number(limit);

    const [problems, total] = await Promise.all([
      Problem.find(filter)
        .select("-testCases -starterCode") 
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      Problem.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      data: {
        problems,
        pagination: {
          total,
          page: Number(page),
          pages: Math.ceil(total / Number(limit)),
        },
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};


export const getProblemById = async (req: Request, res: Response): Promise<void> => {
  try {
    const problem = await Problem.findById(req.params.id)
      .populate("createdBy", "username")
      .lean();

    if (!problem) {
      res.status(404).json({ success: false, message: "Problem not found" });
      return;
    }

    
    const sanitized = {
      ...problem,
      testCases: problem.testCases.filter((tc) => !tc.isHidden),
    };

    res.status(200).json({ success: true, data: { problem: sanitized } });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};


export const createProblem = async (req: Request, res: Response): Promise<void> => {
  try {
    const problem = await Problem.create({
      ...req.body,
      createdBy: req.user?.userId,
    });

    res.status(201).json({
      success: true,
      message: "Problem created successfully",
      data: { problem },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};


export const updateProblem = async (req: Request, res: Response): Promise<void> => {
  try {
    const problem = await Problem.findOneAndUpdate(
      { _id: req.params.id, createdBy: req.user?.userId },
      req.body,
      { new: true, runValidators: true }
    );

    if (!problem) {
      res.status(404).json({ success: false, message: "Problem not found or unauthorized" });
      return;
    }

    res.status(200).json({ success: true, data: { problem } });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};


export const deleteProblem = async (req: Request, res: Response): Promise<void> => {
  try {
    const problem = await Problem.findOneAndUpdate(
      { _id: req.params.id, createdBy: req.user?.userId },
      { isActive: false },
      { new: true }
    );

    if (!problem) {
      res.status(404).json({ success: false, message: "Problem not found or unauthorized" });
      return;
    }

    res.status(200).json({ success: true, message: "Problem deleted" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};


export const getRandomProblem = async (req: Request, res: Response): Promise<void> => {
  try {
    const { difficulty } = req.query;
    const filter: Record<string, unknown> = { isActive: true };
    if (difficulty) filter.difficulty = difficulty;

    const count = await Problem.countDocuments(filter);
    const random = Math.floor(Math.random() * count);
    const problem = await Problem.findOne(filter).skip(random);

    if (!problem) {
      res.status(404).json({ success: false, message: "No problems found" });
      return;
    }

    res.status(200).json({ success: true, data: { problem } });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};