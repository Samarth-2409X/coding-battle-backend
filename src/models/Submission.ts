import mongoose, { Schema } from "mongoose";
import { ISubmission } from "../types";

const testResultSchema = new Schema(
  {
    testCaseIndex: { type: Number, required: true },
    passed: { type: Boolean, required: true },
    input: { type: String, required: true },
    expectedOutput: { type: String, required: true },
    actualOutput: { type: String, required: true },
    executionTime: { type: Number },
  },
  { _id: false }
);

const submissionSchema = new Schema<ISubmission>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    problemId: {
      type: Schema.Types.ObjectId,
      ref: "Problem",
      required: true,
    },
    battleRoomId: {
      type: Schema.Types.ObjectId,
      ref: "BattleRoom",
    },
    code: {
      type: String,
      required: true,
    },
    language: {
      type: String,
      required: true,
      enum: ["javascript", "python", "cpp", "java"],
    },
    languageId: {
      type: Number,
      required: true,
    },
    status: {
      type: String,
      enum: [
        "pending",
        "accepted",
        "wrong_answer",
        "time_limit_exceeded",
        "runtime_error",
        "compilation_error",
      ],
      default: "pending",
    },
    testResults: [testResultSchema],
    passedTestCases: { type: Number, default: 0 },
    totalTestCases: { type: Number, default: 0 },
    executionTime: { type: Number },
    memoryUsed: { type: Number },
  },
  {
    timestamps: true,
  }
);

// ─── Indexes for leaderboard / user history ───────────────────
submissionSchema.index({ userId: 1, createdAt: -1 });
submissionSchema.index({ problemId: 1, status: 1 });
submissionSchema.index({ battleRoomId: 1 });

const Submission = mongoose.model<ISubmission>("Submission", submissionSchema);
export default Submission;