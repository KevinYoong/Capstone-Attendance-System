import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

/**
 * JWT Payload interface for type safety
 */
interface JwtPayload {
  id: number;
  role: string;
  iat?: number;
  exp?: number;
}

/**
 * Middleware to verify JWT token and ensure admin role
 *
 * Expected header format: Authorization: Bearer <token>
 *
 * Status codes:
 * - 401: Missing token, invalid token format, or expired/invalid token
 * - 403: Token valid but user is not admin
 * - 500: Server configuration error (missing JWT_SECRET)
 */
export function verifyAdmin(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Extract Authorization header
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    res.status(401).json({
      success: false,
      message: "Authorization header is required"
    });
    return;
  }

  // Validate Bearer token format
  const parts = authHeader.split(" ");
  if (parts.length !== 2 || parts[0] !== "Bearer") {
    res.status(401).json({
      success: false,
      message: "Invalid authorization format. Expected: Bearer <token>"
    });
    return;
  }

  const token = parts[1];

  // Validate JWT_SECRET is configured
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    console.error("JWT_SECRET is not configured in environment variables");
    res.status(500).json({
      success: false,
      message: "Server configuration error"
    });
    return;
  }

  try {
    // Verify and decode token
    const decoded = jwt.verify(token, jwtSecret);

    // Validate payload structure and admin role
    if (
      typeof decoded === "object" &&
      decoded !== null &&
      "role" in decoded &&
      decoded.role === "admin"
    ) {
      // Attach admin info to request for downstream handlers
      (req as any).admin = decoded as JwtPayload;
      next();
      return;
    }

    // Token valid but not admin role
    res.status(403).json({
      success: false,
      message: "Admin access required"
    });
    return;

  } catch (error) {
    // Token verification failed (expired, invalid signature, malformed, etc.)
    if (error instanceof jwt.JsonWebTokenError) {
      res.status(401).json({
        success: false,
        message: "Invalid or expired token"
      });
      return;
    }

    // Unexpected error
    console.error("Token verification error:", error);
    res.status(500).json({
      success: false,
      message: "Authentication error"
    });
    return;
  }
}
