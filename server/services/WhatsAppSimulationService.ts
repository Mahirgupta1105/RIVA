import { IIncidentRepository } from '../repositories/IIncidentRepository.js';
import { AuditHashService } from './AuditHashService.js';

export interface WhatsAppSimulationResult {
  success: boolean;
  channel: 'WHATSAPP';
  simulated: true;
  recipient: string;
  message: string;
  recoveryLink: string;
  deliveryStatus: 'SIMULATED_DELIVERED';
  timestamp: string;
}

export class WhatsAppSimulationService {
  constructor(
    private repository: IIncidentRepository
  ) {}

  private async logAction(
    payload: any
  ): Promise<void> {
    const latest =
      await this.repository.getLatestAuditEntry();

    const previousHash =
      latest?.hash || '0'.repeat(64);

    const timestamp =
      new Date().toISOString();

    const action =
      'WHATSAPP_RECOVERY_SIMULATED';

    const hash =
      AuditHashService.generateHash(
        previousHash,
        action,
        payload,
        timestamp
      );

    await this.repository.createAuditEntry({
      previousHash,
      hash,
      action,
      actor: 'RIVA_SYSTEM',
      payload,
      timestamp: new Date(timestamp)
    });
  }

  async simulateRecoveryMessage(
    customerId: string,
    amount: number,
    incidentId: string
  ): Promise<WhatsAppSimulationResult> {
    const reference =
      crypto.randomUUID();

    const recoveryLink =
      `https://riva.local/recover/${reference}`;

    const message =
      `RIVA Payment Recovery: Your payment of ₹${amount} ` +
      `could not be completed. You can securely retry ` +
      `your payment here: ${recoveryLink}`;

    const timestamp =
      new Date().toISOString();

    const result: WhatsAppSimulationResult = {
      success: true,
      channel: 'WHATSAPP',
      simulated: true,
      recipient: customerId,
      message,
      recoveryLink,
      deliveryStatus: 'SIMULATED_DELIVERED',
      timestamp
    };

    await this.logAction({
      incidentId,
      customerId,
      amount,
      channel: 'WHATSAPP',
      simulated: true,
      deliveryStatus: result.deliveryStatus,
      recoveryLink,
      message,
      timestamp
    });

    return result;
  }
}