import { Router } from 'express';
import { TransactionController } from '../controllers/TransactionController.js';

export function createTransactionRoutes(
  controller: TransactionController
) {
  const router = Router();

  router.get('/', controller.listTransactions.bind(controller));
  router.get('/:id', controller.getTransaction.bind(controller));
  router.post('/', controller.createTransaction.bind(controller));

  return router;
}