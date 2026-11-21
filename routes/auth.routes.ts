import { Router, type Request, type Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { prisma } from "../src/lib/prisma";
import { requireAuth, type AuthRequest } from "../src/middleware/requireAuth";

const router = Router();

const registerSchema = z.object({
  nama: z.string().trim().min(2, "Nama minimal 2 karakter"),
  email: z.string().trim().email("Format email tidak valid"),
  password: z.string().min(6, "Password minimal 6 karakter"),
});

const loginSchema = z.object({
  email: z.string().trim().email("Format email tidak valid"),
  password: z.string().min(1, "Password wajib diisi"),
});

function getAccessSecret(): string | null {
  return process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET || null;
}

// POST /api/auth/register
router.post("/register", async (req: Request, res: Response) => {
  try {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        message: "Data pendaftaran tidak valid",
        errors: parsed.error.flatten().fieldErrors,
      });
    }

    const secret = getAccessSecret();
    if (!secret) {
      return res.status(500).json({
        message: "Konfigurasi JWT_ACCESS_SECRET belum diatur.",
      });
    }

    const normalizedEmail = parsed.data.email.toLowerCase();

    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true },
    });

    if (existingUser) {
      return res.status(409).json({
        message: "Email sudah terdaftar. Silakan masuk ke akun Anda.",
      });
    }

    const passwordHash = await bcrypt.hash(parsed.data.password, 10);

    const user = await prisma.user.create({
      data: {
        nama: parsed.data.nama,
        email: normalizedEmail,
        passwordHash,
      },
      select: {
        id: true,
        nama: true,
        email: true,
        createdAt: true,
      },
    });

    const accessToken = jwt.sign(
      { userId: user.id, email: user.email },
      secret,
      { expiresIn: "7d" }
    );

    return res.status(201).json({
      message: "Pendaftaran akun berhasil",
      accessToken,
      user,
    });
  } catch (err) {
    console.error("Register error:", err);
    return res.status(500).json({
      message: "Terjadi kesalahan saat mendaftarkan akun.",
    });
  }
});

// POST /api/auth/login
router.post("/login", async (req: Request, res: Response) => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        message: "Data login tidak valid",
        errors: parsed.error.flatten().fieldErrors,
      });
    }

    const secret = getAccessSecret();
    if (!secret) {
      return res.status(500).json({
        message: "Konfigurasi JWT_ACCESS_SECRET belum diatur.",
      });
    }

    const normalizedEmail = parsed.data.email.toLowerCase();

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user) {
      return res.status(401).json({
        message: "Email atau password salah.",
      });
    }

    const isPasswordValid = await bcrypt.compare(
      parsed.data.password,
      user.passwordHash
    );

    if (!isPasswordValid) {
      return res.status(401).json({
        message: "Email atau password salah.",
      });
    }

    const accessToken = jwt.sign(
      { userId: user.id, email: user.email },
      secret,
      { expiresIn: "7d" }
    );

    return res.json({
      message: "Login berhasil",
      accessToken,
      user: {
        id: user.id,
        nama: user.nama,
        email: user.email,
        createdAt: user.createdAt,
      },
    });
  } catch (err) {
    console.error("Login error:", err);
    return res.status(500).json({
      message: "Terjadi kesalahan saat proses login.",
    });
  }
});

// GET /api/auth/me
router.get("/me", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ message: "Tidak terautentikasi." });
    }

    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: {
        id: true,
        nama: true,
        email: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      return res.status(404).json({ message: "Pengguna tidak ditemukan." });
    }

    return res.json({ user });
  } catch (err) {
    console.error("Get me error:", err);
    return res.status(500).json({
      message: "Gagal memuat profil pengguna.",
    });
  }
});

export default router;