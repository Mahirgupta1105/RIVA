import {
  RecoveryRail,
  RecoveryActionResult,
  IncidentStatus,
  LtvTier
} from '../repositories/IIncidentRepository.js';

import type {
  IIncidentRepository,
  Incident,
  Customer
} from '../repositories/IIncidentRepository.js';

export interface RecoveryDecision {
  action: RecoveryRail;
  isRetentionPath: boolean;
  discount?: number;
  message?: string;
  delayMs: number;
}

export class RecoveryEngine {
  private readonly MAX_RETRIES = 3;
  private readonly MAX_DISCOUNT = 0.05;
  private readonly BASE_DELAY_MS = 1000; // 1 second base for demo

  // Simple in-memory tracker for systemic pauses (bank + method)
  // Key: "BANK|METHOD", Value: count of recent failures
  private systemicFailures: Map<string, number> = new Map();
  private systemicPauseThreshold = 5;

  constructor(private repository: IIncidentRepository) {}

  /**
   * Determines the next recovery action for an incident.
   */
  async determineNextAction(incident: Incident, customer: Customer): Promise<RecoveryDecision | null> {
    const actions = incident.actions;
    const attemptNumber = actions.length + 1;

    if (attemptNumber > this.MAX_RETRIES) {
      return null; // Max retries reached, move to ESCALATED
    }

    // 1. Check for Systemic Pause (Bank + Method)
    if (this.isSystemicallyPaused(incident)) {
      return null; // Route to escalation due to systemic failure
    }

    // 2. Determine if this is a Retention Path (High LTV + Repeated Failures)
    const isHighValue = customer.ltvTier === LtvTier.ENTERPRISE || customer.ltvTier === LtvTier.PRO;
    const hasRepeatedFailures = attemptNumber >= 2;
    const useRetentionPath = isHighValue && hasRepeatedFailures;

    // 3. Determine Rail (Prioritize cause-based mapping, then fallback to attempt cascade)
    const causeRail = this.getRailForCause(incident.cause);
    const rail = causeRail || this.getRailForAttempt(attemptNumber);

    // 4. Calculate Exponential Backoff
    const delayMs = this.calculateBackoff(attemptNumber);

    // 5. Define Action Details (Standard vs Retention)
    let discount = 0;
    let message = 'Payment failed. Please try again.';

    if (useRetentionPath) {
      // Retention: Bounded discount or personalized nudge
      discount = this.MAX_DISCOUNT;
      message = `We value your business. Use code RETENTION5 for 5% off your next attempt.`;
    }

    return {
      action: rail,
      isRetentionPath: useRetentionPath,
      discount,
      message,
      delayMs
    };
  }

  private getRailForCause(cause?: string): RecoveryRail | null {
    if (!cause) return null;

    switch (cause) {
      case 'TECHNICAL_ERROR':
        return RecoveryRail.SAME_RAIL;
      case 'UPI_APP_TIMEOUT':
        return RecoveryRail.UPI_INTENT;
      case 'MANDATE_EXPIRED':
      case 'AUTH_FAILURE_3DS':
        return RecoveryRail.WHATSAPP_LINK;
      case 'BANK_GATEWAY_DOWN':
      case 'RISK_BLOCKED':
      case 'TOKENIZATION_ERROR':
        return RecoveryRail.ALTERNATE_RAIL;
      default:
        return null;
    }
  }

  private getRailForAttempt(attempt: number): RecoveryRail {
    switch (attempt) {
      case 1: return RecoveryRail.SAME_RAIL;
      case 2: return RecoveryRail.UPI_INTENT;
      case 3: return RecoveryRail.WHATSAPP_LINK;
      default: return RecoveryRail.ALTERNATE_RAIL;
    }
  }

  private calculateBackoff(attempt: number): number {
    // Exponential backoff: base * 2^(attempt-1)
    return this.BASE_DELAY_MS * Math.pow(2, attempt - 1);
  }

  private isSystemicallyPaused(incident: Incident): boolean {
    if (!incident.bank || !incident.originalMethod) return false;

    const key = `${incident.bank}|${incident.originalMethod}`;
    const failures = this.systemicFailures.get(key) || 0;

    return failures >= this.systemicPauseThreshold;
  }

  /**
   * Tracks a failure to update systemic pause metrics.
   */
  async recordFailure(incident: Incident): Promise<void> {
    if (!incident.bank || !incident.originalMethod) return;

    const key = `${incident.bank}|${incident.originalMethod}`;
    const current = this.systemicFailures.get(key) || 0;
    this.systemicFailures.set(key, current + 1);
  }

  /**
   * Resets systemic failures when a recovery is successful.
   */
  async recordSuccess(incident: Incident): Promise<void> {
    if (!incident.bank || !incident.originalMethod) return;

    const key = `${incident.bank}|${incident.originalMethod}`;
    this.systemicFailures.delete(key);
  }
}
