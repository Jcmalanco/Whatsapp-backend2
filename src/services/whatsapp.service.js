// Capa aislada para hablar con la WhatsApp Cloud API (Meta).
//
// NOTA IMPORTANTE (leer antes de activar en produccion):
// - Si han pasado mas de 24h desde el ultimo mensaje del CLIENTE, Meta
//   solo permite responder con PLANTILLAS (templates) previamente
//   aprobadas, no texto libre ni archivos libres. Enviar fuera de esa
//   ventana con "texto libre" sera rechazado por la API de Meta.
// - Los envios masivos por WhatsApP quedaron fuera del alcance actual
//   (se dejo para la mensajeria interna) hasta que la cuenta de Meta y
//   sus plantillas esten aprobadas. Este servicio ya queda listo para
//   cuando se active esa funcionalidad.
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { ApiError } from '../utils/ApiError.js';

function urlBase() {
  return `https://graph.facebook.com/${env.whatsapp.apiVersion}/${env.whatsapp.phoneNumberId}`;
}

async function llamarApiWhatsapp(payload) {
  if (!env.whatsapp.accessToken || !env.whatsapp.phoneNumberId) {
    throw new ApiError(
      501,
      'La integracion con WhatsApp Cloud API todavia no esta configurada (faltan credenciales de Meta)',
    );
  }

  const respuesta = await fetch(`${urlBase()}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.whatsapp.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const data = await respuesta.json();

  if (!respuesta.ok) {
    logger.error({ data }, 'Error respondido por la API de WhatsApp');
    throw new ApiError(502, 'WhatsApp rechazo el envio del mensaje', data);
  }

  return data;
}

export async function enviarTextoWhatsapp(numeroDestino, texto) {
  return llamarApiWhatsapp({
    messaging_product: 'whatsapp',
    to: numeroDestino,
    type: 'text',
    text: { body: texto },
  });
}

/**
 * Envia un archivo ya subido (con URL firmada/publica) como imagen, video
 * o documento segun "tipo".
 */
export async function enviarArchivoWhatsapp(numeroDestino, tipo, urlArchivo, caption = '') {
  const tiposValidos = ['image', 'video', 'document'];
  if (!tiposValidos.includes(tipo)) {
    throw new ApiError(400, `Tipo de archivo no soportado por WhatsApp: ${tipo}`);
  }

  return llamarApiWhatsapp({
    messaging_product: 'whatsapp',
    to: numeroDestino,
    type: tipo,
    [tipo]: { link: urlArchivo, caption },
  });
}

/**
 * Verificacion del webhook que exige Meta (GET con hub.challenge).
 */
export function verificarWebhook(query) {
  const modo = query['hub.mode'];
  const token = query['hub.verify_token'];
  const desafio = query['hub.challenge'];

  if (modo === 'subscribe' && token === env.whatsapp.webhookVerifyToken) {
    return desafio;
  }
  throw new ApiError(403, 'Token de verificacion de webhook invalido');
}

/**
 * Normaliza el payload que manda Meta en cada evento entrante a un
 * formato interno mas simple, para no ensuciar el resto del codigo con
 * la forma particular del JSON de Meta.
 */
export function normalizarEventoEntrante(body) {
  const eventos = [];
  const entradas = body?.entry ?? [];

  for (const entrada of entradas) {
    for (const cambio of entrada.changes ?? []) {
      const valor = cambio.value;

      for (const mensaje of valor.messages ?? []) {
        const contacto = (valor.contacts ?? []).find((c) => c.wa_id === mensaje.from);

        eventos.push({
          tipoEvento: 'mensaje_entrante',
          whatsappMessageId: mensaje.id,
          numeroOrigen: mensaje.from,
          nombreContacto: contacto?.profile?.name ?? null,
          tipo: mensaje.type,
          texto: mensaje.text?.body ?? null,
          mediaId: mensaje[mensaje.type]?.id ?? null,
          timestamp: mensaje.timestamp,
        });
      }

      for (const estatus of valor.statuses ?? []) {
        eventos.push({
          tipoEvento: 'actualizacion_estatus',
          whatsappMessageId: estatus.id,
          estatus: estatus.status, // sent | delivered | read | failed
          timestamp: estatus.timestamp,
        });
      }
    }
  }

  return eventos;
}

/**
 * Descarga un archivo multimedia entrante desde los servidores de Meta
 * usando el media_id, para poder re-subirlo a Supabase Storage y no
 * depender de que Meta lo conserve indefinidamente.
 */
export async function descargarMediaWhatsapp(mediaId) {
  const metaResp = await fetch(`https://graph.facebook.com/${env.whatsapp.apiVersion}/${mediaId}`, {
    headers: { Authorization: `Bearer ${env.whatsapp.accessToken}` },
  });
  const meta = await metaResp.json();
  if (!metaResp.ok) {
    throw new ApiError(502, 'No se pudo obtener metadata del archivo de WhatsApp', meta);
  }

  const archivoResp = await fetch(meta.url, {
    headers: { Authorization: `Bearer ${env.whatsapp.accessToken}` },
  });
  const buffer = Buffer.from(await archivoResp.arrayBuffer());

  return { buffer, mimetype: meta.mime_type };
}
