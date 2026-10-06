import bcrypt from 'bcryptjs';
import { query } from '../config/db.js';
import { firmarToken } from '../utils/jwt.js';
import { ApiError } from '../utils/ApiError.js';
import { registrarAuditoria } from './auditoria.service.js';

const RONDAS_SAL = 10;

export async function hashearPassword(password) {
  return bcrypt.hash(password, RONDAS_SAL);
}

export async function login(email, password, ipOrigen) {
  const { rows } = await query(
    `SELECT id, nombre, email, password_hash, rol, activo FROM usuarios WHERE email = $1`,
    [email],
  );
  const usuario = rows[0];

  if (!usuario || !usuario.activo) {
    throw new ApiError(401, 'Credenciales invalidas');
  }

  const coincide = await bcrypt.compare(password, usuario.password_hash);
  if (!coincide) {
    throw new ApiError(401, 'Credenciales invalidas');
  }

  const token = firmarToken({ sub: usuario.id, rol: usuario.rol });

  await registrarAuditoria({
    usuarioId: usuario.id,
    accion: 'login',
    entidadTipo: 'usuario',
    entidadId: usuario.id,
    ipOrigen,
  });

  delete usuario.password_hash;
  return { usuario, token };
}
