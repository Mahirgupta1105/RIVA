RIVA — Revenue Integrity & Verification Agent

RIVA is a payment recovery and revenue integrity platform designed to detect payment failures, classify their root causes, and intelligently recover failed transactions through a multi-rail recovery strategy.

Instead of repeatedly retrying the same payment method, RIVA analyzes the failure cause and selects an appropriate recovery path while maintaining a tamper-evident audit trail of system decisions and recovery actions.

⸻

Overview

Payment failures can result in lost revenue even when the underlying customer is still willing to complete the transaction.

RIVA addresses this problem through an automated recovery workflow:

Payment Failure
      ↓
Incident Detection
      ↓
Forensic Classification
      ↓
Agent 2 Recovery Intelligence
      ↓
Recovery Rail Selection
      ↓
Recovery Execution
      ↓
Audit Logging
      ↓
Incident Recovered

The system is designed around the principle that different payment failures require different recovery strategies.

⸻

Key Features

1. Incident Detection

RIVA converts failed payment events into structured recovery incidents.

Each incident can contain:

* Customer information
* Transaction information
* Gateway
* Failed amount
* Error code
* Error message
* Severity
* Recoverability
* Incident status
* Recovery history

The incident lifecycle is represented through states such as:

DETECTED
   ↓
CLASSIFIED
   ↓
RECOVERY_IN_PROGRESS
   ↓
RECOVERED

⸻

2. Forensic Engine

The Forensic Engine analyzes gateway failure messages and determines the most likely failure category.

The current implementation supports heuristic classification based on known failure patterns.

Examples include:

Failure Cause	Example Recovery
TECHNICAL_ERROR	Retry on same rail
UPI_APP_TIMEOUT	UPI Intent
MANDATE_EXPIRED	WhatsApp recovery
AUTH_FAILURE_3DS	WhatsApp recovery
BANK_GATEWAY_DOWN	Alternate rail
RISK_BLOCKED	Alternate rail
TOKENIZATION_ERROR	Alternate rail

The classification response contains:

* Failure category
* Confidence score
* Classification source
* Reasoning

Example:

{
  "category": "MANDATE_EXPIRED",
  "confidence": 0.6,
  "source": "HEURISTIC",
  "reasoning": "Matched heuristic pattern: /expired|mandate|stale/i"
}

⸻

Agent 2 — Recovery Intelligence

RIVA includes a dedicated recovery decision layer responsible for selecting the next recovery strategy.

Agent 2 considers:

* Failure cause
* Previous recovery attempts
* Maximum retry limits
* Recovery confidence
* Payment rail
* Customer retention considerations
* Potential incentive/discount
* Recovery delay

The recovery engine supports multiple recovery rails.

                    Payment Failure
                          │
                          ▼
                 Recovery Intelligence
                          │
          ┌───────────────┼───────────────┐
          ▼               ▼               ▼
      Same Rail       UPI Intent     WhatsApp Link
          │               │               │
          └───────────────┼───────────────┘
                          ▼
                    Recovery Result

Recovery Policy

The current recovery engine supports up to three recovery attempts.

Example strategy mapping:

TECHNICAL_ERROR
        ↓
    SAME_RAIL
UPI_APP_TIMEOUT
        ↓
    UPI_INTENT
MANDATE_EXPIRED
        ↓
   WHATSAPP_LINK
AUTH_FAILURE_3DS
        ↓
   WHATSAPP_LINK
BANK_GATEWAY_DOWN
        ↓
  ALTERNATE_RAIL
RISK_BLOCKED
        ↓
  ALTERNATE_RAIL
TOKENIZATION_ERROR
        ↓
  ALTERNATE_RAIL

For repeated high-value failures, the engine can enter a retention-oriented recovery path with an incentive.

⸻

WhatsApp Recovery Simulation

RIVA includes a WhatsApp recovery simulation for payment failures where sending the customer a recovery link is more appropriate than another payment retry.

The system generates a simulated recovery URL such as:

https://riva.local/recover/<recovery-id>

The WhatsApp workflow records the recovery action in the audit system.

This implementation is currently a simulation and does not require a real WhatsApp Business API integration.

⸻

Tamper-Evident Audit Chain

Every important RIVA decision and recovery action is recorded in an audit chain.

Each audit entry contains:

* Action
* Actor
* Payload
* Timestamp
* Previous hash
* Current SHA-256 hash

Conceptually:

Entry 1
   │
   ├── SHA-256
   ↓
Entry 2
   │
   ├── SHA-256
   ↓
Entry 3
   │
   ├── SHA-256
   ↓
Entry 4

Each new record references the hash of the previous record.

