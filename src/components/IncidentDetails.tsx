import React from 'react';
import {
  AlertCircle,
  ArrowRight,
  Zap,
  CreditCard,
  Building2,
  Brain,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';

interface RecoveryAction {
  rail?: string;
  details?: string;
  result?: string;
  attemptNumber?: number;
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
  orderId?: string;
  transactionId?: string;
  status: string;
  cause?: string;
  bank?: string;
  errorMessage?: string;
  errorCode?: string;
  amount?: number;
  gateway?: string;
  severity?: string;
  classificationSource?: string;
  actions?: RecoveryAction[];
  agent2Decision?: Agent2Decision | null;
}

interface IncidentDetailsProps {
  incident: Incident | null;
  onClassify: (id: string) => Promise<void>;
  onRecover: (id: string) => Promise<void>;
}

export default function IncidentDetails({
  incident,
  onClassify,
  onRecover
}: IncidentDetailsProps) {
  if (!incident) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-slate-400 p-8 text-center border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/50">
        <AlertCircle size={40} className="mb-4 opacity-20" />

        <p className="font-medium">
          Select an incident to view details
        </p>

        <p className="text-xs">
          Trigger classification or recovery actions from here
        </p>
      </div>
    );
  }

  const isClassified = incident.status !== 'DETECTED';

  const actions = incident.actions ?? [];

  const latestAction =
    actions.length > 0
      ? actions[actions.length - 1]
      : null;

  const agent2Decision =
    incident.agent2Decision;

  const hasAgent2Decision =
    Boolean(agent2Decision);

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-full">

      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
        <div>
          <h2 className="text-lg font-bold text-slate-800">
            Incident Details
          </h2>

          <p className="text-[10px] text-slate-400 font-mono mt-1">
            {incident.id}
          </p>
        </div>

        <span
          className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${
            incident.status === 'RECOVERED'
              ? 'bg-green-100 text-green-700'
              : incident.status === 'ESCALATED'
              ? 'bg-amber-100 text-amber-700'
              : incident.status === 'RECOVERY_IN_PROGRESS'
              ? 'bg-blue-100 text-blue-700'
              : incident.status === 'CLASSIFIED'
              ? 'bg-indigo-100 text-indigo-700'
              : 'bg-red-100 text-red-700'
          }`}
        >
          {incident.status}
        </span>
      </div>

      <div className="p-6 space-y-6 overflow-y-auto">

        {/* Transaction Information */}
        <div className="space-y-3">

          <div className="flex items-center gap-2">
            <CreditCard
              size={15}
              className="text-blue-600"
            />

            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Transaction
            </h3>
          </div>

          <div className="grid grid-cols-2 gap-3">

            <div className="p-3 rounded-lg bg-slate-50 border border-slate-100">
              <div className="text-[10px] text-slate-400 uppercase font-bold mb-1">
                Order ID
              </div>

              <div className="text-xs font-semibold text-slate-700 break-all">
                {incident.orderId || '—'}
              </div>
            </div>

            <div className="p-3 rounded-lg bg-slate-50 border border-slate-100">
              <div className="text-[10px] text-slate-400 uppercase font-bold mb-1">
                Transaction ID
              </div>

              <div className="text-xs font-semibold text-slate-700 break-all">
                {incident.transactionId || '—'}
              </div>
            </div>

          </div>

          <div className="grid grid-cols-2 gap-3">

            <div className="p-3 rounded-lg bg-slate-50 border border-slate-100">
              <div className="text-[10px] text-slate-400 uppercase font-bold mb-1">
                Gateway
              </div>

              <div className="text-sm font-semibold text-slate-700">
                {incident.gateway || '—'}
              </div>
            </div>

            <div className="p-3 rounded-lg bg-slate-50 border border-slate-100">
              <div className="text-[10px] text-slate-400 uppercase font-bold mb-1">
                Amount
              </div>

              <div className="text-sm font-bold text-slate-900">
                {typeof incident.amount === 'number'
                  ? `₹${incident.amount.toLocaleString('en-IN')}`
                  : '—'}
              </div>
            </div>

          </div>

        </div>

        {/* Failure Information */}
        <div className="space-y-3">

          <div className="flex items-center gap-2">
            <AlertTriangle
              size={15}
              className="text-amber-600"
            />

            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Failure Analysis
            </h3>
          </div>

          <div className="grid grid-cols-2 gap-3">

            <div className="p-3 rounded-lg bg-slate-50 border border-slate-100">
              <div className="text-[10px] text-slate-400 uppercase font-bold mb-1">
                Cause
              </div>

              <div className="text-sm font-semibold text-slate-700">
                {incident.cause || 'Unclassified'}
              </div>
            </div>

            <div className="p-3 rounded-lg bg-slate-50 border border-slate-100">
              <div className="text-[10px] text-slate-400 uppercase font-bold mb-1">
                Error Code
              </div>

              <div className="text-sm font-semibold text-slate-700">
                {incident.errorCode || '—'}
              </div>
            </div>

          </div>

          <div className="p-3 rounded-lg bg-slate-50 border border-slate-100">

            <div className="text-[10px] text-slate-400 uppercase font-bold mb-1">
              Error Message
            </div>

            <div className="text-xs text-slate-600">
              {incident.errorMessage ||
                'No error message available.'}
            </div>

          </div>

          <div className="grid grid-cols-2 gap-3">

            <div className="p-3 rounded-lg bg-slate-50 border border-slate-100">
              <div className="text-[10px] text-slate-400 uppercase font-bold mb-1">
                Bank
              </div>

              <div className="text-sm font-semibold text-slate-700">
                {incident.bank || '—'}
              </div>
            </div>

            <div className="p-3 rounded-lg bg-slate-50 border border-slate-100">
              <div className="text-[10px] text-slate-400 uppercase font-bold mb-1">
                Classification
              </div>

              <div className="text-sm font-semibold text-slate-700">
                {incident.classificationSource ||
                  'Pending'}
              </div>
            </div>

          </div>

        </div>

        {/* RIVA Agent 2 */}
        {hasAgent2Decision &&
          agent2Decision && (
            <div className="space-y-3">

              <div className="flex items-center gap-2">
                <Brain
                  size={15}
                  className="text-violet-600"
                />

                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  RIVA Agent 2 · Recovery Intelligence
                </h3>
              </div>

              <div className="rounded-xl border border-violet-100 bg-violet-50/40 overflow-hidden">

                {/* Strategy + Confidence */}
                <div className="grid grid-cols-2 gap-px bg-violet-100">

                  <div className="bg-white p-4">

                    <div className="text-[10px] text-slate-400 uppercase font-bold mb-1">
                      Recovery Strategy
                    </div>

                    <div className="text-sm font-bold text-violet-700">
                      {agent2Decision.action || '—'}
                    </div>

                  </div>

                  <div className="bg-white p-4">

                    <div className="text-[10px] text-slate-400 uppercase font-bold mb-1">
                      Confidence
                    </div>

                    <div className="text-sm font-bold text-slate-800">
                      {typeof agent2Decision.confidence ===
                      'number'
                        ? `${Math.round(
                            agent2Decision.confidence * 100
                          )}%`
                        : '—'}
                    </div>

                  </div>

                </div>

                {/* Reasoning */}
                <div className="p-4 border-t border-violet-100">

                  <div className="text-[10px] text-slate-400 uppercase font-bold mb-2">
                    Agent Reasoning
                  </div>

                  <p className="text-xs leading-5 text-slate-600">
                    {agent2Decision.reasoning ||
                      'No recovery reasoning available.'}
                  </p>

                </div>

                {/* Recovery Metadata */}
                <div className="grid grid-cols-3 gap-px bg-violet-100">

                  <div className="bg-white p-3">

                    <div className="text-[10px] text-slate-400 uppercase font-bold mb-1">
                      Attempt
                    </div>

                    <div className="text-xs font-bold text-slate-700">
                      #{latestAction?.attemptNumber ?? 1}
                    </div>

                  </div>

                  <div className="bg-white p-3">

                    <div className="text-[10px] text-slate-400 uppercase font-bold mb-1">
                      Delay
                    </div>

                    <div className="text-xs font-bold text-slate-700">
                      {typeof agent2Decision.delayMs ===
                      'number'
                        ? `${agent2Decision.delayMs}ms`
                        : '—'}
                    </div>

                  </div>

                  <div className="bg-white p-3">

                    <div className="text-[10px] text-slate-400 uppercase font-bold mb-1">
                      Result
                    </div>

                    <div
                      className={`text-xs font-bold ${
                        latestAction?.result === 'SUCCESS'
                          ? 'text-green-600'
                          : 'text-red-600'
                      }`}
                    >
                      {latestAction?.result || '—'}
                    </div>

                  </div>

                </div>

                {/* Retention Path */}
                {agent2Decision.isRetentionPath && (
                  <div className="p-3 border-t border-violet-100 bg-amber-50">

                    <div className="text-[10px] uppercase font-bold text-amber-700">
                      Retention Path Activated
                    </div>

                    <div className="text-xs text-amber-700 mt-1">
                      {typeof agent2Decision.discount ===
                      'number'
                        ? `${Math.round(
                            agent2Decision.discount * 100
                          )}% recovery incentive applied`
                        : 'Customer retention strategy activated'}
                    </div>

                  </div>
                )}

              </div>

            </div>
          )}

        {/* Recovery Actions */}
        <div className="space-y-3">

          <div className="flex items-center justify-between text-sm font-medium text-slate-700">

            <div className="flex items-center gap-2">
              <Building2
                size={15}
                className="text-green-600"
              />

              <span>Recovery Actions</span>
            </div>

            <span className="text-xs text-slate-400">
              {actions.length} attempts
            </span>

          </div>

          <div className="space-y-2">

            {actions.length === 0 ? (
              <div className="text-xs text-slate-400 italic p-3 text-center border border-dashed border-slate-200 rounded-lg">
                No recovery actions taken yet.
              </div>
            ) : (
              actions.map((action, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 border border-slate-100 text-xs"
                >

                  <div
                    className={`w-2 h-2 rounded-full ${
                      action.result === 'SUCCESS'
                        ? 'bg-green-500'
                        : 'bg-red-500'
                    }`}
                  />

                  <div className="flex-1">

                    <div className="font-bold text-slate-700">
                      {action.rail ||
                        'Unknown recovery rail'}
                    </div>

                    <div className="text-slate-500">
                      {action.details ||
                        'No action details available.'}
                    </div>

                  </div>

                  <div className="text-slate-400 font-mono">
                    #{action.attemptNumber ?? i + 1}
                  </div>

                </div>
              ))
            )}

          </div>
        </div>

        {/* Action Controls */}
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
              {incident.status === 'RECOVERED' ? (
                <CheckCircle2 size={16} />
              ) : (
                <ArrowRight size={16} />
              )}

              {incident.status === 'RECOVERED'
                ? 'Successfully Recovered'
                : 'Trigger Next Recovery'}
            </button>
          )}

        </div>

      </div>
    </div>
  );
}