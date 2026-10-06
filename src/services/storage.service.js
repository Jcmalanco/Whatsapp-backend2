// Capa aislada para el almacenamiento de archivos.
//
// Es el UNICO archivo que sabe que estamos usando Supabase Storage.
// Si en el futuro se cambia a S3, MinIO o disco propio, solo se
// reescribe este archivo: controladores y rutas no se enteran del cambio.
import { randomUUID } from 'crypto';
import { supabase } from '../config/supabase.js';
import { env } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';

/**
 * Sube un buffer de archivo (proveniente de Multer) al bucket configurado.
 * @param {Buffer} buffer
 * @param {string} nombreOriginal
 * @param {string} mimetype
 * @param {string} carpeta - Ej: "whatsapp" o "mensajeria-interna"
 * @returns {Promise<{ path: string, url: string, mimetype: string, nombreOriginal: string }>}
 */
export async function subirArchivo(buffer, nombreOriginal, mimetype, carpeta = 'general') {
  const extension = nombreOriginal.includes('.') ? nombreOriginal.split('.').pop() : '';
  const nombreUnico = `${carpeta}/${randomUUID()}${extension ? `.${extension}` : ''}`;

  const { error } = await supabase.storage
    .from(env.supabaseBucket)
    .upload(nombreUnico, buffer, { contentType: mimetype, upsert: false });

  if (error) {
    throw new ApiError(500, `No se pudo subir el archivo: ${error.message}`);
  }

  const url = await generarUrlFirmada(nombreUnico);

  return { path: nombreUnico, url, mimetype, nombreOriginal };
}

/**
 * Genera una URL firmada (temporal) para poder descargar/ver un archivo
 * privado del bucket. WhatsApp Cloud API tambien requiere una URL publica
 * o firmada para poder enviar el archivo al contacto.
 */
export async function generarUrlFirmada(path) {
  const { data, error } = await supabase.storage
    .from(env.supabaseBucket)
    .createSignedUrl(path, env.supabaseSignedUrlExpiraSeg);

  if (error) {
    throw new ApiError(500, `No se pudo generar la URL firmada: ${error.message}`);
  }

  return data.signedUrl;
}
