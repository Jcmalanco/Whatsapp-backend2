// Servicio de asignacion automatica de conversaciones a agentes,
// disenado para NO saturar a los agentes.
//
// Reglas:
// 1) Solo se consideran agentes con estatus_actividad = 'disponible'.
// 2) Cada agente tiene un limite de chats simultaneos (max_chats_simultaneos,
//    configurable por el admin, con un default global en "configuracion").
// 3) Se asigna al agente disponible con MENOS chats activos en ese momento
//    (round-robin ponderado por carga, no solo "el siguiente de la lista").
// 4) Si nadie tiene cupo disponible, la conversacion queda en estatus
//    'pendiente_asignacion' (cola de espera) y se notifica a supervisores.
// 5) Si un agente se desconecta con chats ya asignados, esos chats NO se
//    reasignan solos (para no interrumpirle el trabajo); un supervisor o
//    admin puede reasignarlos manualmente en cualquier momento.
import { query, transaccion } from '../config/db.js';
import { crearNotificacion, notificarSupervisoresColaEspera } from './notificaciones.service.js';
import { registrarAuditoria } from './auditoria.service.js';

const ESTATUS_ABIERTOS = ['abierto', 'pendiente'];

export async function asignarAutomaticamente(conversacionId) {
  return transaccion(async (client) => {
    // Se bloquean las filas de agentes candidatos para evitar condiciones
    // de carrera si llegan dos conversaciones al mismo tiempo.
    const { rows: candidatos } = await client.query(
      `SELECT u.id, u.max_chats_simultaneos,
              COUNT(c.id) FILTER (WHERE c.estatus = ANY($1)) AS chats_activos
       FROM usuarios u
       LEFT JOIN conversaciones c ON c.agente_asignado_id = u.id
       WHERE u.rol = 'agente' AND u.activo = true AND u.estatus_actividad = 'disponible'
       GROUP BY u.id, u.max_chats_simultaneos
       HAVING COUNT(c.id) FILTER (WHERE c.estatus = ANY($1)) < u.max_chats_simultaneos
       ORDER BY chats_activos ASC
       LIMIT 1
       FOR UPDATE OF u`,
      [ESTATUS_ABIERTOS],
    );

    const agente = candidatos[0];

    if (!agente) {
      await client.query(
        `UPDATE conversaciones SET estatus = 'pendiente_asignacion', actualizado_en = now() WHERE id = $1`,
        [conversacionId],
      );
      await notificarSupervisoresColaEspera(conversacionId);
      return { asignado: false };
    }

    await client.query(
      `UPDATE conversaciones
       SET agente_asignado_id = $1, estatus = 'abierto', asignado_por = 'automatico',
           asignado_por_usuario_id = NULL, actualizado_en = now()
       WHERE id = $2`,
      [agente.id, conversacionId],
    );

    await crearNotificacion(agente.id, 'chat_asignado', conversacionId);
    await registrarAuditoria({
      usuarioId: null,
      accion: 'asigno_chat_automatico',
      entidadTipo: 'conversacion',
      entidadId: conversacionId,
      detalles: { agenteId: agente.id },
    });

    return { asignado: true, agenteId: agente.id };
  });
}

export async function asignarManualmente(conversacionId, agenteId, usuarioQueAsignaId) {
  await query(
    `UPDATE conversaciones
     SET agente_asignado_id = $1, estatus = 'abierto', asignado_por = 'manual',
         asignado_por_usuario_id = $2, actualizado_en = now()
     WHERE id = $3`,
    [agenteId, usuarioQueAsignaId, conversacionId],
  );

  await crearNotificacion(agenteId, 'chat_asignado', conversacionId);
  await registrarAuditoria({
    usuarioId: usuarioQueAsignaId,
    accion: 'asigno_chat_manual',
    entidadTipo: 'conversacion',
    entidadId: conversacionId,
    detalles: { agenteId },
  });
}