RIVA canonicalizes payload data before hashing so that equivalent object structures produce deterministic hash input.

The system also provides audit verification endpoints to inspect the integrity of the RIVA audit chain.

Audit Actions

Examples include:

INCIDENT_CREATED
CLASSIFY
RECOVER_ATTEMPT
WHATSAPP_RECOVERY_SIMULATED

⸻

System Architecture

RIVA follows a layered backend architecture.

                    HTTP Request
                         │
                         ▼
                       Route
                         │
                         ▼
                    Controller
                         │
                         ▼
                      Service
                         │
             ┌───────────┴───────────┐
             ▼                       ▼
          Repository               Engine
             │                       │
             └───────────┬───────────┘
                         ▼
                     Database

Backend Structure

server/
├── controllers/
│   ├── CustomerController.ts
│   ├── IncidentController.ts
│   ├── TransactionController.ts
│   ├── AuditController.ts
│   └── SystemController.ts
│
├── routes/
│   ├── customerRoutes.ts
│   ├── incidentRoutes.ts
│   ├── transactionRoutes.ts
│   ├── auditRoutes.ts
│   └── systemRoutes.ts
│
├── services/
├── repositories/
├── app.ts
└── server.ts

This separation keeps HTTP handling, business logic, persistence, and recovery logic independent from one another.

⸻

Repository Layer

RIVA supports a repository abstraction so the application can operate with different persistence implementations.

Demo Mode

Demo mode uses an in-memory repository.

This makes it possible to run and demonstrate the complete workflow without requiring a persistent database.

Database Mode

The project also includes a Prisma-based repository architecture for database-backed operation.

The application selects the repository based on the configured database mode.

Application
     │
     ▼
Repository Interface
     │
     ├── InMemoryRepository
     │
     └── PrismaRepository

⸻

Database

The project uses Prisma for database access.

The audit system contains an AuditLog model with fields including:

id
previousHash
hash
action
actor
payload
timestamp

The previousHash field allows audit records to form a linked chain.

⸻

Frontend

RIVA provides a command-center style dashboard for monitoring payment incidents and recovery operations.

The frontend provides:

* System status
* Revenue recovery KPIs
* Incident table
* Incident details
* Failure analysis
* Classification information
* Recovery strategy
* Recovery confidence
* Recovery attempts
* Recovery result
* Audit information

Incident Details

Selecting an incident provides a detailed view containing:

Incident
 ├── Status
 ├── Severity
 ├── Amount
 ├── Gateway
 ├── Transaction
 │
 ├── Failure Analysis
 │
 ├── Agent 2 Recovery Intelligence
 │    ├── Strategy
 │    ├── Confidence
 │    ├── Reasoning
 │    ├── Attempt
 │    ├── Delay
 │    └── Result
 │
 └── Recovery Actions

⸻

Technology Stack

Frontend

* React
* TypeScript
* Tailwind CSS
* Lucide icons

Backend

* Node.js
* Express
* TypeScript

Data Layer

* Prisma
* Database repository abstraction
* In-memory repository for demo operation

Security / Integrity

* SHA-256 hashing
* Linked audit records
* Canonicalized audit payloads

⸻

Getting Started

Prerequisites

Make sure the following are installed:

* Node.js 18+
* npm

Installation

Clone the repository and enter the project directory:

git clone https://github.com/Mahirgupta1105/RIVA.git
cd RIVA

Install dependencies:

npm install

Environment Configuration

Create your local environment file from the example configuration:

cp .env.example .env

Keep secrets and local credentials inside .env.

The .env file should not be committed to Git.

Start the Development Server

npm run dev

The application runs locally on:

http://localhost:8000

⸻

Demo Workflow

The easiest way to demonstrate RIVA is to create a payment failure and follow the recovery lifecycle.

Step 1 — Create an Incident

A payment failure is registered as a new incident.

DETECTED

Step 2 — Classify the Failure

The Forensic Engine analyzes the failure message.

Example:

Payment mandate has expired

The incident becomes:

CLASSIFIED

with:

Cause: MANDATE_EXPIRED
Source: HEURISTIC

Step 3 — Trigger Recovery

Agent 2 evaluates the incident and selects:

WHATSAPP_LINK

The recovery action contains:

Confidence: 88%
Attempt: #1
Delay: 1000 ms
Result: SUCCESS

Step 4 — Incident Recovery

After a successful recovery:

RECOVERY_IN_PROGRESS
        ↓
      SUCCESS
        ↓
    RECOVERED

The recovery action is also recorded in the audit chain.

⸻

API Reference

Health

GET /health

Returns the current system health status.

Customers

GET /api/customers
GET /api/customers/:id
POST /api/customers

