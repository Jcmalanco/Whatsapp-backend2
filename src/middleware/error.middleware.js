// Middleware final de manejo de errores. Convierte cualquier error
// (ApiError o inesperado) en una respuesta JSON homogenea.
import { logger } from '../utils/logger.js';
import { ApiError } from '../utils/ApiError.js';

export function manejadorErrores(err, req, res, next) { // eslint-disable-line no-unused-vars
  if (err instanceof ApiError) {
    return res.status(err.statusCode).json({
      ok: false,
      mensaje: err.message,
      detalles: err.detalles,
    });
  }

  logger.error({ err }, 'Error no controlado');
  return res.status(500).json({
    ok: false,
    mensaje: 'Error interno del servidor',
  });
}

export function rutaNoEncontrada(req, res) {
  res.status(404).json({ ok: false, mensaje: 'Ruta no encontrada' });
}
