-- ============================================================
-- MALANCO CORP - Esquema de base de datos (Postgres / Supabase)
-- ============================================================
-- Ejecutar este script en el SQL Editor de Supabase (o via psql)
-- una sola vez para crear toda la estructura.

CREATE EXTENSION IF NOT EXISTS "pgcrypto"; -- para gen_random_uuid()

-- ---------- Tipos enumerados ----------
CREATE TYPE rol_usuario AS ENUM ('admin', 'supervisor', 'agente');
CREATE TYPE estatus_actividad_usuario AS ENUM ('disponible', 'ocupado', 'desconectado');
CREATE TYPE estatus_conversacion AS ENUM ('pendiente_asignacion', 'abierto', 'pendiente', 'resuelto', 'archivado');
CREATE TYPE origen_asignacion AS ENUM ('automatico', 'manual');
CREATE TYPE direccion_mensaje AS ENUM ('entrante', 'saliente');
CREATE TYPE tipo_mensaje AS ENUM ('texto', 'imagen', 'video', 'documento', 'audio');
CREATE TYPE estatus_entrega_mensaje AS ENUM ('enviado', 'entregado', 'leido', 'fallido');
CREATE TYPE tipo_notificacion AS ENUM ('chat_asignado', 'mensaje_nuevo', 'cola_espera');

-- ---------- usuarios ----------
CREATE TABLE usuarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  rol rol_usuario NOT NULL,
  estatus_actividad estatus_actividad_usuario NOT NULL DEFAULT 'desconectado',
  max_chats_simultaneos INT NOT NULL DEFAULT 5,
  activo BOOLEAN NOT NULL DEFAULT true,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------- contactos (clientes de WhatsApp) ----------
CREATE TABLE contactos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero_whatsapp TEXT NOT NULL UNIQUE,
  nombre TEXT,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------- conversaciones ----------
CREATE TABLE conversaciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contacto_id UUID NOT NULL REFERENCES contactos(id),
  agente_asignado_id UUID REFERENCES usuarios(id),
  estatus estatus_conversacion NOT NULL DEFAULT 'pendiente_asignacion',
  asignado_por origen_asignacion,
  asignado_por_usuario_id UUID REFERENCES usuarios(id),
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_conversaciones_agente ON conversaciones(agente_asignado_id);
CREATE INDEX idx_conversaciones_estatus ON conversaciones(estatus);

-- ---------- mensajes_whatsapp (historial inmutable) ----------
CREATE TABLE mensajes_whatsapp (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversacion_id UUID NOT NULL REFERENCES conversaciones(id),
  direccion direccion_mensaje NOT NULL,
  tipo tipo_mensaje NOT NULL,
  contenido_texto TEXT,
  archivo_url TEXT,
  archivo_mimetype TEXT,
  enviado_por_usuario_id UUID REFERENCES usuarios(id),
  whatsapp_message_id TEXT UNIQUE,
  estatus_entrega estatus_entrega_mensaje NOT NULL DEFAULT 'enviado',
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_mensajes_conversacion ON mensajes_whatsapp(conversacion_id);

-- ---------- mensajeria_interna (correo interno de la empresa) ----------
CREATE TABLE mensajeria_interna (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  remitente_id UUID NOT NULL REFERENCES usuarios(id),
  asunto TEXT NOT NULL,
  cuerpo TEXT NOT NULL,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE mensajeria_interna_destinatarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mensaje_id UUID NOT NULL REFERENCES mensajeria_interna(id),
  destinatario_id UUID NOT NULL REFERENCES usuarios(id),
  leido BOOLEAN NOT NULL DEFAULT false,
  leido_en TIMESTAMPTZ
);
CREATE INDEX idx_mid_destinatario ON mensajeria_interna_destinatarios(destinatario_id);

CREATE TABLE mensajeria_interna_adjuntos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mensaje_id UUID NOT NULL REFERENCES mensajeria_interna(id),
  archivo_url TEXT NOT NULL,
  archivo_mimetype TEXT,
  nombre_original TEXT
);

