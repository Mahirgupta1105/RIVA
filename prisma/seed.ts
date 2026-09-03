import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Clean existing data
  await prisma.recoveryAction.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.incident.deleteMany();
  await prisma.customer.deleteMany();

  // Create Customers
  const customers = await Promise.all([
    prisma.customer.create({ data: { name: 'Alice Johnson', email: 'alice@example.com', ltvTier: 'ENTERPRISE' } }),
    prisma.customer.create({ data: { name: 'Bob Smith', email: 'bob@example.com', ltvTier: 'PRO' } }),
    prisma.customer.create({ data: { name: 'Charlie Brown', email: 'charlie@example.com', ltvTier: 'STARTER' } }),
    prisma.customer.create({ data: { name: 'Diana Prince', email: 'diana@example.com', ltvTier: 'ENTERPRISE' } }),
    prisma.customer.create({ data: { name: 'Ethan Hunt', email: 'ethan@example.com', ltvTier: 'PRO' } }),
  ]);

  const scenarioData = [
    {
      customer: customers[0],
      cause: 'INSUFFICIENT_FUNDS',
      status: 'RECOVERY_IN_PROGRESS',
      bank: 'HDFC',
      actions: [
        { rail: 'SAME_RAIL', result: 'FAILED', details: 'Insufficient funds in account', attemptNumber: 1 }
      ]
    },
    {
      customer: customers[1],
      cause: 'MANDATE_EXPIRED',
      status: 'RECOVERED',
      bank: 'ICICI',
      actions: [
        { rail: 'WHATSAPP_LINK', result: 'SUCCESS', details: 'Customer re-authorized via WhatsApp', attemptNumber: 1 }
      ]
    },
    {
      customer: customers[2],
      cause: 'BANK_TIMEOUT',
      status: 'CLASSIFIED',
      bank: 'SBI',
      actions: []
    },
    {
      customer: customers[3],
      cause: 'RISK_BLOCKED',
      status: 'ESCALATED',
      bank: 'AXIS',
      actions: [
        { rail: 'ALTERNATE_RAIL', result: 'FAILED', details: 'Risk engine blocked alternate rail attempt', attemptNumber: 1 }
      ]
    },
    {
      customer: customers[4],
      cause: 'OTP_FAILURE',
      status: 'RECOVERY_IN_PROGRESS',
      bank: 'HDFC',
      actions: [
        { rail: 'SAME_RAIL', result: 'FAILED', details: 'OTP expired', attemptNumber: 1 },
        { rail: 'SAME_RAIL', result: 'FAILED', details: 'Incorrect OTP entered', attemptNumber: 2 }
      ]
    }
  ];

  for (const scenario of scenarioData) {
    const incident = await prisma.incident.create({
      data: {
        customerId: scenario.customer.id,
        status: scenario.status,
        cause: scenario.cause,
        bank: scenario.bank,
        classificationSource: 'AI',
        actions: {
          create: scenario.actions
        }
      }
    });

    // Create a corresponding audit log for the classification
    await prisma.auditLog.create({
      data: {
        action: 'CLASSIFY',
        payload: { incidentId: incident.id, cause: scenario.cause },
        hash: crypto.createHash('sha256').update(incident.id + scenario.cause).digest('hex')
      }
    });
  }

  console.log('✅ Seeding completed successfully.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
