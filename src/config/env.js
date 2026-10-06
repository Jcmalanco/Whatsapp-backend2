// Carga y valida las variables de entorno en un solo lugar.
// Cualquier otro archivo del backend debe importar "env" desde aqui
// en vez de leer process.env directamente, para evitar variables
// mal escritas repartidas por todo el codigo.
import 'dotenv/config';

function requerido(nombre, valorPorDefecto = undefined) {
  const valor = process.env[nombre] ?? valorPorDefecto;
  if (valor === undefined) {
    console.warn(`[env] Falta la variable de entorno ${nombre}`);
  }
  return valor;
}

export const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT) || 4000,

  databaseUrl: requerido('DATABASE_URL'),
  databaseSsl: (process.env.DATABASE_SSL || 'true') === 'true',

  supabaseUrl: requerido('SUPABASE_URL'),
  supabaseServiceRoleKey: requerido('SUPABASE_SERVICE_ROLE_KEY'),
  supabaseBucket: process.env.SUPABASE_STORAGE_BUCKET || 'malanco-archivos',
  supabaseSignedUrlExpiraSeg: Number(process.env.SUPABASE_SIGNED_URL_EXPIRA_SEG) || 3600,

  jwtSecret: requerido('JWT_SECRET'),
  jwtExpira: process.env.JWT_EXPIRA || '8h',

  // Se guardan las dos URLs de frontend permitidas (Vercel/Render actuales
  // y el dominio propio futuro) para no tener que tocar codigo al migrar.
  frontendUrls: [
    process.env.FRONTEND_URL_RENDER_VERCEL,
    process.env.FRONTEND_URL_DOMINIO_PROPIO,
  ].filter(Boolean),

  whatsapp: {
    apiVersion: process.env.WHATSAPP_API_VERSION || 'v20.0',
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || '',
    businessAccountId: process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || '',
    accessToken: process.env.WHATSAPP_ACCESS_TOKEN || '',
    webhookVerifyToken: process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || '',
  },

  maxFileSizeMb: Number(process.env.MAX_FILE_SIZE_MB) || 25,
  maxChatsSimultaneosDefault: Number(process.env.MAX_CHATS_SIMULTANEOS_DEFAULT) || 5,
};
