import { z } from 'zod';

export const rolEnum = z.enum(['admin', 'supervisor', 'agente']);
export const estatusActividadEnum = z.enum(['disponible', 'ocupado', 'desconectado']);

export const crearUsuarioSchema = z.object({
  nombre: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
  rol: rolEnum,
  maxChatsSimultaneos: z.number().int().positive().optional(),
});

export const actualizarUsuarioSchema = z.object({
  nombre: z.string().min(2).optional(),
  rol: rolEnum.optional(),
  activo: z.boolean().optional(),
  maxChatsSimultaneos: z.number().int().positive().optional(),
});

export const actualizarEstatusSchema = z.object({
  estatusActividad: estatusActividadEnum,
});

export const idParamSchema = z.object({
  id: z.string().uuid('Id invalido'),
});
