import { Router } from 'express';
import { SystemController } from '../controllers/SystemController.js';

export function createSystemRoutes(controller: SystemController) {
  const router = Router();

  router.get(
    '/health',
    controller.health.bind(controller)
  );

  router.get(
    '/api/gateways',
    controller.gateways.bind(controller)
  );

  router.post(
    '/api/simulation/run',
    controller.runSimulation.bind(controller)
  );

  return router;
}