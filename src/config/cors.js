// Configuracion de CORS centralizada.
// Se permiten las URLs configuradas en variables de entorno (Vercel/Render
// hoy, dominio propio a futuro) para no tener que tocar codigo al migrar.
import { env } from './env.js';

export const corsOptions = {
  origin(origin, callback) {
    // Se permiten peticiones sin "origin" (ej. Postman, health-checks internos).
    if (!origin) return callback(null, true);

    if (env.frontendUrls.includes(origin)) {
      return callback(null, true);
    }

    // En desarrollo se permite cualquier localhost para no frenar al equipo.
    if (env.nodeEnv !== 'production' && /^http:\/\/localhost:\d+$/.test(origin)) {
      return callback(null, true);
    }

    return callback(new Error(`Origen no permitido por CORS: ${origin}`));
  },
  credentials: true,
};
