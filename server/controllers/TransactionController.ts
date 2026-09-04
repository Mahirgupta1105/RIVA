import { Request, Response } from 'express';
import {
  IIncidentRepository,
  PaymentMethod,
  TransactionStatus
} from '../repositories/IIncidentRepository.js';

export class TransactionController {
  constructor(private repository: IIncidentRepository) {}

  async listTransactions(req: Request, res: Response) {
    try {
      const { status, customerId } = req.query;

      const transactions = await this.repository.listTransactions({
        status: status as TransactionStatus | undefined,
        customerId: customerId as string | undefined
      });

      res.json(transactions);
    } catch (error: any) {
      res.status(500).json({
        error: error.message
      });
    }
  }

  async getTransaction(req: Request, res: Response) {
    try {
      const transaction =
        await this.repository.getTransactionById(req.params.id);

      if (!transaction) {
        return res.status(404).json({
          error: 'Transaction not found'
        });
      }

      res.json(transaction);
    } catch (error: any) {
      res.status(500).json({
        error: error.message
      });
    }
  }

  async createTransaction(req: Request, res: Response) {
    try {
      const {
        customerId,
        amount,
        method,
        bank,
        gateway,
        status
      } = req.body;

      if (!customerId || !amount || !method || !status) {
        return res.status(400).json({
          error: 'customerId, amount, method, and status are required'
        });
      }

      const transaction =
        await this.repository.createTransaction({
          customerId,
          amount,
          method: method as PaymentMethod,
          bank,
          gateway,
          status: status as TransactionStatus
        });

      res.status(201).json(transaction);
    } catch (error: any) {
      res.status(500).json({
        error: error.message
      });
    }
  }
}