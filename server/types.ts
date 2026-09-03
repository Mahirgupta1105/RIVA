export enum LtvTier {
  STARTER = 'STARTER',
  PRO = 'PRO',
  ENTERPRISE = 'ENTERPRISE',
}

export enum IncidentStatus {
  DETECTED = 'DETECTED',
  CLASSIFIED = 'CLASSIFIED',
  RECOVERY_IN_PROGRESS = 'RECOVERY_IN_PROGRESS',
  RECOVERED = 'RECOVERED',
  ESCALATED = 'ESCALATED',
  CLOSED = 'CLOSED',
}

export enum RecoveryRail {
  SAME_RAIL = 'SAME_RAIL',
  UPI_INTENT = 'UPI_INTENT',
  WHATSAPP_LINK = 'WHATSAPP_LINK',
  ALTERNATE_RAIL = 'ALTERNATE_RAIL',
}

export enum PaymentMethod {
  UPI = 'UPI',
  CARD = 'CARD',
  NETBANKING = 'NETBANKING',
  WALLET = 'WALLET',
}

export enum RecoveryActionResult {
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
  PENDING = 'PENDING',
  SKIPPED = 'SKIPPED',
  PENDING_REVIEW = 'PENDING_REVIEW',
}

export enum Severity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

export enum TransactionStatus {
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
  PENDING = 'PENDING',
  RECOVERED = 'RECOVERED',
}

export interface Customer {
  id: string;
  name: string;
  email: string;
  ltvTier: LtvTier;
  lifetimeValue: number;
  incidents?: Incident[];
  transactions?: Transaction[];
}

export interface Incident {
  id: string;
  customerId: string;
  status: IncidentStatus;
  cause?: string;
  bank?: string;
  originalMethod?: PaymentMethod;
  classificationSource?: string;
  amount: number;
  orderId?: string;
  transactionId?: string;
  gateway?: string;
  errorCode?: string;
  errorMessage?: string;
  severity: Severity;
  recoverability: number;
  retryCount: number;
  createdAt: Date;
  updatedAt: Date;
  actions?: RecoveryAction[];
}

export interface RecoveryAction {
  id: string;
  incidentId: string;
  rail: RecoveryRail;
  result: RecoveryActionResult;
  details?: string | null;
  attemptNumber: number;
  duration?: number | null;
  timestamp: Date;
}

export interface Transaction {
  id: string;
  customerId: string;
  amount: number;
  method: PaymentMethod;
  bank?: string;
  gateway?: string;
  status: TransactionStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuditLog {
  id: string;
  previousHash?: string;
  hash: string;
  action: string;
  actor: string;
  payload: any;
  timestamp: Date;
}
