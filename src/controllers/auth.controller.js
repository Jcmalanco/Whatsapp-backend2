import { asyncHandler } from '../utils/asyncHandler.js';
import { login as loginServicio } from '../services/auth.service.js';

export const loginController = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const resultado = await loginServicio(email, password, req.ip);
  res.json({ ok: true, ...resultado });
});

export const perfilController = asyncHandler(async (req, res) => {
  // req.usuario ya viene resuelto por el middleware requiereAuth
  res.json({ ok: true, usuario: req.usuario });
});
