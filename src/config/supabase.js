// Cliente de Supabase usado UNICAMENTE para Storage (archivos).
// Se usa la service_role key porque este cliente vive en el backend,
// nunca debe exponerse al frontend.
import { createClient } from '@supabase/supabase-js';
import { env } from './env.js';

export const supabase = createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
  auth: { persistSession: false },
});
