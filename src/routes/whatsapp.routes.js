import { Router } from 'express';
import { verificarWebhookController, recibirWebhookController } from '../controllers/whatsapp.controller.js';

const router = Router();

// Estas dos rutas NO llevan requiereAuth: Meta las llama directamente y
// se autentican con el "hub.verify_token" (GET) que Meta exige.
router.get('/webhook', verificarWebhookController);
router.post('/webhook', recibirWebhookController);

export default router;
