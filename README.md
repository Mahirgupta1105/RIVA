# Recovery Pulse / RIVA
**Revenue Intelligence & Recovery Agent**

RIVA is a high-precision payment recovery system designed to detect revenue leakage from payment failures, classify the root cause of those failures using an AI-driven "Forensic Engine," and automate the recovery process through a "Multi-Rail Cascade."

## 🚀 Quick Start

### Prerequisites
- Node.js v18+
- npm

### Installation & Setup
```bash
npm install
```

### Run the App
The application boots in **DEMO mode** by default (using an in-memory data store for immediate verification).
```bash
npm run dev
```
The server will start on `http://localhost:8000`.

## 🏗️ Architecture

### 1. Forensic Engine (Classification)
When a payment failure is detected, RIVA analyzes the raw gateway error message to determine the root cause.
- **Heuristic Analysis**: Matches known error patterns (e.g., "Gateway Timeout", "Insufficient Funds").
- **AI-Driven Classification**: Uses LLM-based reasoning to categorize unknown errors.
- **Confidence Scoring**: Only auto-executes recovery if confidence exceeds 0.5; otherwise, it escalates for human review.

### 2. Multi-Rail Recovery Cascade
RIVA doesn't just retry the same payment method; it intelligently switches "rails" based on the failure cause:
- **TECHNICAL_ERROR** $\rightarrow$ Same Rail (Retry)
- **UPI_APP_TIMEOUT** $\rightarrow$ UPI Intent
- **MANDATE_EXPIRED / AUTH_FAILURE_3DS** $\rightarrow$ WhatsApp Link
- **BANK_GATEWAY_DOWN / RISK_BLOCKED** $\rightarrow$ Alternate Rail

### 3. Immutable Audit Log
Every decision and action is recorded in a cryptographically linked audit chain. Each entry contains a SHA-256 hash of the previous entry's hash, the action performed, and the payload, ensuring a tamper-evident record of recovery attempts.

## 🛠️ API Reference

### Customers
- `POST /api/customers`: Create a test customer.
  - Payload: `{ "name": "string", "email": "string", "ltvTier": "STARTER|PRO|ENTERPRISE" }`

### Incidents
- `POST /api/incidents`: Create a new failure incident.
  - Payload: `{ "customerId": "uuid" }`
- `GET /api/incidents/:id`: Fetch current incident status and recovery history.
- `POST /api/incidents/:id/classify`: Trigger the Forensic Engine.
  - Payload: `{ "rawErrorMessage": "string" }`
- `POST /api/incidents/:id/set-cause`: (Test Only) Manually override the failure cause.
  - Payload: `{ "cause": "MANDATE_EXPIRED" }`
- `POST /api/incidents/:id/recover`: Trigger the next recovery step in the cascade.

### Audit
- `GET /api/audit`: Retrieve the full immutable hash chain.
  ru
## 📈 Implementation Status

| Feature | Status | Notes |
| :--- | :--- | :--- |
| **Forensic Engine** | ✅ Fully Implemented | Heuristic + AI classification paths. |
| **Recovery Cascade** | ✅ Fully Implemented | Cause-based rail switching. |
| **Audit Logger** | ✅ Fully Implemented | SHA-256 hash-chain logging. |
| **API Layer** | ✅ Fully Implemented | All core endpoints verified. |
| **Demo Mode** | ✅ Fully Implemented | In-memory repository for rapid testing. |
| **Database Mode** | ⚠️ Designed | Prisma schema defined; wiring pending stable environment. |
| **Frontend UI** | ✅ Fully Implemented | Professional Incident Command Center (React 19/Tailwind 4). |

### Designed (Not Implemented)
To prioritize the core recovery logic for submission, the following are documented as designed but not implemented:
- HMAC Webhook Security for gateway callbacks.
- RBAC (Role-Based Access Control) for the dashboard.
- CSV/PDF Export for audit logs.
- Advanced Dashboard Filtering.
