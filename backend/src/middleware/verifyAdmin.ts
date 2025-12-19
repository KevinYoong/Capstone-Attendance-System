import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

/**
 * Express Middleware: verifyAdmin
 * * Protects routes that require Administrator privileges.
 * 1. Checks for the presence of the 'Authorization' header.
 * 2. Extracts and verifies the JWT token.
 * 3. Confirms the user's role is strictly 'admin'.
 * * @param req - Express Request object
 * @param res - Express Response object
 * @param next - Express NextFunction to proceed to the route handler
 */
export function verifyAdmin(req: Request, res: Response, next: NextFunction) {
  // 1. Retrieve the Authorization header
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({ 
      success: false, 
      error: "Access Denied: Missing Authorization header" 
    });
  }

  // 2. Extract the token (Expected format: "Bearer <token>")
  const token = authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ 
      success: false, 
      error: "Access Denied: Invalid Authorization format" 
    });
  }

  try {
    // 3. Verify the token using the secret key
    const decoded = jwt.verify(token, process.env.JWT_SECRET!);

    // 4. Check if the decoded token contains the 'admin' role
    if (typeof decoded === "object" && decoded.role === "admin") {
      // Attach the admin info to the request object for use in the controller
      (req as any).admin = decoded; 
      
      // Proceed to the next middleware or route handler
      return next();
    }

    // If valid token but NOT admin (e.g., student/lecturer trying to access admin panel)
    return res.status(403).json({ 
      success: false, 
      error: "Forbidden: Admin privileges required" 
    });

  } catch (err) {
    // Token is invalid, expired, or tampered with
    return res.status(401).json({ 
      success: false, 
      error: "Invalid or expired session token" 
    });
  }
}