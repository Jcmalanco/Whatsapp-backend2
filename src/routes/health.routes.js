// Health-check para monitoreo (Render / balanceadores / uptime checks).
import { Router } from 'express';
import { pool } from '../config/db.js';

const router = Router();

router.get('/', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ ok: true, estado: 'saludable', baseDeDatos: 'conectada', timestamp: new Date().toISOString() });
  } catch (err) {
    res.status(503).json({ ok: false, estado: 'con problemas', error: err.message });
  }
});

export default router;
