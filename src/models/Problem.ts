import mongoose, { Schema } from "mongoose";
import { IProblem } from "../types";

const testCaseSchema = new Schema(
  {
    input: { type: String, required: true },
    expectedOutput: { type: String, required: true },
    isHidden: { type: Boolean, default: false },
  },
  { _id: false }
);

const exampleSchema = new Schema(
  {
    input: { type: String, required: true },
    output: { type: String, required: true },
    explanation: { type: String },
  },
  { _id: false }
);

const problemSchema = new Schema<IProblem>(
  {
    title: {
      type: String,
      required: [true, "Problem title is required"],
      unique: true,
      trim: true,
      maxlength: [100, "Title cannot exceed 100 characters"],
    },
    description: {
      type: String,
      required: [true, "Problem description is required"],
    },
    difficulty: {
      type: String,
      enum: ["easy", "medium", "hard"],
      required: [true, "Difficulty is required"],
    },
    tags: [{ type: String, trim: true }],
    testCases: {
      type: [testCaseSchema],
      required: true,
      validate: {
        validator: (v: unknown[]) => v.length >= 1,
        message: "At least one test case is required",
      },
    },
    starterCode: {
      javascript: { type: String, default: "// Write your solution here\nfunction solution() {\n\n}" },
      python: { type: String, default: "# Write your solution here\ndef solution():\n    pass" },
      cpp: { type: String, default: "// Write your solution here\n#include<bits/stdc++.h>\nusing namespace std;\n\nint main() {\n    return 0;\n}" },
      java: { type: String, default: "// Write your solution here\npublic class Solution {\n    public static void main(String[] args) {\n        \n    }\n}" },
    },
    constraints: {
      type: String,
      default: "",
    },
    examples: [exampleSchema],
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// ─── Index for fast filtering ─────────────────────────────────
problemSchema.index({ difficulty: 1, isActive: 1 });
problemSchema.index({ tags: 1 });

const Problem = mongoose.model<IProblem>("Problem", problemSchema);
export default Problem;