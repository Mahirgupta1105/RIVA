import { Router } from 'express';
import { CustomerController } from '../controllers/CustomerController.js';

export function createCustomerRoutes(controller: CustomerController) {
  const router = Router();

  router.get('/', controller.listCustomers.bind(controller));
  router.get('/:id', controller.getCustomer.bind(controller));
  router.post('/', controller.createCustomer.bind(controller));

  return router;
}