// Bandeja de conversaciones, respuesta desde el panel y envio de
// imagenes/videos/documentos a uno o varios contactos de WhatsApp.
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import { query, transaccion } from '../config/db.js';
import { subirArchivo } from '../services/storage.service.js';
import { enviarTextoWhatsapp, enviarArchivoWhatsapp } from '../services/whatsapp.service.js';
import { asignarManualmente } from '../services/asignacion.service.js';
import { registrarAuditoria } from '../services/auditoria.service.js';
import { crearNotificacion } from '../services/notificaciones.service.js';

// Un agente ve solo sus conversaciones; supervisor/admin ven todas.
export const listarConversaciones = asyncHandler(async (req, res) => {
  const esAgente = req.usuario.rol === 'agente';
  const { rows } = await query(
    `SELECT c.*, ct.numero_whatsapp, ct.nombre AS contacto_nombre,
            u.nombre AS agente_nombre
     FROM conversaciones c
     JOIN contactos ct ON ct.id = c.contacto_id
     LEFT JOIN usuarios u ON u.id = c.agente_asignado_id
     WHERE ($1::boolean = false OR c.agente_asignado_id = $2)
       AND c.estatus != 'archivado'
     ORDER BY c.actualizado_en DESC`,
    [esAgente, req.usuario.id],
  );
  res.json({ ok: true, conversaciones: rows });
});

export const obtenerConversacion = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const conv = await query(
    `SELECT c.*, ct.numero_whatsapp, ct.nombre AS contacto_nombre
     FROM conversaciones c JOIN contactos ct ON ct.id = c.contacto_id
     WHERE c.id = $1`,
    [id],
  );
  if (conv.rows.length === 0) throw new ApiError(404, 'Conversacion no encontrada');

  if (req.usuario.rol === 'agente' && conv.rows[0].agente_asignado_id !== req.usuario.id) {
    throw new ApiError(403, 'No tienes acceso a esta conversacion');
  }

  const mensajes = await query(
    `SELECT * FROM mensajes_whatsapp WHERE conversacion_id = $1 ORDER BY creado_en ASC`,
    [id],
  );

  res.json({ ok: true, conversacion: conv.rows[0], mensajes: mensajes.rows });
});

export const asignarConversacion = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { agenteId } = req.body;
  await asignarManualmente(id, agenteId, req.usuario.id);
  res.json({ ok: true });
});

// Solo administrador puede archivar conversaciones (regla de negocio explicita).
export const cambiarEstatusConversacion = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { estatus } = req.body;

  if (estatus === 'archivado' && req.usuario.rol !== 'admin') {
    throw new ApiError(403, 'Solo un administrador puede archivar conversaciones');
  }

  await query('UPDATE conversaciones SET estatus = $1, actualizado_en = now() WHERE id = $2', [
    estatus,
    id,
  ]);

  await registrarAuditoria({
    usuarioId: req.usuario.id,
    accion: estatus === 'archivado' ? 'archivo_conversacion' : 'cambio_estatus_conversacion',
    entidadTipo: 'conversacion',
    entidadId: id,
    detalles: { estatus },
    ipOrigen: req.ip,
  });

  res.json({ ok: true });
});

