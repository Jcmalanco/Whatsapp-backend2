// Webhook de WhatsApp: recibe TODOS los mensajes y actualizaciones de
// estatus que manda Meta, los guarda como historial inmutable y dispara
// la asignacion automatica de conversaciones nuevas.
import { asyncHandler } from '../utils/asyncHandler.js';
import { query, transaccion } from '../config/db.js';
import {
  verificarWebhook,
  normalizarEventoEntrante,
  descargarMediaWhatsapp,
} from '../services/whatsapp.service.js';
import { subirArchivo } from '../services/storage.service.js';
import { asignarAutomaticamente } from '../services/asignacion.service.js';
import { crearNotificacion } from '../services/notificaciones.service.js';
import { logger } from '../utils/logger.js';

// GET /webhook/whatsapp -> verificacion inicial que exige Meta.
export const verificarWebhookController = asyncHandler(async (req, res) => {
  const desafio = verificarWebhook(req.query);
  res.status(200).send(desafio);
});

// POST /webhook/whatsapp -> eventos entrantes reales.
export const recibirWebhookController = asyncHandler(async (req, res) => {
  // Se responde 200 de inmediato (requisito de Meta) y se procesa despues,
  // para no arriesgar timeouts que hagan que Meta reintente de mas.
  res.status(200).json({ ok: true });

  const eventos = normalizarEventoEntrante(req.body);

  for (const evento of eventos) {
    try {
      if (evento.tipoEvento === 'mensaje_entrante') {
        await procesarMensajeEntrante(evento);
      } else if (evento.tipoEvento === 'actualizacion_estatus') {
        await query(
          `UPDATE mensajes_whatsapp SET estatus_entrega = $1 WHERE whatsapp_message_id = $2`,
          [evento.estatus, evento.whatsappMessageId],
        );
      }
    } catch (err) {
      logger.error({ err, evento }, 'Error procesando evento de webhook de WhatsApp');
    }
  }
});

async function procesarMensajeEntrante(evento) {
  // Evita duplicados si Meta reintenta el mismo evento.
  const yaExiste = await query('SELECT id FROM mensajes_whatsapp WHERE whatsapp_message_id = $1', [
    evento.whatsappMessageId,
  ]);
  if (yaExiste.rows.length > 0) return;

  const { contacto, conversacion, esConversacionNueva } = await transaccion(async (client) => {
    const contactoRes = await client.query(
      `INSERT INTO contactos (numero_whatsapp, nombre)
       VALUES ($1, $2)
       ON CONFLICT (numero_whatsapp) DO UPDATE SET nombre = COALESCE(EXCLUDED.nombre, contactos.nombre)
       RETURNING *`,
      [evento.numeroOrigen, evento.nombreContacto],
    );
    const contactoRow = contactoRes.rows[0];

    let conversacionRes = await client.query(
      `SELECT * FROM conversaciones WHERE contacto_id = $1 AND estatus != 'archivado'
       ORDER BY creado_en DESC LIMIT 1`,
      [contactoRow.id],
    );

    let nueva = false;
    if (conversacionRes.rows.length === 0) {
      conversacionRes = await client.query(
        `INSERT INTO conversaciones (contacto_id, estatus) VALUES ($1, 'pendiente_asignacion') RETURNING *`,
        [contactoRow.id],
      );
      nueva = true;
    }

    return { contacto: contactoRow, conversacion: conversacionRes.rows[0], esConversacionNueva: nueva };
  });

  let archivoUrl = null;
  let archivoMimetype = null;
  if (evento.mediaId) {
    const { buffer, mimetype } = await descargarMediaWhatsapp(evento.mediaId);
    const nombreFicticio = `media-${evento.whatsappMessageId}`;
    const subido = await subirArchivo(buffer, nombreFicticio, mimetype, 'whatsapp');
    archivoUrl = subido.url;
    archivoMimetype = mimetype;
  }

  const tipoInterno = { text: 'texto', image: 'imagen', video: 'video', document: 'documento', audio: 'audio' }[
    evento.tipo
  ] || 'texto';

  await query(
    `INSERT INTO mensajes_whatsapp
       (conversacion_id, direccion, tipo, contenido_texto, archivo_url, archivo_mimetype,
        enviado_por_usuario_id, whatsapp_message_id, estatus_entrega)
     VALUES ($1, 'entrante', $2, $3, $4, $5, NULL, $6, 'entregado')`,
    [conversacion.id, tipoInterno, evento.texto, archivoUrl, archivoMimetype, evento.whatsappMessageId],
  );

  await query('UPDATE conversaciones SET actualizado_en = now() WHERE id = $1', [conversacion.id]);

  if (esConversacionNueva) {
    await asignarAutomaticamente(conversacion.id);
  } else if (conversacion.agente_asignado_id) {
    await crearNotificacion(conversacion.agente_asignado_id, 'mensaje_nuevo', conversacion.id);
  }
}
