import express, { Request } from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { IIncidentRepository } from './repositories/IIncidentRepository.js';
import { InMemoryRepository } from './repositories/InMemoryRepository.js';
import { ForensicEngine } from './services/ForensicEngine.js';
import { IncidentService } from './services/IncidentService.js';
import { RecoveryEngine } from './services/RecoveryEngine.js';
import { PrismaRepository } from './repositories/PrismaRepository.js'; // Now implemented

interface RequestWithRepository extends Request {
  repository: IIncidentRepository;
}

dotenv.config();

const app = express();
app.use(express.json());

// Repository Selection Logic
const DATABASE_MODE = process.env.DATABASE_MODE || 'demo';
let repository: IIncidentRepository;

if (DATABASE_MODE === 'database') {
  console.log('🚀 Booting in DATABASE mode (Postgres)');
  repository = new PrismaRepository();
} else {
  console.log('🚀 Booting in DEMO mode (In-Memory)');
  repository = new InMemoryRepository();
}

// Services Initialization
const forensicEngine = new ForensicEngine();
const recoveryEngine = new RecoveryEngine(repository);
const incidentService = new IncidentService(repository, forensicEngine, recoveryEngine);

// Dependency Injection: Attach repository to request
app.use((req: any, res, next) => {
  req.repository = repository;
  next();
});

async function startServer() {
  const isProduction = process.env.NODE_ENV === 'production';

  if (!isProduction) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // In production, serve static assets from the 'dist' directory
    const distPath = path.resolve('dist');
    app.use(express.static(distPath));
  }

  // --- API Endpoints ---

  // Create a test customer
  app.post('/api/customers', async (req, res) => {
  const { name, email, ltvTier, lifetimeValue } = req.body;
    if (!name || !email || !ltvTier) return res.status(400).json({ error: 'name, email, and ltvTier are required' });

    try {
      const customer = await repository.createCustomer({
  name,
  email,
  ltvTier,
  lifetimeValue: lifetimeValue || 0
});
      res.status(201).json(customer);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Create a test incident
  app.post('/api/incidents', async (req, res) => {
    const { customerId } = req.body;
    if (!customerId) return res.status(400).json({ error: 'customerId is required' });

    try {
  const incidents = await repository.listIncidents({});
  res.json(incidents);
} catch (e: any) {
  res.status(500).json({ error: e.message });
}
});

  // Get incident details
  app.get('/api/incidents/:id', async (req, res) => {
    const { id } = req.params;
    try {
      const incident = await repository.getIncidentById(id);
      if (!incident) return res.status(404).json({ error: 'Incident not found' });
      res.json(incident);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // List all incidents
  app.get('/api/incidents', async (req, res) => {
    try {
      const incidents = await repository.listIncidents({});
      res.json(incidents);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Simple health check
  app.get('/health', (req, res) => res.send('OK'));

  // Trigger classification for an incident (demo endpoint)
  app.post('/api/incidents/:id/classify', async (req, res) => {
    const { id } = req.params;
    const { rawErrorMessage } = req.body;

    if (!rawErrorMessage) {
      return res.status(400).json({ error: 'rawErrorMessage is required' });
    }

    const outcome = await incidentService.classifyIncident(id, rawErrorMessage);

    if (outcome.success) {
      res.json({ message: 'Incident classified successfully', ...outcome });
    } else {
      res.status(500).json({ error: 'Classification failed' });
    }
  });

  // TEST ENDPOINT: Manually set incident cause for recovery testing
  app.post('/api/incidents/:id/set-cause', async (req, res) => {
    const { id } = req.params;
    const { cause } = req.body;
    try {
      await repository.updateIncident(id, { cause });
      res.json({ message: `Cause set to ${cause}` });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Trigger a recovery step
  app.post('/api/incidents/:id/recover', async (req, res) => {
    const { id } = req.params;
    const outcome = await incidentService.executeRecoveryStep(id);

    if (outcome.success) {
      res.json({ message: 'Recovery step executed successfully', ...outcome });
    } else {
      res.status(500).json({ error: 'Recovery step failed' });
    }
  });

  // Audit Log retrieval
  app.get('/api/audit', async (req, res) => {
    try {
      const logs = await repository.getAuditChain();
      res.json(logs);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  if (!isProduction) {
    // Vite middleware is already added at the top of startServer for dev mode
    // but we must ensure it doesn't try to access a non-existent 'vite' variable here
  }

  // SPA Fallback
  if (process.env.NODE_ENV === 'production') {
    app.get('*', (req, res) => {
      res.sendFile(path.resolve('dist', 'index.html'));
    });
  } else {
    app.get('*', (req, res) => {
      res.sendFile(path.resolve('index.html'));
    });
  }

  const PORT = process.env.PORT || 8000;
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