// Responder desde la pagina web: texto y/o un archivo adjunto (Multer ya
// dejo el archivo en req.file como buffer en memoria).
export const responderConversacion = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { texto } = req.body;
  const archivo = req.file;

  if (!texto && !archivo) {
    throw new ApiError(400, 'Debes enviar texto o un archivo adjunto');
  }

  const conv = await query(
    `SELECT c.id, ct.numero_whatsapp FROM conversaciones c
     JOIN contactos ct ON ct.id = c.contacto_id WHERE c.id = $1`,
    [id],
  );
  if (conv.rows.length === 0) throw new ApiError(404, 'Conversacion no encontrada');
  const numeroDestino = conv.rows[0].numero_whatsapp;

  let archivoInfo = null;
  let tipoMensaje = 'texto';

  if (archivo) {
    archivoInfo = await subirArchivo(archivo.buffer, archivo.originalname, archivo.mimetype, 'whatsapp');
    tipoMensaje = archivo.mimetype.startsWith('image/')
      ? 'imagen'
      : archivo.mimetype.startsWith('video/')
      ? 'video'
      : 'documento';
  }

  // Se manda primero a WhatsApp; si Meta lo rechaza, no guardamos un
  // mensaje "saliente" fantasma que nunca llego al contacto.
  let respuestaMeta;
  if (archivoInfo) {
    const tipoMeta = tipoMensaje === 'imagen' ? 'image' : tipoMensaje === 'video' ? 'video' : 'document';
    respuestaMeta = await enviarArchivoWhatsapp(numeroDestino, tipoMeta, archivoInfo.url, texto ?? '');
  } else {
    respuestaMeta = await enviarTextoWhatsapp(numeroDestino, texto);
  }

  const { rows } = await query(
    `INSERT INTO mensajes_whatsapp
       (conversacion_id, direccion, tipo, contenido_texto, archivo_url, archivo_mimetype,
        enviado_por_usuario_id, whatsapp_message_id, estatus_entrega)
     VALUES ($1, 'saliente', $2, $3, $4, $5, $6, $7, 'enviado')
     RETURNING *`,
    [
      id,
      tipoMensaje,
      texto ?? null,
      archivoInfo?.url ?? null,
      archivoInfo?.mimetype ?? null,
      req.usuario.id,
      respuestaMeta?.messages?.[0]?.id ?? null,
    ],
  );

  await query('UPDATE conversaciones SET actualizado_en = now() WHERE id = $1', [id]);

  // Bitacora de quien contesto, cuando y desde que usuario.
  await registrarAuditoria({
    usuarioId: req.usuario.id,
    accion: 'respondio_mensaje',
    entidadTipo: 'conversacion',
    entidadId: id,
    detalles: { tipoMensaje },
    ipOrigen: req.ip,
  });

  res.status(201).json({ ok: true, mensaje: rows[0] });
});

// Envio de imagen/video/documento a UNO O VARIOS contactos de WhatsApp a
// la vez (para casos donde ya existe conversacion con cada contacto).
export const enviarArchivoMasivoWhatsapp = asyncHandler(async (req, res) => {
  const { conversacionIds, texto } = req.body; // conversacionIds: string (JSON array) por venir de form-data
  const archivo = req.file;
  if (!archivo) throw new ApiError(400, 'Debes adjuntar un archivo');

  const ids = JSON.parse(conversacionIds ?? '[]');
  if (!Array.isArray(ids) || ids.length === 0) {
    throw new ApiError(400, 'Debes indicar al menos una conversacion destino');
  }

  const archivoInfo = await subirArchivo(archivo.buffer, archivo.originalname, archivo.mimetype, 'whatsapp');
  const tipoMensaje = archivo.mimetype.startsWith('image/')
    ? 'imagen'
    : archivo.mimetype.startsWith('video/')
    ? 'video'
    : 'documento';
  const tipoMeta = tipoMensaje === 'imagen' ? 'image' : tipoMensaje === 'video' ? 'video' : 'document';

  const resultados = await Promise.allSettled(
    ids.map((convId) =>
      transaccion(async (client) => {
        const conv = await client.query(
          `SELECT c.id, ct.numero_whatsapp FROM conversaciones c
           JOIN contactos ct ON ct.id = c.contacto_id WHERE c.id = $1`,
          [convId],
        );
        if (conv.rows.length === 0) throw new ApiError(404, `Conversacion ${convId} no encontrada`);
        const numero = conv.rows[0].numero_whatsapp;

        const respuestaMeta = await enviarArchivoWhatsapp(numero, tipoMeta, archivoInfo.url, texto ?? '');

        await client.query(
          `INSERT INTO mensajes_whatsapp
             (conversacion_id, direccion, tipo, contenido_texto, archivo_url, archivo_mimetype,
              enviado_por_usuario_id, whatsapp_message_id, estatus_entrega)
           VALUES ($1, 'saliente', $2, $3, $4, $5, $6, $7, 'enviado')`,
          [
            convId,
            tipoMensaje,
            texto ?? null,
            archivoInfo.url,
            archivoInfo.mimetype,
            req.usuario.id,
            respuestaMeta?.messages?.[0]?.id ?? null,
          ],
        );
      }),
    ),
  );

  await registrarAuditoria({
    usuarioId: req.usuario.id,
    accion: 'envio_masivo_whatsapp',
    entidadTipo: 'conversacion',
    entidadId: null,
    detalles: { conversacionIds: ids, tipoMensaje },
    ipOrigen: req.ip,
  });

  res.status(207).json({
    ok: true,
    resultados: resultados.map((r, idx) => ({
      conversacionId: ids[idx],
      exito: r.status === 'fulfilled',
      error: r.status === 'rejected' ? r.reason.message : undefined,
    })),
  });
});
