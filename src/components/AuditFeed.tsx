import React from 'react';

interface AuditLog {
  id: string;
  action: string;
  payload: any;
  hash: string;
  timestamp: string;
}

export default function AuditFeed({
  logs,
  filterIncidentId
}: {
  logs: AuditLog[],
  filterIncidentId: string | null
}) {
  const filteredLogs = filterIncidentId
    ? logs.filter(log => log.payload?.incidentId === filterIncidentId)
    : logs;

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/30 flex justify-between items-center">
        <h2 className="text-lg font-bold text-slate-800">Audit Chain</h2>
        {filterIncidentId && (
          <span className="text-[10px] font-bold px-2 py-1 bg-blue-100 text-blue-700 rounded-full uppercase">
            Filtering: {filterIncidentId}
          </span>
        )}
      </div>
      <div className="p-6 relative">
        {filteredLogs.length === 0 ? (
          <div className="text-center text-slate-400 py-8">
            {filterIncidentId
              ? `No logs for incident ${filterIncidentId}`
              : 'No audit logs available.'}
          </div>
        ) : (
          <div className="relative space-y-6">
            {/* Vertical Line */}
            <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-slate-200"></div>

            {filteredLogs.map((log, i) => (
              <div key={log.id} className="relative pl-10">
                {/* Dot on line */}
                <div className="absolute left-3 top-1.5 w-2 h-2 rounded-full bg-blue-500 ring-4 ring-white shadow-sm"></div>

                <div className="p-3 rounded-lg bg-slate-50 border border-slate-100 hover:border-blue-200 transition-colors">
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-blue-600 font-bold text-xs uppercase tracking-wider">{log.action}</span>
                    <span className="text-[10px] text-slate-400">{log.timestamp}</span>
                  </div>
                  <div className="text-xs text-slate-600 break-all mb-2 font-mono bg-slate-100 p-2 rounded">
                    {JSON.stringify(log.payload)}
                  </div>
                  <div className="text-[9px] text-slate-400 font-mono truncate">
                    Hash: {log.hash}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
