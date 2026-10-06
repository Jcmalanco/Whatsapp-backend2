import { asyncHandler } from '../utils/asyncHandler.js';
import { query } from '../config/db.js';

export const listarNotificaciones = asyncHandler(async (req, res) => {
  const { rows } = await query(
    `SELECT * FROM notificaciones WHERE usuario_id = $1 ORDER BY creado_en DESC LIMIT 50`,
    [req.usuario.id],
  );
  res.json({ ok: true, notificaciones: rows });
});

export const marcarNotificacionLeida = asyncHandler(async (req, res) => {
  const { id } = req.params;
  await query('UPDATE notificaciones SET leido = true WHERE id = $1 AND usuario_id = $2', [
    id,
    req.usuario.id,
  ]);
  res.json({ ok: true });
});
