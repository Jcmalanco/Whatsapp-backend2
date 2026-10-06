// Mensajeria interna tipo "correo de trabajo" entre empleados de Malanco
// Corp. Soporta uno o varios destinatarios y adjuntos (imagen/video/doc).
// Este modulo esta separado del de WhatsApp a proposito (contactos y
// reglas de negocio distintas).
import { asyncHandler } from '../utils/asyncHandler.js';
import { query, transaccion } from '../config/db.js';
import { subirArchivo } from '../services/storage.service.js';
import { crearNotificacion } from '../services/notificaciones.service.js';
import { registrarAuditoria } from '../services/auditoria.service.js';

export const enviarMensajeInterno = asyncHandler(async (req, res) => {
  const { destinatarios, asunto, cuerpo } = req.body;
  const destinatariosArray = Array.isArray(destinatarios) ? destinatarios : JSON.parse(destinatarios);
  const archivos = req.files ?? [];

  const mensaje = await transaccion(async (client) => {
    const { rows } = await client.query(
      `INSERT INTO mensajeria_interna (remitente_id, asunto, cuerpo) VALUES ($1, $2, $3) RETURNING *`,
      [req.usuario.id, asunto, cuerpo],
    );
    const nuevoMensaje = rows[0];

    for (const destinatarioId of destinatariosArray) {
      await client.query(
        `INSERT INTO mensajeria_interna_destinatarios (mensaje_id, destinatario_id) VALUES ($1, $2)`,
        [nuevoMensaje.id, destinatarioId],
      );
    }

    for (const archivo of archivos) {
      const subido = await subirArchivo(archivo.buffer, archivo.originalname, archivo.mimetype, 'mensajeria-interna');
      await client.query(
        `INSERT INTO mensajeria_interna_adjuntos (mensaje_id, archivo_url, archivo_mimetype, nombre_original)
         VALUES ($1, $2, $3, $4)`,
        [nuevoMensaje.id, subido.url, archivo.mimetype, archivo.originalname],
      );
    }

    return nuevoMensaje;
  });

  await Promise.all(destinatariosArray.map((id) => crearNotificacion(id, 'mensaje_nuevo', mensaje.id)));

  await registrarAuditoria({
    usuarioId: req.usuario.id,
    accion: 'envio_mensaje_interno',
    entidadTipo: 'mensajeria_interna',
    entidadId: mensaje.id,
    detalles: { destinatarios: destinatariosArray, asunto },
    ipOrigen: req.ip,
  });

  res.status(201).json({ ok: true, mensaje });
});

// Bandeja de entrada del usuario autenticado.
export const bandejaEntradaInterna = asyncHandler(async (req, res) => {
  const { rows } = await query(
    `SELECT m.id, m.asunto, m.cuerpo, m.creado_en, u.nombre AS remitente_nombre,
            d.leido, d.leido_en
     FROM mensajeria_interna_destinatarios d
     JOIN mensajeria_interna m ON m.id = d.mensaje_id
     JOIN usuarios u ON u.id = m.remitente_id
     WHERE d.destinatario_id = $1
     ORDER BY m.creado_en DESC`,
    [req.usuario.id],
  );
  res.json({ ok: true, mensajes: rows });
});

export const bandejaEnviadosInterna = asyncHandler(async (req, res) => {
  const { rows } = await query(
    `SELECT * FROM mensajeria_interna WHERE remitente_id = $1 ORDER BY creado_en DESC`,
    [req.usuario.id],
  );
  res.json({ ok: true, mensajes: rows });
});

export const detalleMensajeInterno = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const mensaje = await query('SELECT * FROM mensajeria_interna WHERE id = $1', [id]);
  const adjuntos = await query('SELECT * FROM mensajeria_interna_adjuntos WHERE mensaje_id = $1', [id]);
  const destinatarios = await query(
    `SELECT d.*, u.nombre FROM mensajeria_interna_destinatarios d
     JOIN usuarios u ON u.id = d.destinatario_id WHERE mensaje_id = $1`,
    [id],
  );

  // Se marca como leido si el usuario actual es uno de los destinatarios.
  await query(
    `UPDATE mensajeria_interna_destinatarios SET leido = true, leido_en = now()
     WHERE mensaje_id = $1 AND destinatario_id = $2 AND leido = false`,
    [id, req.usuario.id],
  );

  res.json({ ok: true, mensaje: mensaje.rows[0], adjuntos: adjuntos.rows, destinatarios: destinatarios.rows });
});
