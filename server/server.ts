import express, { Request } from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { createServer as createViteServer } from 'vite';

import { IIncidentRepository } from './repositories/IIncidentRepository.js';
import { InMemoryRepository } from './repositories/InMemoryRepository.js';
import { PrismaRepository } from './repositories/PrismaRepository.js';

import { ForensicEngine } from './services/ForensicEngine.js';
import { IncidentService } from './services/IncidentService.js';
import { RecoveryEngine } from './services/RecoveryEngine.js';

dotenv.config();

interface RequestWithRepository extends Request {
  repository: IIncidentRepository;
}

const app = express();

app.use(express.json());

// ============================================================
// Repository Selection
// ============================================================

const DATABASE_MODE = process.env.DATABASE_MODE || 'demo';

let repository: IIncidentRepository;

if (DATABASE_MODE === 'database') {
  console.log('🚀 Booting in DATABASE mode (Postgres)');
  repository = new PrismaRepository();
} else {
  console.log('🚀 Booting in DEMO mode (In-Memory)');
  repository = new InMemoryRepository();
}

// ============================================================
// Services
// ============================================================

const forensicEngine = new ForensicEngine();

const recoveryEngine = new RecoveryEngine(
  repository
);

const incidentService = new IncidentService(
  repository,
  forensicEngine,
  recoveryEngine
);

// ============================================================
// Dependency Injection
// ============================================================

app.use((req: any, res, next) => {
  req.repository = repository;
  next();
});

// ============================================================
// Server
// ============================================================

async function startServer() {

  const isProduction =
    process.env.NODE_ENV === 'production';

  // ==========================================================
  // API ENDPOINTS
  // ==========================================================

  // ----------------------------------------------------------
  // Health Check
  // ----------------------------------------------------------

  app.get('/health', (req, res) => {
    res.send('OK');
  });

  // ----------------------------------------------------------
  // Customer
  // ----------------------------------------------------------

  app.post('/api/customers', async (req, res) => {

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

    try {

      const customer =
        await repository.createCustomer({
          name,
          email,
          ltvTier,
          lifetimeValue: lifetimeValue || 0
        });

      res.status(201).json(customer);

    } catch (e: any) {

      res.status(500).json({
        error: e.message
      });

    }
  });

  // ----------------------------------------------------------
  // Create Incident
  // ----------------------------------------------------------

  app.post('/api/incidents', async (req, res) => {

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

    if (!customerId || !amount) {
      return res.status(400).json({
        error: 'customerId and amount are required'
      });
    }

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

      res.status(201).json(incident);

    } catch (e: any) {

      res.status(500).json({
        error: e.message
      });

    }
  });

  // ----------------------------------------------------------
  // Get Incident Details
  // ----------------------------------------------------------

  app.get('/api/incidents/:id', async (req, res) => {

    const { id } = req.params;

    try {

      const incident =
        await repository.getIncidentById(id);

      if (!incident) {
        return res.status(404).json({
          error: 'Incident not found'
        });
      }

      res.json(incident);

    } catch (e: any) {

      res.status(500).json({
        error: e.message
      });

    }
  });

  // ----------------------------------------------------------
  // List Incidents
  // ----------------------------------------------------------

  app.get('/api/incidents', async (req, res) => {

    try {

      const incidents =
        await repository.listIncidents({});

      res.json(incidents);

    } catch (e: any) {

      res.status(500).json({
        error: e.message
      });

    }
  });

  // ----------------------------------------------------------
  // Classify Incident
  // ----------------------------------------------------------

  app.post(
    '/api/incidents/:id/classify',
    async (req, res) => {

      const { id } = req.params;
      const { rawErrorMessage } = req.body;

      if (!rawErrorMessage) {
        return res.status(400).json({
          error: 'rawErrorMessage is required'
        });
      }

      try {

        const outcome =
          await incidentService.classifyIncident(
            id,
            rawErrorMessage
          );

        if (outcome.success) {

          return res.json({
            message:
              'Incident classified successfully',
            ...outcome
          });

        }

        return res.status(500).json({
          error: 'Classification failed'
        });

      } catch (e: any) {

        return res.status(500).json({
          error: e.message
        });

      }
    }
  );

  // ----------------------------------------------------------
  // Set Incident Cause
  // ----------------------------------------------------------

  app.post(
    '/api/incidents/:id/set-cause',
    async (req, res) => {

      const { id } = req.params;
      const { cause } = req.body;

      try {

        await repository.updateIncident(
          id,
          { cause }
        );

        res.json({
          message: `Cause set to ${cause}`
        });

      } catch (e: any) {

        res.status(500).json({
          error: e.message
        });

      }
    }
  );

  // ----------------------------------------------------------
  // Recovery
  // ----------------------------------------------------------

  app.post(
    '/api/incidents/:id/recover',
    async (req, res) => {

      const { id } = req.params;

      try {

        const outcome =
          await incidentService.executeRecoveryStep(
            id
          );

        if (outcome.success) {

          return res.json({
            message:
              'Recovery step executed successfully',
            ...outcome
          });

        }

        return res.status(500).json({
          error: 'Recovery step failed'
        });

      } catch (e: any) {

        return res.status(500).json({
          error: e.message
        });

      }
    }
  );

  // ----------------------------------------------------------
  // Audit Logs
  // ----------------------------------------------------------

  app.get('/api/audit', async (req, res) => {

    try {

      const logs =
        await repository.getAuditChain();

      res.json(logs);

    } catch (e: any) {

      res.status(500).json({
        error: e.message
      });

    }
  });

  // ==========================================================
  // FRONTEND
  // IMPORTANT:
  // This MUST come AFTER all /api routes.
  // ==========================================================

  if (!isProduction) {

    const vite = await createViteServer({
      server: {
        middlewareMode: true
      },
      appType: 'spa'
    });

    app.use(vite.middlewares);

  } else {

    const distPath =
      path.resolve('dist');

    app.use(
      express.static(distPath)
    );

    app.get('*', (req, res) => {

      res.sendFile(
        path.join(
          distPath,
          'index.html'
        )
      );

    });

  }

  // ==========================================================
  // Start Server
  // ==========================================================

  const PORT =
    process.env.PORT || 8000;

  app.listen(
    PORT,
    () => {
      console.log(
        `Server running on http://localhost:${PORT}`
      );
    }
  );
}

startServer();