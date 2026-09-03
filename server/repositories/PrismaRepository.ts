import { PrismaClient,
  Customer,
  Incident,
  RecoveryAction,
  AuditLog,
  LtvTier,
  IncidentStatus,
  RecoveryRail,
  RecoveryActionResult,
  PaymentMethod
} from '@prisma/client';
import { IIncidentRepository } from './IIncidentRepository.js';

export class PrismaRepository implements IIncidentRepository {
  private prisma = new PrismaClient();

  async getCustomerById(id: string): Promise<Customer | null> {
    return this.prisma.customer.findUnique({ where: { id } });
  }

  async createCustomer(data: { name: string; email: string; ltvTier: LtvTier }): Promise<Customer> {
    return this.prisma.customer.create({ data });
  }

  async getIncidentById(id: string): Promise<Incident | null> {
    return this.prisma.incident.findUnique({ where: { id } });
  }

  async createIncident(data: { customerId: string }): Promise<Incident> {
    return this.prisma.incident.create({ data });
  }

  async updateIncident(id: string, data: Partial<Incident>): Promise<Incident> {
    return this.prisma.incident.update({
      where: { id },
      data,
    });
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
    const where: any = {};

    if (filters.status) where.status = filters.status;
    if (filters.customerId) where.customerId = filters.customerId;
    if (filters.bank) where.bank = filters.bank;
    if (filters.originalMethod) where.originalMethod = filters.originalMethod;
    if (filters.cause) where.cause = filters.cause;

    if (filters.startTime || filters.endTime) {
      where.createdAt = {};
      if (filters.startTime) where.createdAt.gte = filters.startTime;
      if (filters.endTime) where.createdAt.lte = filters.endTime;
    }

    if (filters.recoveryRail) {
      where.actions = {
        some: { rail: filters.recoveryRail }
      };
    }

    return this.prisma.incident.findMany({ where });
  }

  async addRecoveryAction(data: {
    incidentId: string;
    rail: RecoveryRail;
    result: RecoveryActionResult;
    details?: string;
    attemptNumber: number
  }): Promise<RecoveryAction> {
    return this.prisma.recoveryAction.create({ data });
  }

  async getActionsByIncidentId(incidentId: string): Promise<RecoveryAction[]> {
    return this.prisma.recoveryAction.findMany({
      where: { incidentId },
      orderBy: { attemptNumber: 'asc' }
    });
  }

  async getActionByIncidentAndAttempt(incidentId: string, attemptNumber: number): Promise<RecoveryAction | null> {
    return this.prisma.recoveryAction.findUnique({
      where: {
        incidentId_attemptNumber: { incidentId, attemptNumber }
      }
    });
  }

  async getRecentFailureCountForCustomer(customerId: string, windowStart: Date): Promise<number> {
    return this.prisma.incident.count({
      where: {
        customerId,
        createdAt: { gte: windowStart },
        NOT: { status: IncidentStatus.RECOVERED }
      }
    });
  }

  async createAuditEntry(data: {
    previousHash: string | null;
    hash: string;
    action: string;
    payload: any
  }): Promise<AuditLog> {
    return this.prisma.auditLog.create({ data });
  }

  async getLatestAuditEntry(): Promise<AuditLog | null> {
    return this.prisma.auditLog.findFirst({
      orderBy: { timestamp: 'desc' }
    });
  }

  async getAuditChain(): Promise<AuditLog[]> {
    return this.prisma.auditLog.findMany({
      orderBy: { timestamp: 'asc' }
    });
  }
}
