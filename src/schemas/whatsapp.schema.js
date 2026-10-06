import { z } from 'zod';

export const enviarWhatsappSchema = z.object({
  contactos: z
    .array(z.string().min(8))
    .min(1, 'Debes indicar al menos un numero de WhatsApp'),
  texto: z.string().min(1).optional(),
});
