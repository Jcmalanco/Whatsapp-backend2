// Servicio de notificaciones internas (chat asignado, mensaje nuevo,
// cola de espera). Se guardan en la tabla "notificaciones" y el
// frontend las consume via polling/Supabase Realtime. No llevan sonido
// (a peticion explicita) y no se auditan (no son un hecho de negocio).
import { query } from '../config/db.js';

/**
 * @param {string} usuarioId - destinatario de la notificacion
 * @param {'chat_asignado'|'mensaje_nuevo'|'cola_espera'} tipo
 * @param {string|null} referenciaId
 */
export async function crearNotificacion(usuarioId, tipo, referenciaId = null) {
  await query(
    `INSERT INTO notificaciones (usuario_id, tipo, referencia_id)
     VALUES ($1, $2, $3)`,
    [usuarioId, tipo, referenciaId],
  );
}

/**
 * Notifica a TODOS los supervisores (no al admin, para no saturarlo)
 * cuando un chat entra a cola de espera por falta de agentes disponibles.
 */
export async function notificarSupervisoresColaEspera(conversacionId) {
  const { rows: supervisores } = await query(
    `SELECT id FROM usuarios WHERE rol = 'supervisor' AND activo = true`,
  );
  await Promise.all(
    supervisores.map((s) => crearNotificacion(s.id, 'cola_espera', conversacionId)),
  );
}
