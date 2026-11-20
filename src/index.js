const express = require('express');
const cors = require('cors');
const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

const app = express();
const prisma = new PrismaClient();

app.use(cors());
app.use(express.json());

// Cek status server & koneksi database
app.get('/api/health', async (req, res) => {
  try {
    const totalItems = await prisma.item.count();
    res.json({ status: 'ok', app: 'pesat', totalItems });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// Ambil semua item
app.get('/api/items', async (req, res) => {
  try {
    const items = await prisma.item.findMany({
      orderBy: { createdAt: 'desc' },
    });
    res.json(items);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Tambah item baru
app.post('/api/items', async (req, res) => {
  try {
    const { title, description } = req.body;
    if (!title || !title.trim()) {
      return res.status(400).json({ error: 'Title wajib diisi' });
    }
    const item = await prisma.item.create({
      data: {
        title: title.trim(),
        description: description ? description.trim() : null,
      },
    });
    res.status(201).json(item);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Update item (status completed / title / description)
app.put('/api/items/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { title, description, completed } = req.body;
    const item = await prisma.item.update({
      where: { id },
      data: {
        ...(title !== undefined && { title }),
        ...(description !== undefined && { description }),
        ...(completed !== undefined && { completed }),
      },
    });
    res.json(item);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Hapus item
app.delete('/api/items/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    await prisma.item.delete({ where: { id } });
    res.json({ message: 'Item berhasil dihapus', id });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 5000;
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server PESAT berjalan di http://localhost:${PORT}`);
  });
}

module.exports = app;