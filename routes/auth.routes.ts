import { Router, type Request, type Response } from "express";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { requireAuth, type AuthRequest } from "../src/middleware/requireAuth";

const router = Router();

const loginSchema = z.object({
  email: z.string().email("Format email tidak valid"),
  password: z.string().min(6, "Password minimal 6 karakter"),
});

// POST /api/auth/login
router.post("/login", (req: Request, res: Response) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      message: "Data login tidak valid",
      errors: parsed.error.flatten().fieldErrors,
    });
  }

  const secret = process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET;
  if (!secret) {
    return res.status(500).json({
      message: "Konfigurasi JWT_ACCESS_SECRET belum diatur.",
    });
  }

  // TODO: Ganti bagian ini dengan verifikasi user & password dari database (Prisma + bcrypt)
  const payload = {
    userId: "user-demo-id",
    email: parsed.data.email,
  };

  const accessToken = jwt.sign(payload, secret, { expiresIn: "7d" });

  return res.json({
    message: "Login berhasil",
    accessToken,
    user: payload,
  });
});

// GET /api/auth/me
router.get("/me", requireAuth, (req: AuthRequest, res: Response) => {
  return res.json({
    userId: req.userId,
    role: req.userRole ?? "USER",
  });
});

export default router;