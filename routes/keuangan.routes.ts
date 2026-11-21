import { Router } from "express";
import { z } from "zod";
import { JenisTransaksi, StatusTanaman } from "@prisma/client";
import { prisma } from "../src/lib/prisma";
import { requireAuth, AuthRequest } from "../src/middleware/requireAuth";

const router = Router();

router.use(requireAuth);

const createTransaksiSchema = z.object({
  jenis: z.nativeEnum(JenisTransaksi),
  kategori: z.string().trim().min(2, "Kategori wajib diisi").max(80),
  nominal: z.coerce.number().positive("Nominal harus lebih dari 0").max(1_000_000_000),
  tanggal: z.coerce.date(),
  keterangan: z.string().trim().max(300).optional().nullable(),
});

const updateTransaksiSchema = z.object({
  jenis: z.nativeEnum(JenisTransaksi),
  kategori: z.string().trim().min(2, "Kategori wajib diisi").max(80),
  nominal: z.coerce.number().positive("Nominal harus lebih dari 0").max(1_000_000_000),
  tanggal: z.coerce.date(),
  keterangan: z.string().trim().max(300).optional().nullable(),
});

// GET /api/keuangan?jenis=PEMASUKAN|PENGELUARAN
router.get("/", async (req: AuthRequest, res) => {
  const rawJenis = typeof req.query.jenis === "string" ? req.query.jenis : undefined;
  const jenisFilter =
    rawJenis && Object.values(JenisTransaksi).includes(rawJenis as JenisTransaksi)
      ? (rawJenis as JenisTransaksi)
      : undefined;

  const transaksi = await prisma.transaksi.findMany({
    where: {
      userId: req.userId!,
      ...(jenisFilter ? { jenis: jenisFilter } : {}),
    },
    orderBy: [{ tanggal: "desc" }, { createdAt: "desc" }],
  });

  return res.json({ data: transaksi });
});

// GET /api/keuangan/summary (Saldo bersih + ringkasan status tanaman)
router.get("/summary", async (req: AuthRequest, res) => {
  const userId = req.userId!;

  const [pemasukanAgg, pengeluaranAgg, countsByStatus] = await Promise.all([
    prisma.transaksi.aggregate({
      where: { userId, jenis: JenisTransaksi.PEMASUKAN },
      _sum: { nominal: true },
    }),
    prisma.transaksi.aggregate({
      where: { userId, jenis: JenisTransaksi.PENGELUARAN },
      _sum: { nominal: true },
    }),
    prisma.tanaman.groupBy({
      by: ["status"],
      where: { userId },
      _count: { _all: true },
    }),
  ]);

  const totalPemasukan = Number(pemasukanAgg._sum.nominal ?? 0);
  const totalPengeluaran = Number(pengeluaranAgg._sum.nominal ?? 0);
  const saldoBersih = totalPemasukan - totalPengeluaran;

  const statusMap: Record<StatusTanaman, number> = {
    DITANAM: 0,
    BELUM_PANEN: 0,
    SUDAH_PANEN: 0,
  };

  for (const row of countsByStatus) {
    const statusKey = row.status as StatusTanaman;
    if (statusKey in statusMap) {
      statusMap[statusKey] = row._count._all;
    }
  }

  return res.json({
    keuangan: {
      totalPemasukan,
      totalPengeluaran,
      saldoBersih,
    },
    tanaman: statusMap,
  });
});

// POST /api/keuangan
router.post("/", async (req: AuthRequest, res) => {
  const parsed = createTransaksiSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      message: "Data transaksi tidak valid",
      errors: parsed.error.flatten().fieldErrors,
    });
  }

  const created = await prisma.transaksi.create({
    data: {
      userId: req.userId!,
      jenis: parsed.data.jenis,
      kategori: parsed.data.kategori,
      nominal: parsed.data.nominal,
      tanggal: parsed.data.tanggal,
      keterangan: parsed.data.keterangan || null,
    },
  });

  return res.status(201).json({ data: created });
});

// PATCH /api/keuangan/:id (Edit transaksi)
router.patch("/:id", async (req: AuthRequest, res) => {
  const parsed = updateTransaksiSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      message: "Data edit transaksi tidak valid",
      errors: parsed.error.flatten().fieldErrors,
    });
  }

  const id = String(req.params.id);
  const existing = await prisma.transaksi.findFirst({
    where: { id, userId: req.userId! },
  });
  if (!existing) {
    return res.status(404).json({ message: "Data transaksi tidak ditemukan." });
  }

  const updated = await prisma.transaksi.update({
    where: { id: existing.id },
    data: {
      jenis: parsed.data.jenis,
      kategori: parsed.data.kategori,
      nominal: parsed.data.nominal,
      tanggal: parsed.data.tanggal,
      keterangan: parsed.data.keterangan || null,
    },
  });

  return res.json({ data: updated });
});

// DELETE /api/keuangan/:id
router.delete("/:id", async (req: AuthRequest, res) => {
  const id = String(req.params.id);
  const existing = await prisma.transaksi.findFirst({
    where: { id, userId: req.userId! },
  });
  if (!existing) {
    return res.status(404).json({ message: "Data transaksi tidak ditemukan." });
  }

  await prisma.transaksi.delete({ where: { id: existing.id } });
  return res.json({ message: "Transaksi berhasil dihapus." });
});

export default router;