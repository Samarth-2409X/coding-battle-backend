import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { JwtPayload } from "../types";

export const protect = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  try {
    
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      res.status(401).json({
        success: false,
        message: "Access denied. No token provided.",
      });
      return;
    }

    const token = authHeader.split(" ")[1];

    
    const secret = process.env.JWT_SECRET;
    if (!secret) throw new Error("JWT_SECRET not configured");

    const decoded = jwt.verify(token, secret) as JwtPayload;

   
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


export const generateToken = (payload: JwtPayload): string => {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET not configured");

  const expiresIn = (process.env.JWT_EXPIRES_IN || "7d") as any;
  return jwt.sign(payload, secret, { expiresIn });
};