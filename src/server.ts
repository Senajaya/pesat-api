import "dotenv/config";
import express, { type Request, type Response, type NextFunction } from "express";
import cors, { type CorsOptions } from "cors";
import authRoutes from "../routes/auth.routes.js";
import tanamanRoutes from "../routes/tanaman.routes.js";
import keuanganRoutes from "../routes/keuangan.routes.js";

const app = express();

const normalizeOrigin = (url: string) => url.trim().replace(/\/+$/, "");

const envOrigins = (process.env.CORS_ORIGIN || "")
  .split(",")
  .map(normalizeOrigin)
  .filter(Boolean);

const allowedOrigins = Array.from(
  new Set([
    "https://pesat-psi.vercel.app",
    "http://localhost:5173",
    "http://localhost:3000",
    ...envOrigins,
  ])
);

const corsOptions: CorsOptions = {
  origin: (origin, callback) => {
    if (!origin) {
      return callback(null, true);
    }
    const cleanOrigin = normalizeOrigin(origin);
    if (allowedOrigins.includes(cleanOrigin)) {
      return callback(null, true);
    }
    const corsError = new Error(`Origin ${origin} ditolak oleh kebijakan CORS`) as Error & {
      statusCode?: number;
    };
    corsError.statusCode = 403;
    return callback(corsError);
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};

app.use(cors(corsOptions));
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));

app.get("/", (_req: Request, res: Response) => {
  res.status(200).json({ status: "ok", app: "PESAT GO! API" });
});

app.get("/api/health", (_req: Request, res: Response) => {
  res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
});

app.use("/api/auth", authRoutes);
app.use("/api/tanaman", tanamanRoutes);
app.use("/api/keuangan", keuanganRoutes);

app.use((_req: Request, res: Response) => {
  res.status(404).json({ message: "Endpoint tidak ditemukan" });
});

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

if (!process.env.VERCEL) {
  const PORT = Number(process.env.PORT) || 4000;
  app.listen(PORT, () => {
    console.log(`Server PESAT GO! berjalan di http://localhost:${PORT}`);
  });
}

export default app;