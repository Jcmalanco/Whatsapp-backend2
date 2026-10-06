import { Router } from 'express';
import authRoutes from './auth.routes.js';
import usuariosRoutes from './usuarios.routes.js';
import conversacionesRoutes from './conversaciones.routes.js';
import whatsappRoutes from './whatsapp.routes.js';
import mensajeriaRoutes from './mensajeria.routes.js';
import notificacionesRoutes from './notificaciones.routes.js';
import configRoutes from './config.routes.js';
import healthRoutes from './health.routes.js';

const router = Router();

router.use('/auth', authRoutes);
router.use('/usuarios', usuariosRoutes);
router.use('/conversaciones', conversacionesRoutes);
router.use('/whatsapp', whatsappRoutes);
router.use('/mensajeria-interna', mensajeriaRoutes);
router.use('/notificaciones', notificacionesRoutes);
router.use('/config', configRoutes);
router.use('/health', healthRoutes);

export default router;
