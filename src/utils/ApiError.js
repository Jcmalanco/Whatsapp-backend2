// Error controlado y homogeneo para toda la API.
// Permite lanzar "throw new ApiError(404, 'Usuario no encontrado')" desde
// cualquier controlador/servicio y que el middleware de errores lo formatee.
export class ApiError extends Error {
  constructor(statusCode, mensaje, detalles = undefined) {
    super(mensaje);
    this.statusCode = statusCode;
    this.detalles = detalles;
  }
}
