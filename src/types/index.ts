import { Document, Types } from "mongoose";

// ─── User Types ───────────────────────────────────────────────
export interface IUser extends Document {
  _id: Types.ObjectId;
  username: string;
  email: string;
  password: string;
  avatar?: string;
  stats: {
    totalBattles: number;
    wins: number;
    losses: number;
    rank: number;
    rating: number;
  };
  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
}

// ─── Problem Types ────────────────────────────────────────────
export type Difficulty = "easy" | "medium" | "hard";

export interface ITestCase {
  input: string;
  expectedOutput: string;
  isHidden: boolean;
}

export interface IProblem extends Document {
  _id: Types.ObjectId;
  title: string;
  description: string;
  difficulty: Difficulty;
  tags: string[];
  testCases: ITestCase[];
  starterCode: {
    javascript: string;
    python: string;
    cpp: string;
    java: string;
  };
  constraints: string;
  examples: {
    input: string;
    output: string;
    explanation?: string;
  }[];
  createdBy: Types.ObjectId;
  isActive: boolean;
  createdAt: Date;
}

// ─── Battle Room Types ────────────────────────────────────────
export type BattleStatus = "waiting" | "countdown" | "active" | "finished";
export type BattleMode = "1v1" | "tournament";

export interface IPlayer {
  userId: Types.ObjectId;
  username: string;
  socketId: string;
  isReady: boolean;
  submissionStatus: "pending" | "accepted" | "wrong_answer" | "error";
  submittedAt?: Date;
  score: number;
  code: string;
  language: string;
}

export interface IBattleRoom extends Document {
  _id: Types.ObjectId;
  roomCode: string;
  mode: BattleMode;
  status: BattleStatus;
  problem?: Types.ObjectId;
  players: IPlayer[];
  maxPlayers: number;
  timeLimit: number; // in minutes
  startedAt?: Date;
  finishedAt?: Date;
  winnerId?: Types.ObjectId;
  createdBy: Types.ObjectId;
  createdAt: Date;
}

// ─── Submission Types ─────────────────────────────────────────
export type SubmissionStatus =
  | "pending"
  | "accepted"
  | "wrong_answer"
  | "time_limit_exceeded"
  | "runtime_error"
  | "compilation_error";

export type LanguageId = 63 | 71 | 54 | 62; // JS | Python | C++ | Java

export interface ITestResult {
  testCaseIndex: number;
  passed: boolean;
  input: string;
  expectedOutput: string;
  actualOutput: string;
  executionTime?: number;
}

export interface ISubmission extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  problemId: Types.ObjectId;
  battleRoomId?: Types.ObjectId;
  code: string;
  language: string;
  languageId: LanguageId;
  status: SubmissionStatus;
  testResults: ITestResult[];
  passedTestCases: number;
  totalTestCases: number;
  executionTime?: number;
  memoryUsed?: number;
  createdAt: Date;
}

// ─── JWT Payload ──────────────────────────────────────────────
export interface JwtPayload {
  userId: string;
  username: string;
  email: string;
}

// ─── Express Request extension ────────────────────────────────
declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

// ─── Judge0 Types ─────────────────────────────────────────────
export interface Judge0SubmissionRequest {
  source_code: string;
  language_id: number;
  stdin?: string;
  expected_output?: string;
}

export interface Judge0SubmissionResponse {
  token: string;
}

export interface Judge0ResultResponse {
  stdout: string | null;
  stderr: string | null;
  compile_output: string | null;
  message: string | null;
  status: {
    id: number;
    description: string;
  };
  time: string | null;
  memory: number | null;
}

// ─── Socket Event Types ───────────────────────────────────────
export interface SocketEvents {
  // Client → Server
  JOIN_ROOM: { roomCode: string; userId: string };
  LEAVE_ROOM: { roomCode: string };
  PLAYER_READY: { roomCode: string };
  CODE_CHANGE: { roomCode: string; code: string; language: string };
  SUBMIT_CODE: { roomCode: string; code: string; language: string; languageId: number };

  // Server → Client
  ROOM_UPDATED: { room: Partial<IBattleRoom> };
  BATTLE_STARTED: { problem: Partial<IProblem>; timeLimit: number };
  OPPONENT_CODE_CHANGE: { userId: string; language: string };
  SUBMISSION_RESULT: { userId: string; status: SubmissionStatus; passedCases: number; total: number };
  BATTLE_FINISHED: { winnerId: string; winnerUsername: string };
  PLAYER_JOINED: { username: string; userId: string };
  PLAYER_LEFT: { username: string; userId: string };
  COUNTDOWN: { seconds: number };
  ERROR: { message: string };
}