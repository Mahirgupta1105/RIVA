import { Router } from 'express';
import { IncidentController } from '../controllers/IncidentController.js';

export function createIncidentRoutes(controller: IncidentController) {
  const router = Router();

  // Incident CRUD
  router.get('/', controller.listIncidents.bind(controller));
  router.get('/:id', controller.getIncident.bind(controller));
  router.post('/', controller.createIncident.bind(controller));

  // Incident processing
  router.post('/:id/classify', controller.classifyIncident.bind(controller));
  router.post('/:id/set-cause', controller.setCause.bind(controller));
  router.post('/:id/recover', controller.recoverIncident.bind(controller));

  return router;
}