import { Request, Response } from "express";
import { z } from "zod";
import Submission from "../models/Submission";
import Problem from "../models/Problem";
import { runAgainstTestCases, LANGUAGE_IDS } from "../services/judge.service";

// ─── Zod Schema ───────────────────────────────────────────────
export const submitCodeSchema = z.object({
  problemId: z.string().min(1, "Problem ID required"),
  code: z.string().min(1, "Code cannot be empty"),
  language: z.enum(["javascript", "python", "cpp", "java"]),
  battleRoomId: z.string().optional(),
});

// ─── POST /api/submissions ────────────────────────────────────
export const submitCode = async (req: Request, res: Response): Promise<void> => {
  try {
    const { problemId, code, language, battleRoomId } = req.body;

    // 1. Find problem with ALL test cases (including hidden)
    const problem = await Problem.findById(problemId);
    if (!problem) {
      res.status(404).json({ success: false, message: "Problem not found" });
      return;
    }

    const languageId = LANGUAGE_IDS[language];
    if (!languageId) {
      res.status(400).json({ success: false, message: "Unsupported language" });
      return;
    }

    // 2. Create submission record as pending
    const submission = await Submission.create({
      userId: req.user?.userId,
      problemId,
      battleRoomId,
      code,
      language,
      languageId,
      status: "pending",
      totalTestCases: problem.testCases.length,
    });

    // 3. Run against all test cases via Judge0
    const { testResults, passedTestCases, status, executionTime } =
      await runAgainstTestCases(code, languageId, problem.testCases);

    // 4. Update submission with results
    submission.status = status;
    submission.testResults = testResults;
    submission.passedTestCases = passedTestCases;
    submission.executionTime = executionTime;
    await submission.save();

    res.status(200).json({
      success: true,
      data: {
        submission: {
          _id: submission._id,
          status,
          passedTestCases,
          totalTestCases: problem.testCases.length,
          executionTime,
          testResults: testResults.filter((t) => !problem.testCases[t.testCaseIndex]?.isHidden),
        },
      },
    });
  } catch (error) {
    console.error("Submission error:", error);
    res.status(500).json({ success: false, message: "Submission failed" });
  }
};

// ─── GET /api/submissions/my ──────────────────────────────────
export const getMySubmissions = async (req: Request, res: Response): Promise<void> => {
  try {
    const { problemId } = req.query;
    const filter: Record<string, unknown> = { userId: req.user?.userId };
    if (problemId) filter.problemId = problemId;

    const submissions = await Submission.find(filter)
      .populate("problemId", "title difficulty")
      .select("-code -testResults") // lightweight for list view
      .sort({ createdAt: -1 })
      .limit(50);

    res.status(200).json({ success: true, data: { submissions } });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ─── GET /api/submissions/:id ─────────────────────────────────
export const getSubmissionById = async (req: Request, res: Response): Promise<void> => {
  try {
    const submission = await Submission.findOne({
      _id: req.params.id,
      userId: req.user?.userId,
    }).populate("problemId", "title difficulty");

    if (!submission) {
      res.status(404).json({ success: false, message: "Submission not found" });
      return;
    }

    res.status(200).json({ success: true, data: { submission } });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};