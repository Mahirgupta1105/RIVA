import { IIncidentRepository } from '../repositories/IIncidentRepository.js';
import { ForensicEngine, ForensicResult } from './ForensicEngine.js';
import { RecoveryEngine, RecoveryDecision } from './RecoveryEngine.js';
import { IncidentStatus, RecoveryActionResult } from '../types.js';
import crypto from 'crypto';

export class IncidentService {
  constructor(
    private repository: IIncidentRepository,
    private forensicEngine: ForensicEngine,
    private recoveryEngine: RecoveryEngine
  ) {}

  private async logAction(action: string, payload: any) {
    const latest = await this.repository.getLatestAuditEntry();
    const prevHash = latest?.hash || '0'.repeat(64);
    const timestamp = new Date().toISOString();
    const dataToHash = `${prevHash}|${action}|${JSON.stringify(payload)}|${timestamp}`;
    const hash = crypto.createHash('sha256').update(dataToHash).digest('hex');

    await this.repository.createAuditEntry({
  previousHash: prevHash,
  hash,
  action,
  actor: 'RIVA_SYSTEM',
  payload,
  });
  }

  /**
   * Transitions an incident from DETECTED to CLASSIFIED.
   */
  async classifyIncident(incidentId: string, rawErrorMessage: string): Promise<{ success: boolean; result?: ForensicResult }> {
    try {
      const incident = await this.repository.getIncidentById(incidentId);
      if (!incident) {
        throw new Error(`Incident ${incidentId} not found`);
      }

      if (incident.status !== IncidentStatus.DETECTED) {
        throw new Error(`Incident ${incidentId} is in status ${incident.status}, but classification requires status DETECTED`);
      }

      const forensicResult: ForensicResult = await this.forensicEngine.classify(incidentId, rawErrorMessage);

      await this.repository.updateIncident(incidentId, {
        cause: forensicResult.category,
        classificationSource: forensicResult.source,
        status: IncidentStatus.CLASSIFIED,
      });

      await this.logAction('CLASSIFY', { incidentId, result: forensicResult });

      return {
        success: true,
        result: forensicResult
      };
    } catch (error: any) {
      console.error(`Failed to classify incident ${incidentId}:`, error.message);
      return {
        success: false
      };
    }
  }

  /**
   * Executes the next step in the recovery cascade.
   */
  async executeRecoveryStep(incidentId: string): Promise<{ success: boolean; decision?: RecoveryDecision; action?: any }> {
    try {
      const incident = await this.repository.getIncidentById(incidentId);
      if (!incident) throw new Error(`Incident ${incidentId} not found`);

      const customer = await this.repository.getCustomerById(incident.customerId);
      if (!customer) throw new Error(`Customer ${incident.customerId} not found`);

      // 1. Determine the next action
      const decision = await this.recoveryEngine.determineNextAction(incident, customer);

      if (!decision) {
        // No further actions possible (Max retries or Systemic Pause)
        await this.repository.updateIncident(incidentId, { status: IncidentStatus.ESCALATED });
        await this.logAction('ESCALATE', { incidentId, reason: 'MAX_RETRIES_OR_PAUSE' });
        return { success: false, decision: undefined };
      }

      // 2. Idempotency Check: Ensure we aren't duplicating this attempt
      const attemptNumber = (incident.actions?.length || 0) + 1;
      const existing = await this.repository.getActionByIncidentAndAttempt(incidentId, attemptNumber);
      if (existing) {
        throw new Error(`Idempotency violation: Attempt ${attemptNumber} already exists`);
      }

      // 3. Execute Action (In this demo, we simulate the gateway result)
      const result = await this.simulateGatewayCall(decision);

      // 4. Persist Action
      const action = await this.repository.addRecoveryAction({
        incidentId,
        rail: decision.action,
        result: result.status,
        details: result.details,
        attemptNumber
      });

      // 5. Update Incident Status & Systemic Metrics
      if (result.status === RecoveryActionResult.SUCCESS) {
        await this.repository.updateIncident(incidentId, { status: IncidentStatus.RECOVERED });
        await this.recoveryEngine.recordSuccess(incident);
      } else {
        await this.repository.updateIncident(incidentId, { status: IncidentStatus.RECOVERY_IN_PROGRESS });
        await this.recoveryEngine.recordFailure(incident);
      }

      await this.logAction('RECOVER_ATTEMPT', { incidentId, action });

      return {
        success: true,
        decision,
        action
      };
    } catch (error: any) {
      console.error(`Recovery failed for ${incidentId}:`, error.message);
      return {
        success: false
      };
    }
  }

  private async simulateGatewayCall(decision: RecoveryDecision): Promise<{ status: RecoveryActionResult; details: string }> {
    // Simulation: 30% success rate for demo purposes
    const isSuccess = Math.random() < 0.3;
    return {
      status: isSuccess ? RecoveryActionResult.SUCCESS : RecoveryActionResult.FAILED,
      details: isSuccess ? 'Payment successfully processed' : 'Gateway returned failure: Insufficient funds'
    };
  }
}
