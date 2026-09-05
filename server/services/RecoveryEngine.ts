import {
  RecoveryRail,
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
  confidence: number;
  reasoning: string;
}

export class RecoveryEngine {
  private readonly MAX_RETRIES = 3;
  private readonly MAX_DISCOUNT = 0.05;
  private readonly BASE_DELAY_MS = 1000;

  private systemicFailures: Map<string, number> = new Map();
  private systemicPauseThreshold = 5;

  constructor(private repository: IIncidentRepository) {}

  /**
   * RIVA Agent 2:
   * Determines the safest and most appropriate recovery strategy.
   */
  async determineNextAction(
    incident: Incident,
    customer: Customer
  ): Promise<RecoveryDecision | null> {

    const actions = incident.actions || [];
    const attemptNumber = actions.length + 1;

    // Maximum recovery attempts reached.
    if (attemptNumber > this.MAX_RETRIES) {
      return null;
    }

    // Pause recovery when repeated systemic failures are detected.
    if (this.isSystemicallyPaused(incident)) {
      return null;
    }

    // Determine whether this customer requires a retention strategy.
    const isHighValue =
      customer.ltvTier === LtvTier.ENTERPRISE ||
      customer.ltvTier === LtvTier.PRO;

    const hasRepeatedFailures = attemptNumber >= 2;

    const useRetentionPath =
      isHighValue && hasRepeatedFailures;

    // Select recovery rail.
    const causeRail = this.getRailForCause(incident.cause);

    const rail =
      causeRail || this.getRailForAttempt(attemptNumber);

    // Calculate retry delay.
    const delayMs =
      this.calculateBackoff(attemptNumber);

    let discount = 0;

    let message =
      'Payment failed. Please try again.';

    let confidence = 0.70;

    let reasoning =
      `RIVA selected ${rail} for recovery attempt ${attemptNumber}.`;

    // Cause-specific intelligence.
    switch (incident.cause) {

      case 'BANK_GATEWAY_DOWN':
        confidence = 0.95;

        reasoning =
          'The primary bank gateway appears unavailable. ' +
          'RIVA selected an alternate recovery rail to avoid repeating the failed route.';

        message =
          'The payment gateway is temporarily unavailable. ' +
          'Please retry using the alternate payment method.';

        break;

      case 'UPI_APP_TIMEOUT':
        confidence = 0.90;

        reasoning =
          'The UPI payment session timed out. ' +
          'RIVA selected a fresh UPI intent instead of retrying the expired session.';

        message =
          'Your UPI session expired. Please start a new payment attempt.';

        break;

      case 'AUTH_FAILURE_3DS':
        confidence = 0.88;

        reasoning =
          'The payment authentication or 3DS step failed. ' +
          'RIVA selected an alternate recovery channel.';

        message =
          'Payment authentication failed. Please try another payment method.';

        break;

      case 'MANDATE_EXPIRED':
        confidence = 0.88;

        reasoning =
          'The payment mandate has expired. ' +
          'RIVA selected a recovery channel that can initiate a fresh authorization.';

        message =
          'Your payment authorization has expired. Please authorize the payment again.';

        break;

      case 'RISK_BLOCKED':
        confidence = 0.92;

        reasoning =
          'The transaction was blocked by risk controls. ' +
          'RIVA avoided an immediate same-rail retry and selected an alternate recovery path.';

        message =
          'The transaction could not be completed through the current payment route.';

        break;

      case 'TOKENIZATION_ERROR':
        confidence = 0.90;

        reasoning =
          'The payment token could not be processed. ' +
          'RIVA selected an alternate payment rail.';

        message =
          'The saved payment method could not be processed. Please try another method.';

        break;

      case 'TECHNICAL_ERROR':
        confidence = 0.85;

        reasoning =
          'A technical payment failure was detected. ' +
          'RIVA selected a controlled retry on the same rail before escalating.';

        break;

      default:
        reasoning =
          `No specialized recovery rule matched the incident cause. ` +
          `RIVA selected ${rail} using the recovery attempt strategy.`;

        break;
    }

    // High-value customer retention strategy.
    if (useRetentionPath) {

      discount = this.MAX_DISCOUNT;

      confidence = Math.max(confidence, 0.90);

      message =
        'We value your business. ' +
        'Use code RETENTION5 for 5% off your next attempt.';

      reasoning =
        `High-value customer (${customer.ltvTier}) with repeated payment failure. ` +
        'RIVA activated the retention recovery path with a bounded incentive.';
    }

    return {
      action: rail,
      isRetentionPath: useRetentionPath,
      discount,
      message,
      delayMs,
      confidence,
      reasoning
    };
  }

  /**
   * Maps an incident cause to the most appropriate recovery rail.
   */
  private getRailForCause(
    cause?: string
  ): RecoveryRail | null {

    if (!cause) {
      return null;
    }

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

  /**
   * Fallback recovery sequence.
   */
  private getRailForAttempt(
    attempt: number
  ): RecoveryRail {

    switch (attempt) {

      case 1:
        return RecoveryRail.SAME_RAIL;

      case 2:
        return RecoveryRail.UPI_INTENT;

      case 3:
        return RecoveryRail.WHATSAPP_LINK;

      default:
        return RecoveryRail.ALTERNATE_RAIL;
    }
  }

  /**
   * Exponential backoff.
   */
  private calculateBackoff(
    attempt: number
  ): number {

    return this.BASE_DELAY_MS *
      Math.pow(2, attempt - 1);
  }

  /**
   * Determines whether a bank/payment-method combination
   * is experiencing repeated systemic failures.
   */
  private isSystemicallyPaused(
    incident: Incident
  ): boolean {

    if (
      !incident.bank ||
      !incident.originalMethod
    ) {
      return false;
    }

    const key =
      `${incident.bank}|${incident.originalMethod}`;

    const failures =
      this.systemicFailures.get(key) || 0;

    return failures >= this.systemicPauseThreshold;
  }

  /**
   * Record a failed recovery attempt.
   */
  async recordFailure(
    incident: Incident
  ): Promise<void> {

    if (
      !incident.bank ||
      !incident.originalMethod
    ) {
      return;
    }

    const key =
      `${incident.bank}|${incident.originalMethod}`;

    const current =
      this.systemicFailures.get(key) || 0;

    this.systemicFailures.set(
      key,
      current + 1
    );
  }

  /**
   * Reset systemic failure tracking after success.
   */
  async recordSuccess(
    incident: Incident
  ): Promise<void> {

    if (
      !incident.bank ||
      !incident.originalMethod
    ) {
      return;
    }

    const key =
      `${incident.bank}|${incident.originalMethod}`;

    this.systemicFailures.delete(key);
  }
}