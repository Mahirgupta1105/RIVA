import { PrismaClient, Severity, TransactionStatus, LtvTier } from '@prisma/client';
import crypto from 'crypto';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database for Production Command Center...');

  // Clean existing data
  await prisma.recoveryAction.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.incident.deleteMany();
  await prisma.transaction.deleteMany();
  await prisma.customer.deleteMany();

  // Create Customers with LTV
  const customers = await Promise.all([
    prisma.customer.create({ data: { name: 'Alice Johnson', email: 'alice@example.com', ltvTier: LtvTier.ENTERPRISE, lifetimeValue: 150000.0 } }),
    prisma.customer.create({ data: { name: 'Bob Smith', email: 'bob@example.com', ltvTier: LtvTier.PRO, lifetimeValue: 45000.0 } }),
    prisma.customer.create({ data: { name: 'Charlie Brown', email: 'charlie@example.com', ltvTier: LtvTier.STARTER, lifetimeValue: 5000.0 } }),
    prisma.customer.create({ data: { name: 'Diana Prince', email: 'diana@example.com', ltvTier: LtvTier.ENTERPRISE, lifetimeValue: 280000.0 } }),
    prisma.customer.create({ data: { name: 'Ethan Hunt', email: 'ethan@example.com', ltvTier: LtvTier.PRO, lifetimeValue: 12000.0 } }),
  ]);

  const scenarioData = [
    {
      customer: customers[0],
      amount: 38500.0,
      orderId: 'ORD-2026-1001',
      transactionId: 'TXN-HDFC-001',
      gateway: 'Razorpay',
      errorCode: 'INS_FUNDS',
      errorMessage: 'Insufficient funds in account',
      cause: 'INSUFFICIENT_FUNDS',
      severity: Severity.HIGH,
      recoverability: 0.45,
      status: 'RECOVERY_IN_PROGRESS',
      bank: 'HDFC',
      actions: [
        { rail: 'SAME_RAIL', result: 'FAILED', details: 'Insufficient funds in account', attemptNumber: 1 }
      ]
    },
    {
      customer: customers[1],
      amount: 12000.0,
      orderId: 'ORD-2026-1002',
      transactionId: 'TXN-ICICI-002',
      gateway: 'Stripe',
      errorCode: 'MANDATE_EXP',
      errorMessage: 'E-mandate has expired',
      cause: 'MANDATE_EXPIRED',
      severity: Severity.MEDIUM,
      recoverability: 0.88,
      status: 'RECOVERED',
      bank: 'ICICI',
      actions: [
        { rail: 'WHATSAPP_LINK', result: 'SUCCESS', details: 'Customer re-authorized via WhatsApp', attemptNumber: 1 }
      ]
    },
    {
      customer: customers[2],
      amount: 1500.0,
      orderId: 'ORD-2026-1003',
      transactionId: 'TXN-SBI-003',
      gateway: 'Cashfree',
      errorCode: 'TIMEOUT_504',
      errorMessage: 'Bank gateway timeout',
      cause: 'BANK_GATEWAY_DOWN',
      severity: Severity.LOW,
      recoverability: 0.95,
      status: 'CLASSIFIED',
      bank: 'SBI',
      actions: []
    },
    {
      customer: customers[3],
      amount: 125000.0,
      orderId: 'ORD-2026-1004',
      transactionId: 'TXN-AXIS-004',
      gateway: 'Razorpay',
      errorCode: 'RISK_BLOCKED',
      errorMessage: 'Transaction blocked by risk engine',
      cause: 'RISK_BLOCKED',
      severity: Severity.CRITICAL,
      recoverability: 0.15,
      status: 'ESCALATED',
      bank: 'AXIS',
      actions: [
        { rail: 'ALTERNATE_RAIL', result: 'FAILED', details: 'Risk engine blocked alternate rail attempt', attemptNumber: 1 }
      ]
    },
    {
      customer: customers[4],
      amount: 8200.0,
      orderId: 'ORD-2026-1005',
      transactionId: 'TXN-HDFC-005',
      gateway: 'Stripe',
      errorCode: 'OTP_TIMEOUT',
      errorMessage: 'OTP expired before entry',
      cause: 'UPI_APP_TIMEOUT',
      severity: Severity.MEDIUM,
      recoverability: 0.75,
      status: 'RECOVERY_IN_PROGRESS',
      bank: 'HDFC',
      actions: [
        { rail: 'SAME_RAIL', result: 'FAILED', details: 'OTP expired', attemptNumber: 1 },
        { rail: 'SAME_RAIL', result: 'FAILED', details: 'Incorrect OTP entered', attemptNumber: 2 }
      ]
    }
  ];

  for (const scenario of scenarioData) {
    // Create a transaction for this incident
    await prisma.transaction.create({
      data: {
        customerId: scenario.customer.id,
        amount: scenario.amount,
        method: 'UPI',
        bank: scenario.bank,
        gateway: scenario.gateway,
        status: TransactionStatus.FAILED,
      }
    });

    const incident = await prisma.incident.create({
      data: {
        customerId: scenario.customer.id,
        status: scenario.status,
        cause: scenario.cause,
        bank: scenario.bank,
        classificationSource: 'AI',
        amount: scenario.amount,
        orderId: scenario.orderId,
        transactionId: scenario.transactionId,
        gateway: scenario.gateway,
        errorCode: scenario.errorCode,
        errorMessage: scenario.errorMessage,
        severity: scenario.severity,
        recoverability: scenario.recoverability,
        actions: {
          create: scenario.actions
        }
      }
    });

    // Create a corresponding audit log for the classification
    await prisma.auditLog.create({
      data: {
        action: 'CLASSIFY',
        actor: 'AI',
        payload: { incidentId: incident.id, cause: scenario.cause },
        hash: crypto.createHash('sha256').update(incident.id + scenario.cause).digest('hex')
      }
    });
  }

  console.log('✅ Production seed completed successfully.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
