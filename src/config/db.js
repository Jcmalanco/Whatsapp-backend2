// Conexion a Postgres (Supabase) usando "pg".
// Se usa un pool para reutilizar conexiones entre requests, algo
// importante en Render donde cada instancia atiende muchas peticiones.
import pg from 'pg';
import { env } from './env.js';
import { logger } from '../utils/logger.js';

const { Pool } = pg;

export const pool = new Pool({
  connectionString: env.databaseUrl,
  ssl: env.databaseSsl ? { rejectUnauthorized: false } : false,
  max: 10,
  idleTimeoutMillis: 30000,
});

pool.on('error', (err) => {
  // Un error en un cliente inactivo del pool no debe tumbar el servidor.
  logger.error({ err }, 'Error inesperado en el pool de Postgres');
});

/**
 * Helper para correr queries con logging uniforme.
 * @param {string} texto - SQL con placeholders $1, $2, ...
 * @param {any[]} params
 */
export async function query(texto, params = []) {
  const inicio = Date.now();
  const resultado = await pool.query(texto, params);
  const duracionMs = Date.now() - inicio;
  logger.debug({ texto, duracionMs, filas: resultado.rowCount }, 'Query ejecutado');
  return resultado;
}

/**
 * Helper para transacciones. Recibe una funcion callback que recibe el
 * "client" y hace queries con el. Si algo lanza error, se hace ROLLBACK.
 */
export async function transaccion(callback) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const resultado = await callback(client);
    await client.query('COMMIT');
    return resultado;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
