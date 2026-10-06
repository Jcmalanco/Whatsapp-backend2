import { Router } from 'express';
import { requiereAuth } from '../middleware/auth.middleware.js';
import { permitirRoles } from '../middleware/roles.middleware.js';
import { validar } from '../middleware/validate.middleware.js';
import {
  crearUsuarioSchema,
  actualizarUsuarioSchema,
  actualizarEstatusSchema,
  idParamSchema,
} from '../schemas/usuarios.schema.js';
import {
  listarUsuarios,
  crearUsuario,
  actualizarUsuario,
  actualizarMiEstatus,
} from '../controllers/usuarios.controller.js';

const router = Router();

router.use(requiereAuth);

// Solo el administrador crea/administra usuarios.
router.get('/', permitirRoles('admin', 'supervisor'), listarUsuarios);
router.post('/', permitirRoles('admin'), validar({ body: crearUsuarioSchema }), crearUsuario);
router.patch(
  '/:id',
  permitirRoles('admin'),
  validar({ params: idParamSchema, body: actualizarUsuarioSchema }),
  actualizarUsuario,
);

// Cualquier usuario autenticado puede actualizar su propio estatus de actividad.
router.patch('/me/estatus', validar({ body: actualizarEstatusSchema }), actualizarMiEstatus);

export default router;
