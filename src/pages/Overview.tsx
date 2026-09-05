import React, { useEffect, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  ShieldCheck,
  Users
} from 'lucide-react';

import KpiCard from '../components/KpiCard';
import IncidentsTable from '../components/IncidentsTable';
import IncidentDetails from '../components/IncidentDetails';
import AuditFeed from '../components/AuditFeed';

interface RecoveryAction {
  id?: string;
  incidentId?: string;
  rail?: string;
  result?: string;
  details?: string;
  attemptNumber?: number;
  duration?: number | null;
  timestamp?: string;
}

interface Agent2Decision {
  action?: string;
  confidence?: number;
  reasoning?: string;
  delayMs?: number;
  isRetentionPath?: boolean;
  discount?: number;
}

interface Incident {
  id: string;
  customerId?: string;
  status: string;
  cause?: string;
  bank?: string;
  originalMethod?: string;
  errorMessage?: string;
  errorCode?: string;
  amount?: number;
  orderId?: string;
  transactionId?: string;
  gateway?: string;
  severity?: string;
  recoverability?: number;
  classificationSource?: string;
  actions?: RecoveryAction[];
  agent2Decision?: Agent2Decision | null;
  createdAt?: string;
  updatedAt?: string;
}

interface AuditLog {
  id: string;
  action: string;
  payload: any;
  hash: string;
  timestamp: string;
}

interface Customer {
  id: string;
  name: string;
  email: string;
  ltvTier: string;
  lifetimeValue: number;
}

