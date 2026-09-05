import { PrismaClient,
  LtvTier,
  IncidentStatus,
  RecoveryRail,
  RecoveryActionResult,
  PaymentMethod,
  TransactionStatus
} from '@prisma/client';
import { IIncidentRepository, Customer, Incident, RecoveryAction, AuditLog, Transaction } from './IIncidentRepository.js';

export class PrismaRepository implements IIncidentRepository {
  private prisma = new PrismaClient();

  async getCustomerById(id: string): Promise<Customer | null> {
    return (await this.prisma.customer.findUnique({ where: { id } })) as unknown as Customer | null;
  }

  async listCustomers(): Promise<Customer[]> {
    return (await this.prisma.customer.findMany()) as unknown as Customer[];
  }

  async createCustomer(data: { name: string; email: string; ltvTier: LtvTier; lifetimeValue: number }): Promise<Customer> {
    return (await this.prisma.customer.create({ data })) as unknown as Customer;
  }

  async getIncidentById(id: string): Promise<Incident | null> {
  const incident = await this.prisma.incident.findUnique({
    where: { id },
    include: {
      actions: {
        orderBy: {
          attemptNumber: 'asc'
        }
      }
    }
  });

  return incident as unknown as Incident | null;
}

  async createIncident(data: {
    customerId: string;
    amount: number;
    orderId?: string;
    transactionId?: string;
    gateway?: string;
    errorCode?: string;
    errorMessage?: string;
    severity?: any;
    recoverability?: number
  }): Promise<Incident> {
    return (await this.prisma.incident.create({ data })) as unknown as Incident;
  }

  async updateIncident(id: string, data: Partial<Incident>): Promise<Incident> {
    const { actions, ...updateData } = data;
    return (await this.prisma.incident.update({
      where: { id },
      data: updateData,
    })) as unknown as Incident;
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

    return (await this.prisma.incident.findMany({ where })) as unknown as Incident[];
  }

  async addRecoveryAction(data: {
    incidentId: string;
    rail: RecoveryRail;
    result: RecoveryActionResult;
    details?: string;
    attemptNumber: number;
    duration?: number;
  }): Promise<RecoveryAction> {
    return (await this.prisma.recoveryAction.create({ data })) as unknown as RecoveryAction;
  }

  async getActionsByIncidentId(incidentId: string): Promise<RecoveryAction[]> {
    return (await this.prisma.recoveryAction.findMany({
      where: { incidentId },
      orderBy: { attemptNumber: 'asc' }
    })) as unknown as RecoveryAction[];
  }

  async getActionByIncidentAndAttempt(incidentId: string, attemptNumber: number): Promise<RecoveryAction | null> {
    return (await this.prisma.recoveryAction.findUnique({
      where: {
        incidentId_attemptNumber: { incidentId, attemptNumber }
      }
    })) as unknown as RecoveryAction | null;
  }

  async createTransaction(data: { customerId: string; amount: number; method: PaymentMethod; bank?: string; gateway?: string; status: TransactionStatus }): Promise<Transaction> {
    return (await this.prisma.transaction.create({ data })) as unknown as Transaction;
  }

  async listTransactions(filters: { status?: TransactionStatus; customerId?: string }): Promise<Transaction[]> {
    const where: any = {};
    if (filters.status) where.status = filters.status;
    if (filters.customerId) where.customerId = filters.customerId;
    return (await this.prisma.transaction.findMany({ where, orderBy: { createdAt: 'desc' } })) as unknown as Transaction[];
  }

  async getTransactionById(id: string): Promise<Transaction | null> {
    return (await this.prisma.transaction.findUnique({ where: { id } })) as unknown as Transaction | null;
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
  actor: string;
  payload: any;
  timestamp: Date;
}): Promise<AuditLog> {
  return (await this.prisma.auditLog.create({
    data
  })) as unknown as AuditLog;
}

  async getLatestAuditEntry(): Promise<AuditLog | null> {
    return (await this.prisma.auditLog.findFirst({
      orderBy: { timestamp: 'desc' }
    })) as unknown as AuditLog | null;
  }

  async getAuditChain(): Promise<AuditLog[]> {
    return (await this.prisma.auditLog.findMany({
      orderBy: { timestamp: 'asc' }
    })) as unknown as AuditLog[];
  }
}
