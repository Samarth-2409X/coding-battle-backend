import axios from "axios";
import {
  Judge0SubmissionRequest,
  Judge0SubmissionResponse,
  Judge0ResultResponse,
  ITestCase,
  ITestResult,
  SubmissionStatus,
} from "../types";

export const LANGUAGE_IDS: Record<string, number> = {
  javascript: 63,
  python: 71,
  cpp: 54,
  java: 62,
};

const judge0Api = axios.create({
  baseURL: process.env.JUDGE0_API_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

const submitCode = async (
  payload: Judge0SubmissionRequest
): Promise<string> => {
  console.log(`Submitting to Judge0 → language_id: ${payload.language_id}, stdin: "${payload.stdin}", expected: "${payload.expected_output}"`);
  const response = await judge0Api.post<Judge0SubmissionResponse>(
    "/submissions?base64_encoded=false&wait=false",
    payload
  );
  console.log(`Judge0 token received: ${response.data.token}`);
  return response.data.token;
};

const getResult = async (token: string): Promise<Judge0ResultResponse> => {
  const maxAttempts = 10;
  const delayMs = 1500;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, delayMs));

    const response = await judge0Api.get<Judge0ResultResponse>(
      `/submissions/${token}?base64_encoded=false`
    );

    const statusId = response.data.status.id;
    console.log(`Polling attempt ${attempt + 1} → status: ${statusId} (${response.data.status.description})`);

    if (statusId !== 1 && statusId !== 2) {
      console.log(`Final result → stdout: "${response.data.stdout}" | stderr: "${response.data.stderr}" | compile: "${response.data.compile_output}"`);
      return response.data;
    }
  }

  throw new Error("Code execution timed out");
};

const mapStatus = (statusId: number): SubmissionStatus => {
  switch (statusId) {
    case 3: return "accepted";
    case 4: return "wrong_answer";
    case 5: return "time_limit_exceeded";
    case 6: return "compilation_error";
    case 7:
    case 8:
    case 9:
    case 10:
    case 11:
    case 12: return "runtime_error";
    default: return "runtime_error";
  }
};

export const runAgainstTestCases = async (
  code: string,
  languageId: number,
  testCases: ITestCase[]
): Promise<{
  testResults: ITestResult[];
  passedTestCases: number;
  status: SubmissionStatus;
  executionTime?: number;
}> => {
  const testResults: ITestResult[] = [];
  let passedTestCases = 0;
  let totalTime = 0;
  let finalStatus: SubmissionStatus = "accepted";

  for (let i = 0; i < testCases.length; i++) {
    const tc = testCases[i];

    try {
      const token = await submitCode({
        source_code: code,
        language_id: languageId,
        stdin: tc.input,
        expected_output: tc.expectedOutput,
      });

      const result = await getResult(token);
      const statusId = result.status.id;
      const passed = statusId === 3;

      if (passed) {
        passedTestCases++;
      } else {
        finalStatus = mapStatus(statusId);
      }

      if (result.time) {
        totalTime += parseFloat(result.time) * 1000;
      }

      testResults.push({
        testCaseIndex: i,
        passed,
        input: tc.input,
        expectedOutput: tc.expectedOutput,
        actualOutput: result.stdout?.trim() || result.stderr || result.compile_output || "No output",
        executionTime: result.time ? parseFloat(result.time) * 1000 : undefined,
      });

    } catch (error) {
      console.error(`Test case ${i} execution error:`, error);
      testResults.push({
        testCaseIndex: i,
        passed: false,
        input: tc.input,
        expectedOutput: tc.expectedOutput,
        actualOutput: "Execution error",
      });
      finalStatus = "runtime_error";
    }
  }

  if (passedTestCases === testCases.length) {
    finalStatus = "accepted";
  }

  return {
    testResults,
    passedTestCases,
    status: finalStatus,
    executionTime: totalTime > 0 ? totalTime : undefined,
  };
};