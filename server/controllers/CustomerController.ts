import { Request, Response } from 'express';
import { IIncidentRepository } from '../repositories/IIncidentRepository.js';

export class CustomerController {
  constructor(private repository: IIncidentRepository) {}

  async listCustomers(req: Request, res: Response) {
    try {
      const customers = await this.repository.listCustomers();
      res.json(customers);
    } catch (error: any) {
      res.status(500).json({
        error: error.message
      });
    }
  }

  async getCustomer(req: Request, res: Response) {
    try {
      const customer = await this.repository.getCustomerById(
        req.params.id
      );

      if (!customer) {
        return res.status(404).json({
          error: 'Customer not found'
        });
      }

      res.json(customer);
    } catch (error: any) {
      res.status(500).json({
        error: error.message
      });
    }
  }

  async createCustomer(req: Request, res: Response) {
    try {
      const {
        name,
        email,
        ltvTier,
        lifetimeValue
      } = req.body;

      if (!name || !email || !ltvTier) {
        return res.status(400).json({
          error: 'name, email, and ltvTier are required'
        });
      }

      const customer =
        await this.repository.createCustomer({
          name,
          email,
          ltvTier,
          lifetimeValue: lifetimeValue || 0
        });

      res.status(201).json(customer);
    } catch (error: any) {
      res.status(500).json({
        error: error.message
      });
    }
  }
}