import { IIncidentRepository } from '../repositories/IIncidentRepository.js';
import {
  ForensicEngine,
  ForensicResult
} from './ForensicEngine.js';
import {
  RecoveryEngine,
  RecoveryDecision
} from './RecoveryEngine.js';
import {
  IncidentStatus,
  RecoveryActionResult
} from '../types.js';
import { AuditHashService } from './AuditHashService.js';
import { WhatsAppSimulationService } from './WhatsAppSimulationService.js';

export class IncidentService {
  constructor(
    private repository: IIncidentRepository,
    private forensicEngine: ForensicEngine,
    private recoveryEngine: RecoveryEngine,
    private whatsappService: WhatsAppSimulationService
  ) {}

  /**
   * Creates a tamper-evident audit-chain entry.
   */
  private async logAction(
    action: string,
    payload: any
  ): Promise<void> {
    const latest =
      await this.repository.getLatestAuditEntry();

    const prevHash =
      latest?.hash || '0'.repeat(64);

    const timestamp =
      new Date().toISOString();

    const hash =
      AuditHashService.generateHash(
        prevHash,
        action,
        payload,
        timestamp
      );

    await this.repository.createAuditEntry({
      previousHash: prevHash,
      hash,
      action,
      actor: 'RIVA_SYSTEM',
      payload,
      timestamp: new Date(timestamp)
    });
  }

  /**
   * RIVA Agent 1:
   * Determines what went wrong with the payment.
   */
  async classifyIncident(
    incidentId: string,
    rawErrorMessage: string
  ): Promise<{
    success: boolean;
    result?: ForensicResult;
  }> {
    try {
      const incident =
        await this.repository.getIncidentById(
          incidentId
        );

      if (!incident) {
        throw new Error(
          `Incident ${incidentId} not found`
        );
      }

      if (
        incident.status !==
        IncidentStatus.DETECTED
      ) {
        throw new Error(
          `Incident ${incidentId} is in status ${incident.status}, ` +
          `but classification requires status DETECTED`
        );
      }

      const forensicResult =
        await this.forensicEngine.classify(
          incidentId,
          rawErrorMessage
        );

      await this.repository.updateIncident(
        incidentId,
        {
          cause: forensicResult.category,
          classificationSource:
            forensicResult.source,
          status: IncidentStatus.CLASSIFIED
        }
      );

      await this.logAction(
        'CLASSIFY',
        {
          incidentId,
          result: forensicResult
        }
      );

      return {
        success: true,
        result: forensicResult
      };
    } catch (error: any) {
      console.error(
        `Failed to classify incident ${incidentId}:`,
        error
      );

      return {
        success: false
      };
    }
  }

  /**
   * Executes the next step in the recovery cascade.
   *
   * RIVA Agent 2:
   * Determines and executes the next recovery strategy.
   */
  async executeRecoveryStep(
    incidentId: string
  ): Promise<{
    success: boolean;
    decision?: RecoveryDecision;
    action?: any;
  }> {
    try {
      const incident =
        await this.repository.getIncidentById(
          incidentId
        );

      if (!incident) {
        throw new Error(
          `Incident ${incidentId} not found`
        );
      }

      const customer =
        await this.repository.getCustomerById(
          incident.customerId
        );

      if (!customer) {
        throw new Error(
          `Customer ${incident.customerId} not found`
        );
      }

      /*
       * RIVA Agent 2
       *
       * Determine the next recovery action.
       */
      const decision =
        await this.recoveryEngine.determineNextAction(
          incident,
          customer
        );

      /*
       * No decision means:
       * - maximum retries reached, or
       * - systemic failure detected.
       */
      if (!decision) {
        await this.repository.updateIncident(
          incidentId,
          {
            status: IncidentStatus.ESCALATED
          }
        );

        await this.logAction(
          'ESCALATE',
          {
            incidentId,
            reason: 'MAX_RETRIES_OR_PAUSE'
          }
        );

        return {
          success: false
        };
      }

      /*
       * Idempotency check.
       */
      const attemptNumber =
        (incident.actions?.length || 0) + 1;

      const existing =
        await this.repository.getActionByIncidentAndAttempt(
          incidentId,
          attemptNumber
        );

      if (existing) {
        throw new Error(
          `Idempotency violation: Attempt ${attemptNumber} already exists`
        );
      }

      /*
       * Execute Agent 2 decision.
       *
       * WHATSAPP_LINK is handled by the
       * dedicated WhatsApp simulation service.
       */
      let result: {
        status: RecoveryActionResult;
        details: string;
      };

      if (
        decision.action === 'WHATSAPP_LINK'
      ) {
        const whatsappResult =
          await this.whatsappService.simulateRecoveryMessage(
            incident.customerId,
            incident.amount,
            incident.id
          );

        result = {
          status:
            whatsappResult.success
              ? RecoveryActionResult.SUCCESS
              : RecoveryActionResult.FAILED,

          details:
            whatsappResult.success
              ? `WhatsApp recovery message simulated successfully. ` +
                `Recovery link: ${whatsappResult.recoveryLink}`
              : 'WhatsApp recovery simulation failed'
        };
      } else {
        result =
          await this.simulateGatewayCall(
            decision
          );
      }

      /*
       * Persist recovery action.
       */
      const action =
        await this.repository.addRecoveryAction({
          incidentId,
          rail: decision.action,
          result: result.status,
          details: result.details,
          attemptNumber
        });

      /*
       * Update incident status and systemic metrics.
       */
      if (
        result.status ===
        RecoveryActionResult.SUCCESS
      ) {
        await this.repository.updateIncident(
          incidentId,
          {
            status: IncidentStatus.RECOVERED
          }
        );

        await this.recoveryEngine.recordSuccess(
          incident
        );
      } else {
        await this.repository.updateIncident(
          incidentId,
          {
            status:
              IncidentStatus.RECOVERY_IN_PROGRESS
          }
        );

        await this.recoveryEngine.recordFailure(
          incident
        );
      }

      /*
       * Record Agent 2 decision and execution
       * in the tamper-evident audit chain.
       */
      await this.logAction(
  'RECOVER_ATTEMPT',
  {
    incidentId,
    decision: {
      action: decision.action,
      confidence: decision.confidence,
      reasoning: decision.reasoning,
      isRetentionPath: decision.isRetentionPath,
      discount: decision.discount,
      delayMs: decision.delayMs
    },
    action: {
      id: action.id,
      incidentId: action.incidentId,
      rail: action.rail,
      result: action.result,
      details: action.details,
      attemptNumber: action.attemptNumber
    }
  }
);

      return {
        success: true,
        decision,
        action
      };
    } catch (error: any) {
      console.error(
        `Recovery failed for ${incidentId}:`,
        error?.message
      );

      return {
        success: false
      };
    }
  }

  /**
   * Simulates a payment gateway call
   * for non-WhatsApp recovery rails.
   */
  private async simulateGatewayCall(
    decision: RecoveryDecision
  ): Promise<{
    status: RecoveryActionResult;
    details: string;
  }> {
    console.log(
      'RIVA Agent 2 executing:',
      decision.action
    );

    console.log(
      'Agent 2 confidence:',
      decision.confidence
    );

    console.log(
      'Agent 2 reasoning:',
      decision.reasoning
    );

    const isSuccess =
      Math.random() < 0.3;

    return {
      status: isSuccess
        ? RecoveryActionResult.SUCCESS
        : RecoveryActionResult.FAILED,

      details: isSuccess
        ? 'Payment successfully processed'
        : 'Gateway returned failure: Insufficient funds'
    };
  }
}