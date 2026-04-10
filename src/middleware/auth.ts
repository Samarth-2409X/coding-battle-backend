import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { JwtPayload } from "../types";

export const protect = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  try {
    // 1. Get token from header
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      res.status(401).json({
        success: false,
        message: "Access denied. No token provided.",
      });
      return;
    }

    const token = authHeader.split(" ")[1];

    // 2. Verify token
    const secret = process.env.JWT_SECRET;
    if (!secret) throw new Error("JWT_SECRET not configured");

    const decoded = jwt.verify(token, secret) as JwtPayload;

    // 3. Attach user to request
    req.user = decoded;
    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      res.status(401).json({ success: false, message: "Token has expired." });
      return;
    }
    if (error instanceof jwt.JsonWebTokenError) {
      res.status(401).json({ success: false, message: "Invalid token." });
      return;
    }
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ─── Helper: generate JWT ────────────────────────────────────
export const generateToken = (payload: JwtPayload): string => {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET not configured");

  return jwt.sign(payload, secret, {
    expiresIn: (process.env.JWT_EXPIRES_IN as string) || "7d",
  });
};