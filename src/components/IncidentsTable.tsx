import React, { useState } from 'react';

interface Incident {
  id: string;
  status: string;
  cause?: string;
  bank?: string;
  actions: any[];
}

export default function IncidentsTable({
  incidents,
  selectedId,
  onSelect
}: {
  incidents: Incident[],
  selectedId: string | null,
  onSelect: (id: string) => void
}) {
  const [filter, setFilter] = useState('');

  const filteredIncidents = incidents.filter(inc =>
    inc.id.toLowerCase().includes(filter.toLowerCase()) ||
    inc.status.toLowerCase().includes(filter.toLowerCase()) ||
    (inc.cause && inc.cause.toLowerCase().includes(filter.toLowerCase()))
  );

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/30">
        <h2 className="text-lg font-bold text-slate-800">Incident Monitor</h2>
        <input
          type="text"
          placeholder="Filter incidents..."
          className="px-3 py-1.5 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-500 border-b border-slate-100">
            <tr className="text-xs uppercase tracking-wider">
              <th className="px-6 py-3 font-semibold">Incident ID</th>
              <th className="px-6 py-3 font-semibold">Status</th>
              <th className="px-6 py-3 font-semibold">Cause</th>
              <th className="px-6 py-3 font-semibold">Bank</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredIncidents.length === 0 ? (
              <tr><td colSpan={4} className="px-6 py-12 text-center text-slate-400">No matching incidents found.</td></tr>
            ) : (
              filteredIncidents.map(inc => (
                <tr
                  key={inc.id}
                  onClick={() => onSelect(inc.id)}
                  className={`cursor-pointer transition-colors group ${
                    selectedId === inc.id ? 'bg-blue-50' : 'hover:bg-slate-50'
                  }`}
                >
                  <td className="px-6 py-4 font-mono text-xs text-slate-500">{inc.id}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${
                      inc.status === 'RECOVERED' ? 'bg-green-100 text-green-700' :
                      inc.status === 'ESCALATED' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'
                    }`}>
                      {inc.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-slate-600 font-medium">{inc.cause || '—'}</td>
                  <td className="px-6 py-4 text-slate-600">{inc.bank || '—'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
