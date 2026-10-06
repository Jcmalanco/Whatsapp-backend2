// ------------------------------------------------------------------
// Script de respaldo PREPARADO para cuando la empresa deje de usar
// Supabase y pase a un servidor/base de datos fisica propia.
//
// Mientras se use Supabase, los backups automaticos los maneja Supabase
// (diarios en el plan Pro). Este script NO es necesario en ese escenario.
//
// Cuando se migre a un servidor propio con Postgres, este script hace un
// pg_dump programado (via cron/systemd timer) y guarda el respaldo
// comprimido en la carpeta configurada (o se puede extender para subirlo
// a un storage externo).
//
// Uso: node src/scripts/backup-db-fisica.js
// Programarlo con cron, ej. todos los dias a las 3am:
//   0 3 * * * cd /ruta/al/backend && node src/scripts/backup-db-fisica.js
// ------------------------------------------------------------------
import 'dotenv/config';
import { execFile } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';

const execFileAsync = promisify(execFile);

async function main() {
  const carpetaDestino = process.env.BACKUP_CARPETA_DESTINO || './backups';
  if (!fs.existsSync(carpetaDestino)) fs.mkdirSync(carpetaDestino, { recursive: true });

  const fecha = new Date().toISOString().replace(/[:.]/g, '-');
  const archivoDestino = path.join(carpetaDestino, `malanco-backup-${fecha}.sql.gz`);

  // Requiere tener "pg_dump" instalado en el servidor donde corra este script.
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('Falta DATABASE_URL en las variables de entorno');

  console.log(`Generando respaldo en: ${archivoDestino}`);

  await execFileAsync('sh', [
    '-c',
    `pg_dump "${databaseUrl}" | gzip > "${archivoDestino}"`,
  ]);

  console.log('Respaldo generado correctamente.');
  // TODO cuando se migre: subir "archivoDestino" a un storage externo
  // (S3, otro servidor, etc.) para no depender solo del disco local.
}

main().catch((err) => {
  console.error('Error generando el respaldo:', err);
  process.exit(1);
});
