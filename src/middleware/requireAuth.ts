import { type Request, type Response, type NextFunction } from "express";
import jwt from "jsonwebtoken";

export interface AuthRequest extends Request {
  userId?: string;
  userRole?: string;
}

interface JwtPayload {
  userId?: string;
  sub?: string;
  id?: string;
  role?: string;
}

export function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      message: "Token autentikasi tidak ditemukan.",
    });
  }

  const token = authHeader.slice(7).trim();
  const secret = process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET;

  if (!secret) {
    console.error("JWT_ACCESS_SECRET belum dikonfigurasi.");
    return res.status(500).json({
      message: "Konfigurasi autentikasi server belum lengkap.",
    });
  }

  try {
    const decoded = jwt.verify(token, secret) as JwtPayload | string;

    if (typeof decoded === "string") {
      req.userId = decoded;
    } else {
      req.userId = decoded.userId || decoded.sub || decoded.id;
      req.userRole = decoded.role;
    }

    if (!req.userId) {
      return res.status(401).json({
        message: "Payload token tidak valid.",
      });
    }

    return next();
  } catch {
    return res.status(401).json({
      message: "Token tidak valid atau sudah kedaluwarsa.",
    });
  }
}