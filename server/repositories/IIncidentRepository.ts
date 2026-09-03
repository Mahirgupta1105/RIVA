import {
  LtvTier,
  IncidentStatus,
  RecoveryRail,
  RecoveryActionResult,
  PaymentMethod,
  TransactionStatus
} from '../types.js';

import type {
  Customer,
  Incident,
  RecoveryAction,
  AuditLog,
  Transaction
} from '../types.js';

export {
  LtvTier,
  IncidentStatus,
  RecoveryRail,
  RecoveryActionResult,
  PaymentMethod,
  TransactionStatus
};

export type {
  Customer,
  Incident,
  RecoveryAction,
  AuditLog,
  Transaction
};

export interface IIncidentRepository {
  // Customer
  getCustomerById(id: string): Promise<Customer | null>;
  listCustomers(): Promise<Customer[]>;
  createCustomer(data: { name: string; email: string; ltvTier: LtvTier; lifetimeValue: number }): Promise<Customer>;

  // Incident
  getIncidentById(id: string): Promise<Incident | null>;
  createIncident(data: { customerId: string; amount: number; orderId?: string; transactionId?: string; gateway?: string; errorCode?: string; errorMessage?: string; severity?: any; recoverability?: number }): Promise<Incident>;
  updateIncident(id: string, data: Partial<Incident>): Promise<Incident>;
  listIncidents(filters: {
    status?: IncidentStatus;
    customerId?: string;
    bank?: string;
    originalMethod?: PaymentMethod;
    recoveryRail?: RecoveryRail;
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
    attemptNumber: number;
    duration?: number;
  }): Promise<RecoveryAction>;
  getActionsByIncidentId(incidentId: string): Promise<RecoveryAction[]>;
  getActionByIncidentAndAttempt(incidentId: string, attemptNumber: number): Promise<RecoveryAction | null>;

  // Transaction
  createTransaction(data: { customerId: string; amount: number; method: PaymentMethod; bank?: string; gateway?: string; status: TransactionStatus }): Promise<Transaction>;
  listTransactions(filters: { status?: TransactionStatus; customerId?: string }): Promise<Transaction[]>;
  getTransactionById(id: string): Promise<Transaction | null>;

  // CRM/Retention Logic
  getRecentFailureCountForCustomer(customerId: string, windowStart: Date): Promise<number>;

  // Audit Log
  createAuditEntry(data: {
    previousHash: string | null;
    hash: string;
    action: string;
    actor: string;
    payload: any
  }): Promise<AuditLog>;
  getLatestAuditEntry(): Promise<AuditLog | null>;
  getAuditChain(): Promise<AuditLog[]>;
}
