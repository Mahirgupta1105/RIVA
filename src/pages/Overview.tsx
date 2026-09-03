import React, { useEffect, useState } from 'react';
import { LayoutDashboard, Users, Activity, ShieldCheck, ChevronDown } from 'lucide-react';
import KpiCard from '../components/KpiCard';
import IncidentsTable from '../components/IncidentsTable';
import AuditFeed from '../components/AuditFeed';

interface Incident {
  id: string;
  status: string;
  cause?: string;
  bank?: string;
  actions: any[];
}

interface AuditLog {
  id: string;
  action: string;
  payload: any;
  hash: string;
  timestamp: string;
}

export default function Overview() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [selectedIncidentId, setSelectedIncidentId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const [incRes, auditRes] = await Promise.all([
          fetch('/api/incidents'),
          fetch('/api/audit')
        ]);
        setIncidents(await incRes.json());
        setAuditLogs(await auditRes.json());
      } catch (e) {
        console.error('Fetch error:', e);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const totalIncidents = incidents.length;
  const recoveredCount = incidents.filter(i => i.status === 'RECOVERED').length;
  const recoveryRate = totalIncidents > 0 ? ((recoveredCount / totalIncidents) * 100).toFixed(1) : '0.0';

  if (loading) return <div className="flex items-center justify-center h-full text-slate-500 font-medium">Loading RIVA Overview...</div>;

  return (
    <div className="space-y-8">
      {/* KPI Row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <KpiCard
          label="Total Incidents"
          value={totalIncidents}
          icon={Activity}
          colorClass="bg-blue-100 text-blue-600"
        />
        <KpiCard
          label="Recovered"
          value={recoveredCount}
          icon={ShieldCheck}
          colorClass="bg-green-100 text-green-600"
        />
        <KpiCard
          label="Recovery Rate"
          value={`${recoveryRate}%`}
          icon={Activity}
          colorClass="bg-indigo-100 text-indigo-600"
        />
        <KpiCard
          label="Active Users"
          value="12"
          icon={Users}
          colorClass="bg-slate-100 text-slate-600"
        />
      </div>

      {/* Main Content Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <IncidentsTable
            incidents={incidents}
            selectedId={selectedIncidentId}
            onSelect={setSelectedIncidentId}
          />
        </div>
        <div className="lg:col-span-1">
          <AuditFeed
            logs={auditLogs}
            filterIncidentId={selectedIncidentId}
          />
        </div>
      </div>
    </div>
  );
}
