// Middleware generico para validar body/params/query con esquemas Zod.
// Uso: router.post('/ruta', validar({ body: miEsquemaZod }), controlador)
import { ApiError } from '../utils/ApiError.js';

export function validar(esquemas) {
  return (req, res, next) => {
    try {
      if (esquemas.body) req.body = esquemas.body.parse(req.body);
      if (esquemas.params) req.params = esquemas.params.parse(req.params);
      if (esquemas.query) req.query = esquemas.query.parse(req.query);
      next();
    } catch (err) {
      // err.errors viene de Zod con el detalle de cada campo invalido
      next(new ApiError(400, 'Datos de entrada invalidos', err.errors ?? err.message));
    }
  };
}
