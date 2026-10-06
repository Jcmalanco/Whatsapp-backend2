import { Router } from 'express';
import { requiereAuth } from '../middleware/auth.middleware.js';
import { permitirRoles } from '../middleware/roles.middleware.js';
import { obtenerConfiguracion, actualizarConfiguracion } from '../controllers/config.controller.js';

const router = Router();

router.use(requiereAuth);
router.get('/', obtenerConfiguracion);
router.put('/', permitirRoles('admin'), actualizarConfiguracion);

export default router;
