// CRUD de usuarios. Solo accesible por admin (ver routes/usuarios.routes.js).
// Nunca se borra un usuario fisicamente (para no romper el historial de
// conversaciones/mensajes que lo referencian); se desactiva (activo=false).
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import { query } from '../config/db.js';
import { hashearPassword } from '../services/auth.service.js';
import { registrarAuditoria } from '../services/auditoria.service.js';
import { env } from '../config/env.js';

export const listarUsuarios = asyncHandler(async (req, res) => {
  const { rows } = await query(
    `SELECT id, nombre, email, rol, activo, estatus_actividad, max_chats_simultaneos, creado_en
     FROM usuarios ORDER BY creado_en DESC`,
  );
  res.json({ ok: true, usuarios: rows });
});

export const crearUsuario = asyncHandler(async (req, res) => {
  const { nombre, email, password, rol, maxChatsSimultaneos } = req.body;

  const existente = await query('SELECT id FROM usuarios WHERE email = $1', [email]);
  if (existente.rows.length > 0) {
    throw new ApiError(409, 'Ya existe un usuario con ese email');
  }

  const passwordHash = await hashearPassword(password);
  const { rows } = await query(
    `INSERT INTO usuarios (nombre, email, password_hash, rol, max_chats_simultaneos)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, nombre, email, rol, activo, estatus_actividad, max_chats_simultaneos, creado_en`,
    [nombre, email, passwordHash, rol, maxChatsSimultaneos ?? env.maxChatsSimultaneosDefault],
  );

  await registrarAuditoria({
    usuarioId: req.usuario.id,
    accion: 'creo_usuario',
    entidadTipo: 'usuario',
    entidadId: rows[0].id,
    detalles: { rol },
    ipOrigen: req.ip,
  });

  res.status(201).json({ ok: true, usuario: rows[0] });
});

export const actualizarUsuario = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const campos = req.body;

  const asignaciones = [];
  const valores = [];
  let i = 1;

  for (const [clave, valor] of Object.entries({
    nombre: campos.nombre,
    rol: campos.rol,
    activo: campos.activo,
    max_chats_simultaneos: campos.maxChatsSimultaneos,
  })) {
    if (valor !== undefined) {
      asignaciones.push(`${clave} = $${i}`);
      valores.push(valor);
      i += 1;
    }
  }

  if (asignaciones.length === 0) {
    throw new ApiError(400, 'No se envio ningun campo para actualizar');
  }

  valores.push(id);
  const { rows } = await query(
    `UPDATE usuarios SET ${asignaciones.join(', ')} WHERE id = $${i}
     RETURNING id, nombre, email, rol, activo, estatus_actividad, max_chats_simultaneos`,
    valores,
  );

  if (rows.length === 0) throw new ApiError(404, 'Usuario no encontrado');

  await registrarAuditoria({
    usuarioId: req.usuario.id,
    accion: 'actualizo_usuario',
    entidadTipo: 'usuario',
    entidadId: id,
    detalles: campos,
    ipOrigen: req.ip,
  });

  res.json({ ok: true, usuario: rows[0] });
});

// El propio agente actualiza su estatus (disponible/ocupado/desconectado)
// para que el motor de asignacion automatica lo tome en cuenta.
export const actualizarMiEstatus = asyncHandler(async (req, res) => {
  const { estatusActividad } = req.body;
  await query('UPDATE usuarios SET estatus_actividad = $1 WHERE id = $2', [
    estatusActividad,
    req.usuario.id,
  ]);
  res.json({ ok: true });
});
