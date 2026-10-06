import { z } from 'zod';

export const asignarConversacionSchema = z.object({
  agenteId: z.string().uuid(),
});

export const cambiarEstatusSchema = z.object({
  estatus: z.enum(['pendiente_asignacion', 'abierto', 'pendiente', 'resuelto', 'archivado']),
});

export const responderConversacionSchema = z.object({
  texto: z.string().min(1).optional(),
});

export const idParamSchema = z.object({
  id: z.string().uuid('Id invalido'),
});
