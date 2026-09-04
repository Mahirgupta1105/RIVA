import { Request, Response } from 'express';
import { IIncidentRepository } from '../repositories/IIncidentRepository.js';
import { IncidentService } from '../services/IncidentService.js';

export class IncidentController {
  constructor(
    private repository: IIncidentRepository,
    private incidentService: IncidentService
  ) {}

  async listIncidents(req: Request, res: Response) {
    try {
      const incidents = await this.repository.listIncidents({});
      res.json(incidents);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async getIncident(req: Request, res: Response) {
    try {
      const incident = await this.repository.getIncidentById(req.params.id);

      if (!incident) {
        return res.status(404).json({ error: 'Incident not found' });
      }

      res.json(incident);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async createIncident(req: Request, res: Response) {
    try {
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

      const incident = await this.repository.createIncident({
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
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
    async setCause(req: Request, res: Response) {
    try {
      const { cause } = req.body;

      if (!cause) {
        return res.status(400).json({
          error: 'cause is required'
        });
      }

      await this.repository.updateIncident(req.params.id, {
        cause
      });

      res.json({
        message: `Cause set to ${cause}`
      });
    } catch (error: any) {
      res.status(500).json({
        error: error.message
      });
    }
  }

  async classifyIncident(req: Request, res: Response) {
    try {
      const { rawErrorMessage } = req.body;

      if (!rawErrorMessage) {
        return res.status(400).json({
          error: 'rawErrorMessage is required'
        });
      }

      const outcome = await this.incidentService.classifyIncident(
        req.params.id,
        rawErrorMessage
      );

      if (outcome.success) {
        return res.json({
          message: 'Incident classified successfully',
          ...outcome
        });
      }

      res.status(500).json({
        error: 'Classification failed'
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async recoverIncident(req: Request, res: Response) {
    try {
      const outcome = await this.incidentService.executeRecoveryStep(
        req.params.id
      );

      if (outcome.success) {
        return res.json({
          message: 'Recovery step executed successfully',
          ...outcome
        });
      }

      res.status(500).json({
        error: 'Recovery step failed'
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
}