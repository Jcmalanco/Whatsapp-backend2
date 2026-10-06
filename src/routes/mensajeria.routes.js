import { Router } from 'express';
import { requiereAuth } from '../middleware/auth.middleware.js';
import { upload } from '../middleware/upload.middleware.js';
import { validar } from '../middleware/validate.middleware.js';
import { enviarMensajeInternoSchema } from '../schemas/mensajeria.schema.js';
import {
  enviarMensajeInterno,
  bandejaEntradaInterna,
  bandejaEnviadosInterna,
  detalleMensajeInterno,
} from '../controllers/mensajeria.controller.js';

const router = Router();

router.use(requiereAuth);

router.get('/bandeja-entrada', bandejaEntradaInterna);
router.get('/enviados', bandejaEnviadosInterna);
router.get('/:id', detalleMensajeInterno);
router.post('/', upload.array('adjuntos', 10), enviarMensajeInterno);

export default router;
