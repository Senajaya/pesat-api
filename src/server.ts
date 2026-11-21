import "dotenv/config";
import express, { type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import authRoutes from "../routes/auth.routes.js";
import tanamanRoutes from "../routes/tanaman.routes.js";
import keuanganRoutes from "../routes/keuangan.routes.js";

const app = express();

// Konfigurasi CORS agar frontend di Vercel diizinkan mengakses API
const allowedOrigins = (process.env.CORS_ORIGIN || "https://pesat-psi.vercel.app")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // Izinkan request tanpa origin (seperti health check / server-to-server)
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      const corsError = new Error("Akses ditolak oleh kebijakan CORS") as Error & {
        statusCode?: number;
      };
      corsError.statusCode = 403;
      return callback(corsError);
    },
    credentials: true,
  })
);

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));

// Endpoint dasar & health check
app.get("/", (_req: Request, res: Response) => {
  res.status(200).json({
    status: "ok",
    app: "PESAT GO! API",
  });
});

app.get("/api/health", (_req: Request, res: Response) => {
  res.status(200).json({
    status: "ok",
    timestamp: new Date().toISOString(),
  });
});

// Routes utama aplikasi
app.use("/api/auth", authRoutes);
app.use("/api/tanaman", tanamanRoutes);
app.use("/api/keuangan", keuanganRoutes);

// Handler jika rute tidak ditemukan (404)
app.use((_req: Request, res: Response) => {
  res.status(404).json({
    message: "Endpoint tidak ditemukan",
  });
});

// Handler error terpusat
app.use(
  (
    err: Error & { statusCode?: number; status?: number },
    _req: Request,
    res: Response,
    _next: NextFunction
  ) => {
    const statusCode = err.statusCode || err.status || 500;
    if (statusCode >= 500) {
      console.error("Server Error:", err);
    }
    res.status(statusCode).json({
      message:
        statusCode >= 500 && process.env.NODE_ENV === "production"
          ? "Terjadi kesalahan pada server"
          : err.message || "Terjadi kesalahan pada server",
    });
  }
);

// Jalankan listener hanya saat bukan di lingkungan Vercel Serverless
if (!process.env.VERCEL) {
  const PORT = Number(process.env.PORT) || 4000;
  app.listen(PORT, () => {
    console.log(`Server PESAT GO! berjalan di http://localhost:${PORT}`);
  });
}

export default app;