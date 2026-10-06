// Configuracion de la app de Express (sin arrancar el servidor: eso vive
// en server.js, separado para poder testear "app" sin abrir un puerto).
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import pinoHttp from 'pino-http';
import { corsOptions } from './config/cors.js';
import { logger } from './utils/logger.js';
import routes from './routes/index.js';
import { manejadorErrores, rutaNoEncontrada } from './middleware/error.middleware.js';

export const app = express();

app.use(helmet());
app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(pinoHttp({ logger }));

app.get('/', (req, res) => {
  res.json({ ok: true, empresa: 'Malanco Corp', api: 'activa' });
});

app.use('/api', routes);

app.use(rutaNoEncontrada);
app.use(manejadorErrores);
