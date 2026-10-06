// Middleware de autenticacion: exige un JWT valido en el header
// "Authorization: Bearer <token>" y adjunta el usuario decodificado
// a req.usuario para que las rutas siguientes lo usen.
import { verificarToken } from '../utils/jwt.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { query } from '../config/db.js';

export const requiereAuth = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization || '';
  const [tipo, token] = header.split(' ');

  if (tipo !== 'Bearer' || !token) {
    throw new ApiError(401, 'No se proporciono un token de acceso valido');
  }

  let payload;
  try {
    payload = verificarToken(token);
  } catch (err) {
    throw new ApiError(401, 'Token invalido o expirado');
  }

  // Se vuelve a confirmar contra la base de datos que el usuario sigue
  // activo, por si fue desactivado por un admin despues de emitido el token.
  const { rows } = await query(
    'SELECT id, nombre, email, rol, activo, estatus_actividad FROM usuarios WHERE id = $1',
    [payload.sub],
  );

  const usuario = rows[0];
  if (!usuario || !usuario.activo) {
    throw new ApiError(401, 'El usuario ya no tiene acceso al sistema');
  }

  req.usuario = usuario;
  next();
});
