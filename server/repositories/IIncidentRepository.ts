import {
  LtvTier,
  IncidentStatus,
  RecoveryRail,
  RecoveryActionResult,
  PaymentMethod
} from '../types.js';

import type {
  Customer,
  Incident,
  RecoveryAction,
  AuditLog
} from '../types.js';

export {
  LtvTier,
  IncidentStatus,
  RecoveryRail,
  RecoveryActionResult,
  PaymentMethod
};

export type {
  Customer,
  Incident,
  RecoveryAction,
  AuditLog
};

export interface IIncidentRepository {
  // Customer
  getCustomerById(id: string): Promise<Customer | null>;
  createCustomer(data: { name: string; email: string; ltvTier: LtvTier }): Promise<Customer>;

  // Incident
  getIncidentById(id: string): Promise<Incident | null>;
  createIncident(data: { customerId: string }): Promise<Incident>;
  updateIncident(id: string, data: Partial<Incident>): Promise<Incident>;
  listIncidents(filters: {
    status?: IncidentStatus;
    customerId?: string;
    bank?: string;
    originalMethod?: PaymentMethod; // Filter by original failed method
    recoveryRail?: RecoveryRail;    // Filter by a specific recovery action attempted
    cause?: string;
    startTime?: Date;
    endTime?: Date;
  }): Promise<Incident[]>;

  // Recovery Action
  addRecoveryAction(data: {
    incidentId: string;
    rail: RecoveryRail;
    result: RecoveryActionResult;
    details?: string;
    attemptNumber: number
  }): Promise<RecoveryAction>;
  getActionsByIncidentId(incidentId: string): Promise<RecoveryAction[]>;
  getActionByIncidentAndAttempt(incidentId: string, attemptNumber: number): Promise<RecoveryAction | null>;

  // CRM/Retention Logic
  getRecentFailureCountForCustomer(customerId: string, windowStart: Date): Promise<number>;

  // Audit Log
  createAuditEntry(data: {
    previousHash: string | null;
    hash: string;
    action: string;
    payload: any
  }): Promise<AuditLog>;
  getLatestAuditEntry(): Promise<AuditLog | null>;
  getAuditChain(): Promise<AuditLog[]>;
}
