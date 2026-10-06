import { app } from './app.js';
import { env } from './config/env.js';
import { logger } from './utils/logger.js';

app.listen(env.port, () => {
  logger.info(`Servidor de Malanco Corp escuchando en el puerto ${env.port} (${env.nodeEnv})`);
});
