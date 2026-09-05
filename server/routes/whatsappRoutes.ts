import { Router } from 'express';
import { WhatsAppController } from '../controllers/WhatsAppController.js';

export function createWhatsAppRoutes(
  controller: WhatsAppController
) {
  const router = Router();

  router.post(
    '/:id',
    controller.simulateRecovery.bind(controller)
  );

  return router;
}