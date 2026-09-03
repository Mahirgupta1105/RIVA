import express from 'express';
import dotenv from 'dotenv';
import { IIncidentRepository } from './repositories/IIncidentRepository.js';
import { InMemoryRepository } from './repositories/InMemoryRepository.js';
import { ForensicEngine } from './services/ForensicEngine.js';
import { IncidentService } from './services/IncidentService.js';
import { RecoveryEngine } from './services/RecoveryEngine.js';
import { PrismaRepository } from './repositories/PrismaRepository.js';

dotenv.config();

export function createApp() {
  const app = express();
  app.use(express.json());

  // Repository Selection Logic
  const DATABASE_MODE = process.env.DATABASE_MODE || 'demo';
  let repository: IIncidentRepository;

  if (DATABASE_MODE === 'database') {
    repository = new PrismaRepository();
  } else {
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

  // --- API Endpoints ---

  app.post('/api/customers', async (req, res) => {
    const { name, email, ltvTier } = req.body;
    if (!name || !email || !ltvTier) return res.status(400).json({ error: 'name, email, and ltvTier are required' });
    try {
      const customer = await repository.createCustomer({ name, email, ltvTier });
      res.status(201).json(customer);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/incidents', async (req, res) => {
    const { customerId } = req.body;
    if (!customerId) return res.status(400).json({ error: 'customerId is required' });
    try {
      const incident = await repository.createIncident({ customerId });
      res.status(201).json(incident);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

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

  app.get('/api/incidents', async (req, res) => {
    try {
      const incidents = await repository.listIncidents({});
      res.json(incidents);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get('/health', (req, res) => res.send('OK'));

  app.post('/api/incidents/:id/classify', async (req, res) => {
    const { id } = req.params;
    const { rawErrorMessage } = req.body;
    if (!rawErrorMessage) return res.status(400).json({ error: 'rawErrorMessage is required' });
    const outcome = await incidentService.classifyIncident(id, rawErrorMessage);
    if (outcome.success) {
      res.json({ message: 'Incident classified successfully', ...outcome });
    } else {
      res.status(500).json({ error: 'Classification failed' });
    }
  });

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

  app.post('/api/incidents/:id/recover', async (req, res) => {
    const { id } = req.params;
    const outcome = await incidentService.executeRecoveryStep(id);
    if (outcome.success) {
      res.json({ message: 'Recovery step executed successfully', ...outcome });
    } else {
      res.status(500).json({ error: 'Recovery step failed' });
    }
  });

  app.get('/api/audit', async (req, res) => {
    try {
      const logs = await repository.getAuditChain();
      res.json(logs);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  return { app, repository };
}
