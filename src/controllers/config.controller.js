// Configuracion general editable por admin, ej. el limite por defecto de
// chats simultaneos por agente para la asignacion automatica.
import { asyncHandler } from '../utils/asyncHandler.js';
import { query } from '../config/db.js';
import { registrarAuditoria } from '../services/auditoria.service.js';

export const obtenerConfiguracion = asyncHandler(async (req, res) => {
  const { rows } = await query('SELECT clave, valor FROM configuracion');
  const configuracion = Object.fromEntries(rows.map((r) => [r.clave, r.valor]));
  res.json({ ok: true, configuracion });
});

export const actualizarConfiguracion = asyncHandler(async (req, res) => {
  const { clave, valor } = req.body;
  await query(
    `INSERT INTO configuracion (clave, valor) VALUES ($1, $2)
     ON CONFLICT (clave) DO UPDATE SET valor = $2`,
    [clave, JSON.stringify(valor)],
  );

  await registrarAuditoria({
    usuarioId: req.usuario.id,
    accion: 'actualizo_configuracion',
    entidadTipo: 'configuracion',
    entidadId: null,
    detalles: { clave, valor },
    ipOrigen: req.ip,
  });

  res.json({ ok: true });
});
