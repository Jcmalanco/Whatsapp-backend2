import { Router } from 'express';
import { loginController, perfilController } from '../controllers/auth.controller.js';
import { validar } from '../middleware/validate.middleware.js';
import { loginSchema } from '../schemas/auth.schema.js';
import { requiereAuth } from '../middleware/auth.middleware.js';

const router = Router();

router.post('/login', validar({ body: loginSchema }), loginController);
router.get('/perfil', requiereAuth, perfilController);

export default router;
