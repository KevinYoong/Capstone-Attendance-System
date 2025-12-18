import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

export function verifyAdmin(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({ success: false, error: "Missing Authorization header" });
  }

  const token = authHeader.split(" ")[1]; // "Bearer <token>"

  if (!token) {
    return res.status(401).json({ success: false, error: "Invalid Authorization header format" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!);

    // decoded should contain { id, role }
    if (typeof decoded === "object" && decoded.role === "admin") {
      (req as any).admin = decoded; // attach decoded admin to request
      return next();
    }

    return res.status(403).json({ success: false, error: "Admin access required" });

  } catch (err) {
    return res.status(401).json({ success: false, error: "Invalid or expired token" });
  }
}