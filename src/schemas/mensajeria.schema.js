import { z } from 'zod';

export const enviarMensajeInternoSchema = z.object({
  destinatarios: z.array(z.string().uuid()).min(1, 'Debes indicar al menos un destinatario'),
  asunto: z.string().min(1),
  cuerpo: z.string().min(1),
});
