import express from 'express';
import dotenv from 'dotenv';

import {
  IIncidentRepository,
  PaymentMethod,
  TransactionStatus
} from './repositories/IIncidentRepository.js';

import { InMemoryRepository } from './repositories/InMemoryRepository.js';
import { PrismaRepository } from './repositories/PrismaRepository.js';

import { ForensicEngine } from './services/ForensicEngine.js';
import { IncidentService } from './services/IncidentService.js';
import { RecoveryEngine } from './services/RecoveryEngine.js';
import { WhatsAppSimulationService } from './services/WhatsAppSimulationService.js';

import { IncidentController } from './controllers/IncidentController.js';
import { CustomerController } from './controllers/CustomerController.js';
import { TransactionController } from './controllers/TransactionController.js';
import { AuditController } from './controllers/AuditController.js';
import { SystemController } from './controllers/SystemController.js';
import { WhatsAppController } from './controllers/WhatsAppController.js';

import { createIncidentRoutes } from './routes/incidentRoutes.js';
import { createCustomerRoutes } from './routes/customerRoutes.js';
import { createTransactionRoutes } from './routes/transactionRoutes.js';
import { createAuditRoutes } from './routes/auditRoutes.js';
import { createSystemRoutes } from './routes/systemRoutes.js';
import { createWhatsAppRoutes } from './routes/whatsappRoutes.js';

dotenv.config();

export function createApp() {
  const app = express();

  app.use(express.json());

  // ============================================================
  // Repository Selection
  // ============================================================

  const DATABASE_MODE =
    process.env.DATABASE_MODE || 'demo';

  let repository: IIncidentRepository;

  if (DATABASE_MODE === 'database') {
    console.log(
      '🚀 Booting in DATABASE mode (Postgres)'
    );

    repository = new PrismaRepository();
  } else {
    console.log(
      '🚀 Booting in DEMO mode (In-Memory)'
    );

    repository = new InMemoryRepository();
  }

// ============================================================
// Services
// ============================================================

const forensicEngine =
  new ForensicEngine();

const recoveryEngine =
  new RecoveryEngine(repository);

const whatsappService =
  new WhatsAppSimulationService(repository);

const incidentService =
  new IncidentService(
    repository,
    forensicEngine,
    recoveryEngine,
    whatsappService
  );

// ============================================================
// Controllers
// ============================================================

const incidentController =
  new IncidentController(
    repository,
    incidentService
  );

const customerController =
  new CustomerController(
    repository
  );

const transactionController =
  new TransactionController(
    repository
  );

const auditController =
  new AuditController(
    repository
  );

const systemController =
  new SystemController(
    DATABASE_MODE
  );

const whatsappController =
  new WhatsAppController(
    repository,
    whatsappService
  );

  // ============================================================
  // Dependency Injection
  // ============================================================

  app.use(
    (req: any, res, next) => {
      req.repository = repository;
      next();
    }
  );

  // ============================================================
  // Routes
  // ============================================================

  app.use(
    '/api/customers',
    createCustomerRoutes(
      customerController
    )
  );

  app.use(
    '/api/incidents',
    createIncidentRoutes(
      incidentController
    )
  );

  app.use(
    '/api/transactions',
    createTransactionRoutes(
      transactionController
    )
  );

  app.use(
    '/api/audit',
    createAuditRoutes(
      auditController
    )
  );

  app.use(
    '/api/whatsapp',
    createWhatsAppRoutes(
      whatsappController
    )
  );

  app.use(
    '/',
    createSystemRoutes(
      systemController
    )
  );

  // ============================================================
  // Quick Leak
  // ============================================================

  app.post(
    '/api/quick-leak',
    async (req, res) => {
      const {
        customerId,
        amount,
        orderId,
        transactionId,
        gateway,
        errorCode,
        errorMessage,
        severity,
        recoverability
      } = req.body;

      try {
        const incident =
          await repository.createIncident({
            customerId,
            amount,
            orderId,
            transactionId,
            gateway,
            errorCode,
            errorMessage,
            severity,
            recoverability
          });

        await repository.createTransaction({
          customerId,
          amount,
          method: PaymentMethod.UPI,
          bank: 'HDFC',
          gateway,
          status:
            TransactionStatus.FAILED
        });

        res.status(201).json({
          message: 'Manual leak created',
          incident
        });

      } catch (error: any) {
        res.status(500).json({
          error: error.message
        });
      }
    }
  );

  return {
    app,
    repository
  };
}