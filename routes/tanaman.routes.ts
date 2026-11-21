import { Router } from "express";
import { z } from "zod";
import { Prisma, StatusTanaman } from "@prisma/client";
import { prisma } from "../src/lib/prisma";
import { requireAuth, AuthRequest } from "../src/middleware/requireAuth";

const router = Router();

// Semua endpoint tanaman wajib terautentikasi
router.use(requireAuth);

const createTanamanSchema = z.object({
  namaTanaman: z.string().trim().min(2, "Nama tanaman minimal 2 karakter").max(100),
  varietas: z.string().trim().max(100).optional().nullable(),
  tanggalTanam: z.coerce.date(),
  jumlahBibit: z.string().trim().min(1, "Jumlah bibit wajib diisi").max(50),
  modalAwal: z.coerce.number().min(0, "Modal awal tidak boleh negatif").max(1_000_000_000).default(0),
  lokasiTanam: z.string().trim().max(100).optional().nullable(),
  status: z.nativeEnum(StatusTanaman).optional(),
  fotoUrl: z.string().trim().url("URL foto tidak valid").max(500).optional().nullable(),
});

const updateTanamanSchema = z.object({
  namaTanaman: z.string().trim().min(2, "Nama tanaman minimal 2 karakter").max(100),
  varietas: z.string().trim().max(100).optional().nullable(),
  tanggalTanam: z.coerce.date(),
  jumlahBibit: z.string().trim().min(1, "Jumlah bibit wajib diisi").max(50),
  modalAwal: z.coerce.number().min(0, "Modal awal tidak boleh negatif").max(1_000_000_000).default(0),
  lokasiTanam: z.string().trim().max(100).optional().nullable(),
  status: z.nativeEnum(StatusTanaman).optional(),
  fotoUrl: z.string().trim().url("URL foto tidak valid").max(500).optional().nullable(),
});

const updateStatusSchema = z.object({
  status: z.nativeEnum(StatusTanaman),
  lokasiTanam: z.string().trim().max(100).optional().nullable(),
});

const catatPanenSchema = z.object({
  tanggalPanen: z.coerce.date(),
  jumlahHasil: z.string().trim().min(1, "Jumlah hasil panen wajib diisi").max(50),
  hasilPenjualan: z.coerce.number().min(0, "Hasil penjualan tidak boleh negatif").max(1_000_000_000).default(0),
  catatan: z.string().trim().max(300).optional().nullable(),
  tandaiSudahPanen: z.boolean().default(true),
});

// GET /api/tanaman?status=DITANAM|BELUM_PANEN|SUDAH_PANEN
router.get("/", async (req: AuthRequest, res) => {
  const rawStatus = typeof req.query.status === "string" ? req.query.status : undefined;
  const statusFilter =
    rawStatus && Object.values(StatusTanaman).includes(rawStatus as StatusTanaman)
      ? (rawStatus as StatusTanaman)
      : undefined;

  const items = await prisma.tanaman.findMany({
    where: {
      userId: req.userId!,
      ...(statusFilter ? { status: statusFilter } : {}),
    },
    include: {
      panen: {
        orderBy: { tanggalPanen: "desc" },
      },
    },
    orderBy: { tanggalTanam: "desc" },
  });

  return res.json({ data: items });
});

// GET /api/tanaman/:id
router.get("/:id", async (req: AuthRequest, res) => {
  const id = String(req.params.id);
  const tanaman = await prisma.tanaman.findFirst({
    where: { id, userId: req.userId! },
    include: {
      panen: {
        orderBy: { tanggalPanen: "desc" },
      },
    },
  });

  if (!tanaman) {
    return res.status(404).json({ message: "Data tanaman tidak ditemukan." });
  }

  return res.json({ data: tanaman });
});

// POST /api/tanaman (Register Tanaman + otomatis catat Modal Awal di Transaksi jika > 0)
router.post("/", async (req: AuthRequest, res) => {
  const parsed = createTanamanSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      message: "Data tanaman tidak valid",
      errors: parsed.error.flatten().fieldErrors,
    });
  }

  const { namaTanaman, varietas, tanggalTanam, jumlahBibit, modalAwal, lokasiTanam, status, fotoUrl } =
    parsed.data;

  const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const tanaman = await tx.tanaman.create({
      data: {
        userId: req.userId!,
        namaTanaman,
        varietas: varietas || null,
        tanggalTanam,
        jumlahBibit,
        modalAwal,
        lokasiTanam: lokasiTanam || null,
        status: status ?? StatusTanaman.DITANAM,
        fotoUrl: fotoUrl || null,
      },
    });

    if (modalAwal > 0) {
      await tx.transaksi.create({
        data: {
          userId: req.userId!,
          jenis: "PENGELUARAN",
          kategori: "Modal Awal / Bibit",
          nominal: modalAwal,
          tanggal: tanggalTanam,
          keterangan: `Modal awal tanam ${namaTanaman} (${jumlahBibit})`,
        },
      });
    }

    return tanaman;
  });

  return res.status(201).json({ data: result });
});

