import { Router } from 'express';
import { requiereAuth } from '../middleware/auth.middleware.js';
import { permitirRoles } from '../middleware/roles.middleware.js';
import { validar } from '../middleware/validate.middleware.js';
import { upload } from '../middleware/upload.middleware.js';
import {
  asignarConversacionSchema,
  cambiarEstatusSchema,
  idParamSchema,
} from '../schemas/conversaciones.schema.js';
import {
  listarConversaciones,
  obtenerConversacion,
  asignarConversacion,
  cambiarEstatusConversacion,
  responderConversacion,
  enviarArchivoMasivoWhatsapp,
} from '../controllers/conversaciones.controller.js';

const router = Router();

router.use(requiereAuth);

router.get('/', listarConversaciones);
router.get('/:id', validar({ params: idParamSchema }), obtenerConversacion);

// Asignacion manual: admin y supervisor (por si falla la automatica).
router.patch(
  '/:id/asignar',
  permitirRoles('admin', 'supervisor'),
  validar({ params: idParamSchema, body: asignarConversacionSchema }),
  asignarConversacion,
);

// Cambiar estatus (archivar queda restringido a admin dentro del controlador).
router.patch(
  '/:id/estatus',
  validar({ params: idParamSchema, body: cambiarEstatusSchema }),
  cambiarEstatusConversacion,
);

// Responder desde la pagina web (texto y/o un archivo adjunto).
router.post('/:id/responder', validar({ params: idParamSchema }), upload.single('archivo'), responderConversacion);

// Envio de imagen/video/documento a UNO O VARIOS contactos a la vez.
router.post('/envio-masivo', upload.single('archivo'), enviarArchivoMasivoWhatsapp);

export default router;
