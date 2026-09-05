import React, { useMemo, useState } from 'react';

interface Incident {
  id: string;
  orderId?: string;
  status: string;
  cause?: string;
  bank?: string;
  amount?: number;
  gateway?: string;
  severity?: string;
}

interface IncidentsTableProps {
  incidents: Incident[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export default function IncidentsTable({
  incidents,
  selectedId,
  onSelect
}: IncidentsTableProps) {
  const [filter, setFilter] = useState('');

  const filteredIncidents = useMemo(() => {
    const search = filter.toLowerCase().trim();

    if (!search) return incidents;

    return incidents.filter((incident) =>
      [
        incident.id,
        incident.orderId,
        incident.status,
        incident.cause,
        incident.bank,
        incident.gateway,
        incident.severity
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(search)
    );
  }, [incidents, filter]);

  function statusClass(status: string) {
    if (status === 'RECOVERED') {
      return 'bg-green-100 text-green-700';
    }

    if (status === 'ESCALATED') {
      return 'bg-amber-100 text-amber-700';
    }

    if (status === 'RECOVERY_IN_PROGRESS') {
      return 'bg-blue-100 text-blue-700';
    }

    if (status === 'CLASSIFIED') {
      return 'bg-indigo-100 text-indigo-700';
    }

    if (status === 'DETECTED') {
      return 'bg-red-100 text-red-700';
    }

    return 'bg-slate-100 text-slate-600';
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">

      <div className="px-6 py-5 border-b border-slate-200 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-900">
            Incident Monitor
          </h2>

          <p className="text-xs text-slate-400 mt-1">
            Select an incident to inspect and operate on it.
          </p>
        </div>

        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Search..."
          className="w-48 px-3 py-2 text-sm border border-slate-200 rounded-lg"
        />
      </div>

      <div className="overflow-x-auto">

        <table className="w-full">

          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">

              <th className="text-left px-6 py-3 text-xs font-bold uppercase text-slate-400">
                Incident
              </th>

              <th className="text-left px-6 py-3 text-xs font-bold uppercase text-slate-400">
                Status
              </th>

              <th className="text-left px-6 py-3 text-xs font-bold uppercase text-slate-400">
                Cause
              </th>

              <th className="text-left px-6 py-3 text-xs font-bold uppercase text-slate-400">
                Gateway
              </th>

              <th className="text-left px-6 py-3 text-xs font-bold uppercase text-slate-400">
                Amount
              </th>

            </tr>
          </thead>

          <tbody>

            {filteredIncidents.map((incident) => {

              const selected = incident.id === selectedId;

              return (
                <tr
                  key={incident.id}
                  onClick={() => onSelect(incident.id)}
                  className={`border-b border-slate-100 cursor-pointer ${
                    selected ? 'bg-blue-50' : 'hover:bg-slate-50'
                  }`}
                >

                  <td className="px-6 py-4">

                    <div className="font-semibold text-sm text-slate-700">
                      {incident.orderId || 'Incident'}
                    </div>

                    <div className="font-mono text-[10px] text-slate-400 mt-1">
                      {incident.id}
                    </div>

                  </td>

                  <td className="px-6 py-4">

                    <span
                      className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${statusClass(
                        incident.status
                      )}`}
                    >
                      {incident.status}
                    </span>

                  </td>

                  <td className="px-6 py-4 text-sm text-slate-600">
                    {incident.cause || 'Unclassified'}
                  </td>

                  <td className="px-6 py-4 text-sm text-slate-600">
                    {incident.gateway || '—'}
                  </td>

                  <td className="px-6 py-4 text-sm font-semibold text-slate-700">
                    {typeof incident.amount === 'number'
                      ? `₹${incident.amount.toLocaleString('en-IN')}`
                      : '—'}
                  </td>

                </tr>
              );
            })}

          </tbody>

        </table>

      </div>

      <div className="px-6 py-3 bg-slate-50 border-t border-slate-100">
        <span className="text-xs text-slate-400">
          Showing {filteredIncidents.length} of {incidents.length} incidents
        </span>
      </div>

    </div>
  );
}