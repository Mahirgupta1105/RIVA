import React, { useEffect, useState } from 'react';
import { LayoutDashboard, Users, Activity, ShieldCheck, ChevronDown } from 'lucide-react';
import KpiCard from './components/KpiCard';
import IncidentsTable from './components/IncidentsTable';
import AuditFeed from './components/AuditFeed';

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

export default function App() {
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

  if (loading) return <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-500 font-medium">Loading RIVA Command Center...</div>;

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
      {/* Top Nav */}
      <nav className="bg-white border-b border-slate-200 px-8 py-4 flex justify-between items-center sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 p-2 rounded-lg">
            <LayoutDashboard size={20} className="text-white" />
          </div>
          <span className="text-xl font-bold tracking-tight text-slate-900">Recovery Pulse <span className="text-blue-600">RIVA</span></span>
        </div>

        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 border border-blue-100">
            <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></div>
            <span className="text-[11px] font-bold text-blue-600 uppercase tracking-wide">Demo Mode</span>
          </div>

          <div className="flex items-center gap-2 pl-6 border-l border-slate-200 cursor-pointer hover:opacity-80 transition-opacity">
            <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center font-bold text-slate-600 text-xs">AD</div>
            <div className="flex items-center gap-1">
              <span className="text-sm font-medium text-slate-700">Admin</span>
              <ChevronDown size={14} className="text-slate-400" />
            </div>
          </div>
        </div>
      </nav>

      <main className="p-8 max-w-7xl mx-auto">
        {/* KPI Row */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
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
      </main>
    </div>
  );
}
