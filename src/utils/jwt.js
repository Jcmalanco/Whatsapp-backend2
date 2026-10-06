// Helpers para firmar y verificar JWT de sesion.
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

export function firmarToken(payload) {
  return jwt.sign(payload, env.jwtSecret, { expiresIn: env.jwtExpira });
}

export function verificarToken(token) {
  return jwt.verify(token, env.jwtSecret);
}
