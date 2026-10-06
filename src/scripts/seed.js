// Script para crear el primer usuario administrador.
// Uso: npm run seed
import 'dotenv/config';
import { pool } from '../config/db.js';
import { hashearPassword } from '../services/auth.service.js';

async function main() {
  const email = process.env.SEED_ADMIN_EMAIL || 'admin@malancocorp.com';
  const password = process.env.SEED_ADMIN_PASSWORD || 'CambiaEstaPassword123';
  const nombre = process.env.SEED_ADMIN_NOMBRE || 'Administrador Malanco Corp';

  const existente = await pool.query('SELECT id FROM usuarios WHERE email = $1', [email]);
  if (existente.rows.length > 0) {
    console.log('Ya existe un usuario administrador con ese email.');
    process.exit(0);
  }

  const passwordHash = await hashearPassword(password);
  await pool.query(
    `INSERT INTO usuarios (nombre, email, password_hash, rol) VALUES ($1, $2, $3, 'admin')`,
    [nombre, email, passwordHash],
  );

  console.log('Usuario administrador creado:');
  console.log(`  Email: ${email}`);
  console.log(`  Password: ${password}`);
  console.log('IMPORTANTE: cambia esta contrasena despues de tu primer login.');
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
