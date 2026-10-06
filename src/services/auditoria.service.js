// Servicio de bitacora/auditoria. Registra QUIEN hizo QUE, CUANDO y desde
// donde. Las notificaciones (tabla "notificaciones") quedan fuera de esto
// a proposito: son un aviso efimero para el usuario, no un hecho de
// negocio que deba auditarse.
import { query } from '../config/db.js';

/**
 * @param {object} datos
 * @param {string|null} datos.usuarioId
 * @param {string} datos.accion - ej: 'login', 'asigno_chat', 'respondio_mensaje'
 * @param {string} datos.entidadTipo - ej: 'conversacion', 'usuario'
 * @param {string|null} datos.entidadId
 * @param {object} [datos.detalles]
 * @param {string} [datos.ipOrigen]
 */
export async function registrarAuditoria({
  usuarioId,
  accion,
  entidadTipo,
  entidadId,
  detalles = {},
  ipOrigen = null,
}) {
  await query(
    `INSERT INTO auditoria (usuario_id, accion, entidad_tipo, entidad_id, detalles, ip_origen)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [usuarioId, accion, entidadTipo, entidadId, JSON.stringify(detalles), ipOrigen],
  );
}
