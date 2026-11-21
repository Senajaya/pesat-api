import authRoutes from "./routes/auth.routes.js";
import tanamanRoutes from "./routes/tanaman.routes.js";
import keuanganRoutes from "./routes/keuangan.routes.js";

// ...
app.use("/api/auth", authRoutes);
app.use("/api/tanaman", tanamanRoutes);
app.use("/api/keuangan", keuanganRoutes);