// PATCH /api/tanaman/:id (Edit data tanaman)
router.patch("/:id", async (req: AuthRequest, res) => {
  const parsed = updateTanamanSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      message: "Data edit tanaman tidak valid",
      errors: parsed.error.flatten().fieldErrors,
    });
  }

  const id = String(req.params.id);
  const existing = await prisma.tanaman.findFirst({
    where: { id, userId: req.userId! },
  });
  if (!existing) {
    return res.status(404).json({ message: "Data tanaman tidak ditemukan." });
  }

  const { namaTanaman, varietas, tanggalTanam, jumlahBibit, modalAwal, lokasiTanam, status, fotoUrl } =
    parsed.data;

  const updated = await prisma.tanaman.update({
    where: { id: existing.id },
    data: {
      namaTanaman,
      varietas: varietas || null,
      tanggalTanam,
      jumlahBibit,
      modalAwal,
      lokasiTanam: lokasiTanam || null,
      ...(status ? { status } : {}),
      ...(fotoUrl !== undefined ? { fotoUrl: fotoUrl || null } : {}),
    },
    include: {
      panen: {
        orderBy: { tanggalPanen: "desc" },
      },
    },
  });

  return res.json({ data: updated });
});

// PATCH /api/tanaman/:id/status
router.patch("/:id/status", async (req: AuthRequest, res) => {
  const parsed = updateStatusSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      message: "Status tidak valid",
      errors: parsed.error.flatten().fieldErrors,
    });
  }

  const id = String(req.params.id);
  const existing = await prisma.tanaman.findFirst({
    where: { id, userId: req.userId! },
  });
  if (!existing) {
    return res.status(404).json({ message: "Data tanaman tidak ditemukan." });
  }

  const updated = await prisma.tanaman.update({
    where: { id: existing.id },
    data: {
      status: parsed.data.status,
      ...(parsed.data.lokasiTanam !== undefined ? { lokasiTanam: parsed.data.lokasiTanam } : {}),
    },
  });

  return res.json({ data: updated });
});

// POST /api/tanaman/:id/panen (Catat Panen + update status tanaman + catat Pemasukan jika > 0)
router.post("/:id/panen", async (req: AuthRequest, res) => {
  const parsed = catatPanenSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      message: "Data panen tidak valid",
      errors: parsed.error.flatten().fieldErrors,
    });
  }

  const id = String(req.params.id);
  const tanaman = await prisma.tanaman.findFirst({
    where: { id, userId: req.userId! },
  });
  if (!tanaman) {
    return res.status(404).json({ message: "Data tanaman tidak ditemukan." });
  }

  const { tanggalPanen, jumlahHasil, hasilPenjualan, catatan, tandaiSudahPanen } = parsed.data;

  const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const panen = await tx.panen.create({
      data: {
        tanamanId: tanaman.id,
        tanggalPanen,
        jumlahHasil,
        hasilPenjualan,
        catatan: catatan || null,
      },
    });

    if (tandaiSudahPanen) {
      await tx.tanaman.update({
        where: { id: tanaman.id },
        data: { status: StatusTanaman.SUDAH_PANEN },
      });
    }

    if (hasilPenjualan > 0) {
      await tx.transaksi.create({
        data: {
          userId: req.userId!,
          jenis: "PEMASUKAN",
          kategori: "Penjualan Panen",
          nominal: hasilPenjualan,
          tanggal: tanggalPanen,
          keterangan: catatan || `Panen ${tanaman.namaTanaman} (${jumlahHasil})`,
        },
      });
    }

    return panen;
  });

  return res.status(201).json({ data: result });
});

// DELETE /api/tanaman/:id
router.delete("/:id", async (req: AuthRequest, res) => {
  const id = String(req.params.id);
  const existing = await prisma.tanaman.findFirst({
    where: { id, userId: req.userId! },
  });
  if (!existing) {
    return res.status(404).json({ message: "Data tanaman tidak ditemukan." });
  }

  await prisma.tanaman.delete({ where: { id: existing.id } });
  return res.json({ message: "Data tanaman berhasil dihapus." });
});

export default router;