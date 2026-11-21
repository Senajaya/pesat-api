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
app.options("*", cors(corsOptions));