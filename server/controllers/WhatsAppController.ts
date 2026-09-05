import { Request, Response } from 'express';
import { IIncidentRepository } from '../repositories/IIncidentRepository.js';
import { WhatsAppSimulationService } from '../services/WhatsAppSimulationService.js';

export class WhatsAppController {
  constructor(
    private repository: IIncidentRepository,
    private whatsappService: WhatsAppSimulationService
  ) {}

  async simulateRecovery(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const incident =
        await this.repository.getIncidentById(id);

      if (!incident) {
        return res.status(404).json({
          error: 'Incident not found'
        });
      }

      const result =
  await this.whatsappService.simulateRecoveryMessage(
    incident.customerId,
    incident.amount,
    incident.id
  );

      return res.json({
        message: 'WhatsApp recovery simulation completed',
        result
      });
    } catch (error: any) {
      console.error(
        'WhatsApp simulation failed:',
        error
      );

      return res.status(500).json({
        error: error.message
      });
    }
  }
}