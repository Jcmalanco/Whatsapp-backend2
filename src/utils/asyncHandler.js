// Envuelve controladores async para no repetir try/catch en cada uno.
// Cualquier error (o promesa rechazada) se manda directo al middleware
// de manejo de errores via next(err).
export function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}
