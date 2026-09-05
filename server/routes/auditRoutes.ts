import { Router } from 'express';
import { AuditController } from '../controllers/AuditController.js';

export function createAuditRoutes(controller: AuditController) {
  const router = Router();
router.get('/', controller.getAuditChain.bind(controller));
  router.get('/latest', controller.getLatestAuditEntry.bind(controller));
  router.get('/chain', controller.getAuditChain.bind(controller));
  router.get('/verify', controller.verifyAuditChain.bind(controller));
  router.post('/', controller.createAuditEntry.bind(controller));

  return router;
}