Incidents

GET /api/incidents
GET /api/incidents/:id
POST /api/incidents
POST /api/incidents/:id/classify
POST /api/incidents/:id/set-cause
POST /api/incidents/:id/recover

Classification payload:

{
  "rawErrorMessage": "Payment mandate has expired"
}

Transactions

GET /api/transactions
GET /api/transactions/:id
POST /api/transactions

Audit

GET /api/audit
GET /api/audit/latest
GET /api/audit/chain
GET /api/audit/verify
POST /api/audit

System

GET /api/gateways
POST /api/simulation/run

WhatsApp Recovery

POST /api/whatsapp/:id

This endpoint triggers the WhatsApp recovery simulation and records the action in the audit system.

⸻

Current Implementation Status

Component	Status
Incident Detection	✅ Implemented
Incident Classification	✅ Implemented
Heuristic Forensic Engine	✅ Implemented
Agent 2 Recovery Intelligence	✅ Implemented
Cause-Based Recovery Routing	✅ Implemented
Same-Rail Recovery	✅ Implemented
UPI Intent Recovery	✅ Implemented
Alternate-Rail Recovery	✅ Implemented
WhatsApp Recovery Simulation	✅ Implemented
Recovery Retry Policy	✅ Implemented
Retention Recovery Path	✅ Implemented
SHA-256 Audit Hashing	✅ Implemented
Audit Chain Verification	✅ Implemented
Controller / Service Architecture	✅ Implemented
Repository Abstraction	✅ Implemented
In-Memory Demo Mode	✅ Implemented
Prisma Repository Architecture	✅ Implemented
Recovery Command Center UI	✅ Implemented
Real WhatsApp API	🔲 Not implemented
Production Payment Gateway Integration	🔲 Not implemented
Production LLM Classification	🔲 Not enabled in current demo

⸻

Design Principles

Cause Before Retry

RIVA does not blindly retry every failed transaction.

The failure cause determines the recovery strategy.

Recovery Through Multiple Rails

When the original payment rail is unlikely to succeed, RIVA can select an alternative recovery mechanism.

Confidence-Aware Decisions

Recovery decisions include confidence information so that downstream systems can distinguish stronger classifications from uncertain ones.

Auditability

Recovery decisions should be explainable and traceable.

Important system actions are therefore recorded in a cryptographically linked audit chain.

Separation of Concerns

Routes, controllers, services, repositories, and recovery engines are separated so that individual components can evolve without tightly coupling the entire system.

⸻

Project Scope

RIVA is currently a functional recovery-system prototype intended for demonstration, development, testing, and architectural validation.

The project simulates certain external integrations rather than connecting directly to production payment networks or messaging infrastructure.

In particular:

* WhatsApp recovery is simulated.
* Payment gateway behavior is simulated within the application.
* The current demonstrated classification path uses deterministic heuristic rules.
* Database-backed operation is supported through the repository architecture.
* Production deployment requires additional infrastructure and security hardening.

⸻

Future Enhancements

Potential future improvements include:

* Real WhatsApp Business API integration
* Production payment gateway webhooks
* HMAC webhook verification
* Role-based access control
* Advanced incident filtering
* Audit log export
* PDF/CSV reporting
* Human review workflows
* Production-grade AI classification
* Automated anomaly detection
* Recovery analytics
* Gateway reliability analytics
* Notification and escalation systems

⸻

Security

Do not commit secrets, API keys, database credentials, or other sensitive configuration to the repository.

Use environment variables for local and deployment-specific configuration.

For a public GitHub repository, consider enabling security features such as Dependabot alerts, secret scanning, push protection, and code scanning. (GitHub Docs)

⸻

Attribution & Project History

RIVA contains substantial architectural, backend, recovery, audit, and frontend modifications made for this project.

Where code or design elements originate from external projects, their applicable copyright, license, and attribution requirements must be respected.

This README does not grant additional rights to third-party code.

Before distributing the repository, verify the applicable license and attribution requirements of any upstream or third-party material.

⸻

Author

Mahir Gupta

RIVA — Revenue Integrity & Verification Agent

⸻

Project Status

RIVA is an actively developed prototype focused on demonstrating an end-to-end payment failure detection and recovery workflow.

The core demonstration flow is:

DETECTED
   ↓
CLASSIFIED
   ↓
RECOVERY_IN_PROGRESS
   ↓
AGENT 2 DECISION
   ↓
RECOVERY ACTION
   ↓
SUCCESS
   ↓
RECOVERED

The system combines incident management, forensic classification, intelligent recovery routing, simulated customer recovery, and tamper-evident auditing into a single recovery workflow.