import { Router } from 'express';
import { requiereAuth } from '../middleware/auth.middleware.js';
import { listarNotificaciones, marcarNotificacionLeida } from '../controllers/notificaciones.controller.js';

const router = Router();

router.use(requiereAuth);
router.get('/', listarNotificaciones);
router.patch('/:id/leida', marcarNotificacionLeida);

export default router;
