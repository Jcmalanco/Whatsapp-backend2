// Middleware de subida de archivos con Multer.
//
// NOTA DE PORTABILIDAD: se usa memoryStorage() a proposito. El archivo
// nunca toca el disco del servidor (lo cual fallaria en Render/Vercel,
// que son entornos efimeros), sino que llega como buffer en memoria y
// desde el controlador se sube a traves de storage.service.js. Si el dia
// de manana se cambia Supabase Storage por S3, disco propio, etc., solo
// se reemplaza ese servicio: este middleware no cambia.
import multer from 'multer';
import { env } from '../config/env.js';

const storage = multer.memoryStorage();

export const upload = multer({
  storage,
  limits: { fileSize: env.maxFileSizeMb * 1024 * 1024 },
});
