import {
  LtvTier,
  IncidentStatus,
  RecoveryRail,
  RecoveryActionResult,
  PaymentMethod
} from './IIncidentRepository.js';

import type {
  IIncidentRepository,
  Customer,
  Incident,
  RecoveryAction,
  AuditLog
} from './IIncidentRepository.js';
import { v4 as uuidv4 } from 'uuid';

export class InMemoryRepository implements IIncidentRepository {
  private customers: Map<string, Customer> = new Map();
  private incidents: Map<string, Incident> = new Map();
  private actions: RecoveryAction[] = [];
  private auditLog: AuditLog[] = [];

  async getCustomerById(id: string): Promise<Customer | null> {
    return this.customers.get(id) || null;
  }

  async createCustomer(data: { name: string; email: string; ltvTier: LtvTier }): Promise<Customer> {
    const customer: Customer = {
      id: uuidv4(),
      ...data,
      incidents: [],
    };
    this.customers.set(customer.id, customer);
    return customer;
  }

  async getIncidentById(id: string): Promise<Incident | null> {
    return this.incidents.get(id) || null;
  }

  async createIncident(data: { customerId: string }): Promise<Incident> {
    const incident: Incident = {
      id: uuidv4(),
      ...data,
      status: IncidentStatus.DETECTED,
      cause: undefined,
      bank: undefined,
      originalMethod: undefined,
      classificationSource: undefined,
      createdAt: new Date(),
      updatedAt: new Date(),
      actions: [],
    };
    this.incidents.set(incident.id, incident);
    return incident;
  }

  async updateIncident(id: string, data: Partial<Incident>): Promise<Incident> {
    const incident = this.incidents.get(id);
    if (!incident) throw new Error(`Incident ${id} not found`);

    const updated = { ...incident, ...data, updatedAt: new Date() };
    this.incidents.set(id, updated);
    return updated;
  }

  async listIncidents(filters: {
    status?: IncidentStatus;
    customerId?: string;
    bank?: string;
    originalMethod?: PaymentMethod;
    recoveryRail?: RecoveryRail;
    cause?: string;
    startTime?: Date;
    endTime?: Date;
  }): Promise<Incident[]> {
    return Array.from(this.incidents.values()).filter(i => {
      if (filters.status && i.status !== filters.status) return false;
      if (filters.customerId && i.customerId !== filters.customerId) return false;
      if (filters.bank && i.bank !== filters.bank) return false;
      if (filters.originalMethod && i.originalMethod !== filters.originalMethod) return false;
      if (filters.cause && i.cause !== filters.cause) return false;
      if (filters.startTime && i.createdAt < filters.startTime) return false;
      if (filters.endTime && i.createdAt > filters.endTime) return false;

      // Recovery rail filter is a bit different as it's based on associated actions
      if (filters.recoveryRail) {
        const hasRail = i.actions?.some(a => a.rail === filters.recoveryRail);
        if (!hasRail) return false;
      }

      return true;
    });
  }

  async addRecoveryAction(data: {
    incidentId: string;
    rail: RecoveryRail;
    result: RecoveryActionResult;
    details?: string;
    attemptNumber: number
  }): Promise<RecoveryAction> {
    // Idempotency check
    const exists = await this.getActionByIncidentAndAttempt(data.incidentId, data.attemptNumber);
    if (exists) throw new Error(`Duplicate recovery attempt detected for incident ${data.incidentId} attempt ${data.attemptNumber}`);

    const action: RecoveryAction = {
      id: uuidv4(),
      ...data,
      timestamp: new Date(),
    };

    this.actions.push(action);
    return action;
  }

  async getActionsByIncidentId(incidentId: string): Promise<RecoveryAction[]> {
    return this.actions.filter(a => a.incidentId === incidentId);
  }

  async getActionByIncidentAndAttempt(incidentId: string, attemptNumber: number): Promise<RecoveryAction | null> {
    return this.actions.find(a => a.incidentId === incidentId && a.attemptNumber === attemptNumber) || null;
  }

  async getRecentFailureCountForCustomer(customerId: string, windowStart: Date): Promise<number> {
    return Array.from(this.incidents.values()).filter(i =>
      i.customerId === customerId &&
      i.createdAt >= windowStart &&
      i.status !== IncidentStatus.RECOVERED
    ).length;
  }

  async createAuditEntry(data: {
    previousHash: string | null;
    hash: string;
    action: string;
    payload: any
  }): Promise<AuditLog> {
    const entry: AuditLog = {
      id: uuidv4(),
      ...data,
      previousHash: data.previousHash ?? undefined,
      timestamp: new Date(),
    };
    this.auditLog.push(entry);
    return entry;
  }

  async getLatestAuditEntry(): Promise<AuditLog | null> {
    return this.auditLog[this.auditLog.length - 1] || null;
  }

  async getAuditChain(): Promise<AuditLog[]> {
    return [...this.auditLog];
  }
}
