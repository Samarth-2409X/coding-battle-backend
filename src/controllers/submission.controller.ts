import { Request, Response } from "express";
import { z } from "zod";
import Submission from "../models/Submission";
import Problem from "../models/Problem";
import { runAgainstTestCases, LANGUAGE_IDS } from "../services/judge.service";
import { LanguageId } from "../types";


export const submitCodeSchema = z.object({
  problemId: z.string().min(1, "Problem ID required"),
  code: z.string().min(1, "Code cannot be empty"),
  language: z.enum(["javascript", "python", "cpp", "java"]),
  battleRoomId: z.string().optional(),
});


export const submitCode = async (req: Request, res: Response): Promise<void> => {
  try {
    const { problemId, code, language, battleRoomId } = req.body;

    
    const problem = await Problem.findById(problemId);
    if (!problem) {
      res.status(404).json({ success: false, message: "Problem not found" });
      return;
    }

    
    const languageId = LANGUAGE_IDS[language] as LanguageId;
    if (!languageId) {
      res.status(400).json({ success: false, message: "Unsupported language" });
      return;
    }

    
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

    
    const { testResults, passedTestCases, status, executionTime } =
      await runAgainstTestCases(code, languageId, problem.testCases);

    
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


export const getMySubmissions = async (req: Request, res: Response): Promise<void> => {
  try {
    const { problemId } = req.query;
    const filter: Record<string, unknown> = { userId: req.user?.userId };
    if (problemId) filter.problemId = problemId;

    const submissions = await Submission.find(filter)
      .populate("problemId", "title difficulty")
      .select("-code -testResults") 
      .sort({ createdAt: -1 })
      .limit(50);

    res.status(200).json({ success: true, data: { submissions } });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};


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