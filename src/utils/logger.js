// Logger tecnico con Pino. Esto es DISTINTO de la bitacora de auditoria
// (que vive en la tabla "auditoria" para temas de negocio). Este logger
// es para depurar errores de servidor, tiempos de respuesta, caidas, etc.
import pino from 'pino';
import { env } from '../config/env.js';

export const logger = pino({
  level: env.nodeEnv === 'production' ? 'info' : 'debug',
  transport:
    env.nodeEnv === 'production'
      ? undefined
      : { target: 'pino-pretty', options: { colorize: true, translateTime: 'SYS:standard' } },
});