-- ---------- notificaciones (NO auditadas, son avisos efimeros) ----------
CREATE TABLE notificaciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID NOT NULL REFERENCES usuarios(id),
  tipo tipo_notificacion NOT NULL,
  referencia_id UUID,
  leido BOOLEAN NOT NULL DEFAULT false,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_notificaciones_usuario ON notificaciones(usuario_id, leido);

-- ---------- auditoria (bitacora completa) ----------
CREATE TABLE auditoria (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID REFERENCES usuarios(id),
  accion TEXT NOT NULL,
  entidad_tipo TEXT NOT NULL,
  entidad_id UUID,
  detalles JSONB DEFAULT '{}'::jsonb,
  ip_origen TEXT,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_auditoria_usuario ON auditoria(usuario_id);
CREATE INDEX idx_auditoria_entidad ON auditoria(entidad_tipo, entidad_id);

-- ---------- configuracion (parametros ajustables por admin) ----------
CREATE TABLE configuracion (
  clave TEXT PRIMARY KEY,
  valor JSONB NOT NULL
);
INSERT INTO configuracion (clave, valor) VALUES ('max_chats_default', '5'::jsonb);

-- ============================================================
-- INMUTABILIDAD DEL HISTORIAL (requisito explicito del negocio)
-- ============================================================

-- 1) Se revoca DELETE sobre las tablas de historial/auditoria para el
--    rol que usa la aplicacion. Sustituir "app_role" por el rol/usuario
--    real que usa tu DATABASE_URL en Supabase (revisar en Database > Roles).
--    En Supabase normalmente la conexion se hace como "postgres"; si ese
--    es tu caso, crea un rol dedicado para la app con menos privilegios
--    y usalo en DATABASE_URL en vez del superusuario.
-- REVOKE DELETE ON mensajes_whatsapp, mensajeria_interna, auditoria FROM app_role;

-- 2) Trigger que impide modificar el contenido de un mensaje de WhatsApp
--    una vez creado (solo se permite actualizar el estatus de entrega,
--    que llega por los webhooks de estatus de Meta).
CREATE OR REPLACE FUNCTION bloquear_edicion_mensaje_whatsapp()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.contenido_texto IS DISTINCT FROM OLD.contenido_texto
     OR NEW.archivo_url IS DISTINCT FROM OLD.archivo_url
     OR NEW.tipo IS DISTINCT FROM OLD.tipo
     OR NEW.direccion IS DISTINCT FROM OLD.direccion THEN
    RAISE EXCEPTION 'El historial de mensajes de WhatsApp es inmutable: solo se puede actualizar el estatus de entrega';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_bloquear_edicion_mensaje_whatsapp
BEFORE UPDATE ON mensajes_whatsapp
FOR EACH ROW EXECUTE FUNCTION bloquear_edicion_mensaje_whatsapp();

-- 3) Trigger equivalente para bloquear cualquier UPDATE sobre la bitacora.
CREATE OR REPLACE FUNCTION bloquear_edicion_auditoria()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'La bitacora de auditoria no se puede modificar';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_bloquear_edicion_auditoria
BEFORE UPDATE OR DELETE ON auditoria
FOR EACH ROW EXECUTE FUNCTION bloquear_edicion_auditoria();

-- ============================================================
-- ROW LEVEL SECURITY (opcional, recomendado si se usa Supabase Auth
-- o si se llama a la base directamente desde el cliente en el futuro;
-- hoy el backend en Express ya filtra por rol, esto es una capa extra)
-- ============================================================
-- ALTER TABLE conversaciones ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY conversaciones_por_agente ON conversaciones
--   FOR SELECT USING (
--     agente_asignado_id = auth.uid()
--     OR EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol IN ('admin','supervisor'))
--   );
