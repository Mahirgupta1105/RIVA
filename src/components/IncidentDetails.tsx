import React from 'react';
import { AlertCircle, CheckCircle2, ArrowRight, Zap } from 'lucide-react';

interface Incident {
  id: string;
  status: string;
  cause?: string;
  bank?: string;
  actions: any[];
}

interface IncidentDetailsProps {
  incident: Incident | null;
  onClassify: (id: string) => Promise<void>;
  onRecover: (id: string) => Promise<void>;
}

export default function IncidentDetails({ incident, onClassify, onRecover }: IncidentDetailsProps) {
  if (!incident) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-slate-400 p-8 text-center border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/50">
        <AlertCircle size={40} className="mb-4 opacity-20" />
        <p className="font-medium">Select an incident to view details</p>
        <p className="text-xs">Trigger classification or recovery actions from here</p>
      </div>
    );
  }

  const isClassified = incident.status !== 'DETECTED';
  const canRecover = isClassified;

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-full">
      <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
        <h2 className="text-lg font-bold text-slate-800">Incident Details</h2>
        <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${
          incident.status === 'RECOVERED' ? 'bg-green-100 text-green-700' :
          incident.status === 'ESCALATED' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'
        }`}>
          {incident.status}
        </span>
      </div>
      
      <div className="p-6 space-y-6 overflow-y-auto">
        <div className="grid grid-cols-2 gap-4">
          <div className="p-3 rounded-lg bg-slate-50 border border-slate-100">
            <div className="text-[10px] text-slate-400 uppercase font-bold mb-1">Cause</div>
            <div className="text-sm font-semibold text-slate-700">{incident.cause || 'Unclassified'}</div>
          </div>
          <div className="p-3 rounded-lg bg-slate-50 border border-slate-100">
            <div className="text-[10px] text-slate-400 uppercase font-bold mb-1">Bank</div>
            <div className="text-sm font-semibold text-slate-700">{incident.bank || '—'}</div>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm font-medium text-slate-700">
            <span>Recovery Actions</span>
            <span className="text-xs text-slate-400">{incident.actions.length} attempts</span>
          </div>
          <div className="space-y-2">
            {incident.actions.length === 0 ? (
              <div className="text-xs text-slate-400 italic p-3 text-center border border-dashed border-slate-200 rounded-lg">
                No recovery actions taken yet.
              </div>
            ) : (
              incident.actions.map((action, i) => (
                <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 border border-slate-100 text-xs">
                  <div className={`w-2 h-2 rounded-full ${action.result === 'SUCCESS' ? 'bg-green-500' : 'bg-red-500'}`} />
                  <div className="flex-1">
                    <div className="font-bold text-slate-700">{action.rail}</div>
                    <div className="text-slate-500">{action.details}</div>
                  </div>
                  <div className="text-slate-400 font-mono">#{action.attemptNumber}</div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="pt-6 border-t border-slate-100 space-y-3">
          {!isClassified ? (
            <button 
              onClick={() => onClassify(incident.id)}
              className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 shadow-md shadow-blue-200"
            >
              <Zap size={16} />
              Run AI Classification
            </button>
          ) : (
            <button 
              onClick={() => onRecover(incident.id)}
              disabled={incident.status === 'RECOVERED'}
              className={`w-full py-3 px-4 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 shadow-md ${
                incident.status === 'RECOVERED' 
                  ? 'bg-slate-100 text-slate-400 cursor-not-allowed' 
                  : 'bg-green-600 hover:bg-green-700 text-white shadow-green-200'
              }`}
            >
              <ArrowRight size={16} />
              {incident.status === 'RECOVERED' ? 'Successfully Recovered' : 'Trigger Next Recovery'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