export default function Overview() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [customerCount, setCustomerCount] = useState(0);

  const [selectedIncidentId, setSelectedIncidentId] =
    useState<string | null>(null);

  const [selectedIncident, setSelectedIncident] =
    useState<Incident | null>(null);

  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  async function loadData() {
    try {
      const [incRes, auditRes, customerRes] =
        await Promise.all([
          fetch('/api/incidents'),
          fetch('/api/audit'),
          fetch('/api/customers')
        ]);

      if (
        !incRes.ok ||
        !auditRes.ok ||
        !customerRes.ok
      ) {
        throw new Error(
          'Failed to load dashboard data'
        );
      }

      const [
        incidentData,
        auditData,
        customerData
      ] = await Promise.all([
        incRes.json(),
        auditRes.json(),
        customerRes.json()
      ]);

      setIncidents(incidentData);
      setAuditLogs(auditData);

      const customers: Customer[] =
        customerData;

      setCustomerCount(
        customers.length
      );

      /*
       * If an incident is already selected,
       * refresh its detailed information too.
       */
      if (selectedIncidentId) {
        const selectedFromList =
          incidentData.find(
            (incident: Incident) =>
              incident.id ===
              selectedIncidentId
          );

        if (selectedFromList) {
          try {
            const detailResponse =
              await fetch(
                `/api/incidents/${selectedIncidentId}`
              );

            if (detailResponse.ok) {
              const detail =
                await detailResponse.json();

              setSelectedIncident(detail);
            } else {
              setSelectedIncident(
                selectedFromList
              );
            }
          } catch {
            setSelectedIncident(
              selectedFromList
            );
          }
        }
      }
    } catch (error) {
      console.error(
        'RIVA dashboard error:',
        error
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const totalIncidents =
    incidents.length;

  const recoveredCount =
    incidents.filter(
      incident =>
        incident.status ===
        'RECOVERED'
    ).length;

  const activeCount =
    incidents.filter(
      incident =>
        incident.status !==
          'RECOVERED' &&
        incident.status !==
          'ESCALATED'
    ).length;

  const highRiskCount =
    incidents.filter(
      incident =>
        incident.severity === 'HIGH' ||
        incident.severity ===
          'CRITICAL'
    ).length;

  const recoveryRate =
    totalIncidents > 0
      ? (
          (recoveredCount /
            totalIncidents) *
          100
        ).toFixed(1)
      : '0.0';

  async function handleSelectIncident(
    id: string
  ) {
    setSelectedIncidentId(id);
    setSelectedIncident(null);

    try {
      const response =
        await fetch(
          `/api/incidents/${id}`
        );

      if (!response.ok) {
        throw new Error(
          'Failed to load incident details'
        );
      }

      const detail: Incident =
        await response.json();

      setSelectedIncident(detail);
    } catch (error) {
      console.error(
        'Failed to load incident details:',
        error
      );

      /*
       * Fallback to the incident already
       * available in the list.
       */
      const fallback =
        incidents.find(
          incident =>
            incident.id === id
        ) || null;

      setSelectedIncident(
        fallback
      );
    }
  }

  async function handleClassify(
    id: string
  ) {
    const incident =
      incidents.find(
        item => item.id === id
      );

    if (!incident) {
      return;
    }

    setActionLoading(true);

    try {
      const response =
        await fetch(
          `/api/incidents/${id}/classify`,
          {
            method: 'POST',
            headers: {
              'Content-Type':
                'application/json'
            },
            body: JSON.stringify({
              rawErrorMessage:
                incident.errorMessage ||
                incident.cause ||
                'Payment transaction failure'
            })
          }
        );

      const result =
        await response.json();

      if (!response.ok) {
        throw new Error(
          result.error ||
            'Classification failed'
        );
      }

      /*
       * Refresh dashboard data.
       */
      await loadData();

      /*
       * Fetch the complete incident
       * so the latest Agent 2 data is shown.
       */
      const detailResponse =
        await fetch(
          `/api/incidents/${id}`
        );

      if (detailResponse.ok) {
        const detail =
          await detailResponse.json();

        setSelectedIncident(
          detail
        );
      }
    } catch (error: any) {
      console.error(
        'Classification error:',
        error
      );

      window.alert(
        error.message ||
          'Classification failed'
      );
    } finally {
      setActionLoading(false);
    }
  }

  async function handleRecover(
    id: string
  ) {
    setActionLoading(true);

    try {
      const response =
        await fetch(
          `/api/incidents/${id}/recover`,
          {
            method: 'POST'
          }
        );

      const result =
        await response.json();

      if (!response.ok) {
        throw new Error(
          result.error ||
            'Recovery failed'
        );
      }

      /*
       * Refresh dashboard data.
       */
      await loadData();

      /*
       * Fetch the updated incident
       * containing Agent 2 decision and
       * recovery action information.
       */
      const detailResponse =
        await fetch(
          `/api/incidents/${id}`
        );

      if (detailResponse.ok) {
        const detail =
          await detailResponse.json();

        setSelectedIncident(
          detail
        );
      }
    } catch (error: any) {
      console.error(
        'Recovery error:',
        error
      );

      window.alert(
        error.message ||
          'Recovery failed'
      );
    } finally {
      setActionLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-500 font-medium">
        Loading RIVA command center...
      </div>
    );
  }

  return (
    <div className="space-y-8">

      {/* Operational KPIs */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <Activity
            size={18}
            className="text-blue-600"
          />

          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500">
            Operational Overview
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">

          <KpiCard
            label="Total Incidents"
            value={totalIncidents}
            icon={Activity}
            colorClass="bg-blue-100 text-blue-600"
          />

          <KpiCard
            label="Active Incidents"
            value={activeCount}
            icon={AlertTriangle}
            colorClass="bg-amber-100 text-amber-600"
          />

          <KpiCard
            label="Recovered"
            value={recoveredCount}
            icon={CheckCircle2}
            colorClass="bg-green-100 text-green-600"
          />

          <KpiCard
            label="Recovery Rate"
            value={`${recoveryRate}%`}
            icon={ShieldCheck}
            colorClass="bg-indigo-100 text-indigo-600"
          />

        </div>
      </section>

      {/* Risk Signals */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">

        {/* High Risk */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">

          <div className="flex items-center justify-between">

            <div>
              <div className="text-xs uppercase tracking-wider font-bold text-slate-400">
                High Risk
              </div>

              <div className="text-2xl font-bold text-slate-900 mt-1">
                {highRiskCount}
              </div>
            </div>

            <div className="p-3 rounded-lg bg-red-100 text-red-600">
              <AlertTriangle size={20} />
            </div>

          </div>

          <p className="text-xs text-slate-400 mt-3">
            Incidents requiring priority attention
          </p>

        </div>

        {/* Recovery Pipeline */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">

          <div className="flex items-center justify-between">

            <div>
              <div className="text-xs uppercase tracking-wider font-bold text-slate-400">
                Recovery Pipeline
              </div>

              <div className="text-2xl font-bold text-slate-900 mt-1">
                {activeCount}
              </div>
            </div>

            <div className="p-3 rounded-lg bg-blue-100 text-blue-600">
              <Activity size={20} />
            </div>

          </div>

          <p className="text-xs text-slate-400 mt-3">
            Incidents currently requiring action
          </p>

        </div>

        {/* Customer Coverage */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">

          <div className="flex items-center justify-between">

            <div>
              <div className="text-xs uppercase tracking-wider font-bold text-slate-400">
                Customer Coverage
              </div>

              <div className="text-2xl font-bold text-slate-900 mt-1">
                {customerCount}
              </div>
            </div>

            <div className="p-3 rounded-lg bg-slate-100 text-slate-600">
              <Users size={20} />
            </div>

          </div>

          <p className="text-xs text-slate-400 mt-3">
            Customers currently monitored by RIVA
          </p>

        </div>

      </section>

      {/* Incident Operations */}
      <section>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

          <div className="xl:col-span-2">
            <IncidentsTable
              incidents={incidents}
              selectedId={
                selectedIncidentId
              }
              onSelect={
                handleSelectIncident
              }
            />
          </div>

          <div className="xl:col-span-1 min-h-[420px]">
            <IncidentDetails
              incident={
                selectedIncident
              }
              onClassify={
                handleClassify
              }
              onRecover={
                handleRecover
              }
            />
          </div>

        </div>

      </section>

      {/* Audit Intelligence */}
      <section>
        <AuditFeed
          logs={auditLogs}
          filterIncidentId={
            selectedIncidentId
          }
        />
      </section>

      {/* Processing Indicator */}
      {actionLoading && (
        <div className="fixed bottom-6 right-6 bg-slate-900 text-white px-4 py-3 rounded-lg shadow-lg text-sm font-medium">
          Processing RIVA action...
        </div>
      )}

    </div>
  );
}