// Middleware de autorizacion por rol. Uso: permitirRoles('admin', 'supervisor').
// Debe usarse SIEMPRE despues de requiereAuth, ya que depende de req.usuario.
import { ApiError } from '../utils/ApiError.js';

export function permitirRoles(...rolesPermitidos) {
  return (req, res, next) => {
    if (!req.usuario) {
      return next(new ApiError(401, 'No autenticado'));
    }
    if (!rolesPermitidos.includes(req.usuario.rol)) {
      return next(new ApiError(403, 'No tienes permisos para realizar esta accion'));
    }
    next();
  };
}
