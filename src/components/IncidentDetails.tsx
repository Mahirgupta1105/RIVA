import React from 'react';
import {
  AlertCircle,
  ArrowRight,
  Zap,
  CreditCard,
  Building2,
  Brain,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  Clock3,
  Sparkles
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
      <div className="h-full min-h-[420px] flex flex-col items-center justify-center text-slate-400 p-8 text-center border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50/60">
        <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-5">
          <AlertCircle size={32} className="opacity-30" />
        </div>

        <p className="font-semibold text-slate-600">
          Select an incident
        </p>

        <p className="text-xs mt-1 max-w-[220px] leading-5">
          Choose an incident from the operations table to inspect its recovery intelligence.
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

  const confidence =
    typeof agent2Decision?.confidence === 'number'
      ? Math.round(agent2Decision.confidence * 100)
      : null;

  const severity =
    incident.severity?.toUpperCase();

  const severityClasses =
    severity === 'CRITICAL'
      ? 'bg-red-100 text-red-700 border-red-200'
      : severity === 'HIGH'
      ? 'bg-orange-100 text-orange-700 border-orange-200'
      : severity === 'MEDIUM'
      ? 'bg-amber-100 text-amber-700 border-amber-200'
      : 'bg-slate-100 text-slate-600 border-slate-200';

  const statusClasses =
    incident.status === 'RECOVERED'
      ? 'bg-green-100 text-green-700 border-green-200'
      : incident.status === 'ESCALATED'
      ? 'bg-amber-100 text-amber-700 border-amber-200'
      : incident.status === 'RECOVERY_IN_PROGRESS'
      ? 'bg-blue-100 text-blue-700 border-blue-200'
      : incident.status === 'CLASSIFIED'
      ? 'bg-indigo-100 text-indigo-700 border-indigo-200'
      : 'bg-red-100 text-red-700 border-red-200';

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-full">

      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white">

        <div className="flex items-start justify-between gap-3">

          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center">
                <AlertCircle size={16} />
              </div>

              <div>
                <h2 className="text-sm font-bold text-slate-800">
                  Incident Details
                </h2>

                <p className="text-[9px] text-slate-400 font-mono truncate max-w-[180px]">
                  {incident.id}
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-col items-end gap-1.5">

            <span
              className={`px-2.5 py-1 rounded-full border text-[9px] font-bold uppercase tracking-wide ${statusClasses}`}
            >
              {incident.status}
            </span>

            {severity && (
              <span
                className={`px-2 py-0.5 rounded-full border text-[8px] font-bold uppercase ${severityClasses}`}
              >
                {severity} RISK
              </span>
            )}

          </div>

        </div>

        {/* Quick metrics */}
        <div className="grid grid-cols-3 gap-2 mt-4">

          <div className="rounded-lg bg-white border border-slate-100 p-2.5">
            <div className="text-[8px] uppercase font-bold tracking-wide text-slate-400">
              Amount
            </div>

            <div className="text-sm font-bold text-slate-900 mt-0.5">
              {typeof incident.amount === 'number'
                ? `₹${incident.amount.toLocaleString('en-IN')}`
                : '—'}
            </div>
          </div>

          <div className="rounded-lg bg-white border border-slate-100 p-2.5">
            <div className="text-[8px] uppercase font-bold tracking-wide text-slate-400">
              Gateway
            </div>

            <div className="text-xs font-bold text-slate-700 mt-1 truncate">
              {incident.gateway || '—'}
            </div>
          </div>

          <div className="rounded-lg bg-white border border-slate-100 p-2.5">
            <div className="text-[8px] uppercase font-bold tracking-wide text-slate-400">
              Attempts
            </div>

            <div className="text-sm font-bold text-slate-900 mt-0.5">
              {actions.length}
            </div>
          </div>

        </div>

      </div>

      <div className="p-5 space-y-6 overflow-y-auto">

        {/* Transaction */}
        <section className="space-y-3">

          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <CreditCard size={14} />
            </div>

            <div>
              <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Transaction
              </h3>

              <p className="text-[9px] text-slate-400">
                Payment context
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
              <div className="text-[8px] text-slate-400 uppercase font-bold mb-1">
                Order ID
              </div>

              <div className="text-[10px] font-semibold text-slate-700 break-all">
                {incident.orderId || '—'}
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
              <div className="text-[8px] text-slate-400 uppercase font-bold mb-1">
                Transaction ID
              </div>

              <div className="text-[10px] font-semibold text-slate-700 break-all">
                {incident.transactionId || '—'}
              </div>
            </div>

          </div>

          <div className="grid grid-cols-2 gap-2">

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
              <div className="text-[8px] text-slate-400 uppercase font-bold mb-1">
                Bank
              </div>

              <div className="text-xs font-semibold text-slate-700">
                {incident.bank || '—'}
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
              <div className="text-[8px] text-slate-400 uppercase font-bold mb-1">
                Classification
              </div>

              <div className="text-xs font-semibold text-slate-700">
                {incident.classificationSource || 'Pending'}
              </div>
            </div>

          </div>

        </section>

        {/* Failure Analysis */}
        <section className="space-y-3">

          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <AlertTriangle size={14} />
            </div>

            <div>
              <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Failure Analysis
              </h3>

              <p className="text-[9px] text-slate-400">
                Root-cause information
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
              <div className="text-[8px] text-slate-400 uppercase font-bold mb-1">
                Cause
              </div>

              <div className="text-xs font-semibold text-slate-700">
                {incident.cause || 'Unclassified'}
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
              <div className="text-[8px] text-slate-400 uppercase font-bold mb-1">
                Error Code
              </div>

              <div className="text-xs font-semibold text-slate-700">
                {incident.errorCode || '—'}
              </div>
            </div>

          </div>

          <div className="p-3.5 rounded-xl bg-red-50/60 border border-red-100">

            <div className="flex items-center gap-2 mb-1.5">
              <AlertCircle
                size={12}
                className="text-red-500"
              />

              <div className="text-[8px] text-red-500 uppercase font-bold tracking-wide">
                Failure Message
              </div>
            </div>

            <div className="text-xs leading-5 text-slate-700">
              {incident.errorMessage ||
                'No error message available.'}
            </div>

          </div>

        </section>

        {/* Agent 2 */}
        {hasAgent2Decision &&
          agent2Decision && (
            <section className="space-y-3">

              <div className="flex items-center justify-between">

                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-violet-100 text-violet-600 flex items-center justify-center">
                    <Brain size={14} />
                  </div>

                  <div>
                    <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      RIVA Agent 2
                    </h3>

                    <p className="text-[9px] text-violet-500 font-medium">
                      Recovery Intelligence
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1 text-[8px] font-bold uppercase text-violet-600">
                  <Sparkles size={11} />
                  Decision Ready
                </div>

              </div>

              <div className="rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-50/80 via-white to-indigo-50/50 overflow-hidden shadow-sm">

                {/* Decision */}
                <div className="p-4">

                  <div className="text-[8px] text-violet-500 uppercase font-bold tracking-wider mb-1">
                    Recommended Recovery Strategy
                  </div>

                  <div className="flex items-center justify-between gap-3">

                    <div className="text-base font-black text-violet-700 tracking-tight">
                      {agent2Decision.action || '—'}
                    </div>

                    <div className="px-2.5 py-1 rounded-lg bg-violet-100 text-violet-700 text-[9px] font-bold">
                      AI SELECTED
                    </div>

                  </div>

                </div>

                {/* Confidence */}
                <div className="px-4 pb-4">

                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[9px] uppercase font-bold text-slate-400">
                      Decision Confidence
                    </span>

                    <span className="text-xs font-black text-slate-800">
                      {confidence !== null
                        ? `${confidence}%`
                        : '—'}
                    </span>
                  </div>

                  <div className="h-2 bg-violet-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-violet-500 transition-all duration-500"
                      style={{
                        width: `${confidence ?? 0}%`
                      }}
                    />
                  </div>

                </div>

                {/* Reasoning */}
                <div className="border-t border-violet-100 p-4">

                  <div className="flex items-center gap-2 mb-2">
                    <Brain
                      size={12}
                      className="text-violet-500"
                    />

                    <div className="text-[8px] text-slate-400 uppercase font-bold tracking-wide">
                      Agent Reasoning
                    </div>
                  </div>

                  <p className="text-xs leading-5 text-slate-600">
                    {agent2Decision.reasoning ||
                      'No recovery reasoning available.'}
                  </p>

                </div>

                {/* Decision metadata */}
                <div className="grid grid-cols-3 border-t border-violet-100">

                  <div className="p-3 bg-white/80">
                    <div className="text-[8px] uppercase font-bold text-slate-400 mb-1">
                      Attempt
                    </div>

                    <div className="text-xs font-bold text-slate-700">
                      #{latestAction?.attemptNumber ?? 1}
                    </div>
                  </div>

                  <div className="p-3 bg-white/80 border-x border-violet-100">
                    <div className="text-[8px] uppercase font-bold text-slate-400 mb-1">
                      Delay
                    </div>

                    <div className="text-xs font-bold text-slate-700 flex items-center gap-1">
                      <Clock3 size={10} />
                      {typeof agent2Decision.delayMs === 'number'
                        ? `${agent2Decision.delayMs}ms`
                        : '—'}
                    </div>
                  </div>

                  <div className="p-3 bg-white/80">
                    <div className="text-[8px] uppercase font-bold text-slate-400 mb-1">
                      Result
                    </div>

                    <div
                      className={`text-xs font-bold ${
                        latestAction?.result === 'SUCCESS'
                          ? 'text-green-600'
                          : latestAction?.result
                          ? 'text-red-600'
                          : 'text-slate-500'
                      }`}
                    >
                      {latestAction?.result || 'PENDING'}
                    </div>
                  </div>

                </div>

                {/* Retention */}
                {agent2Decision.isRetentionPath && (
                  <div className="p-3.5 border-t border-amber-200 bg-amber-50">

                    <div className="flex items-center gap-2">
                      <ShieldCheck
                        size={14}
                        className="text-amber-600"
                      />

                      <div>
                        <div className="text-[9px] uppercase font-bold text-amber-700">
                          Retention Path Activated
                        </div>

                        <div className="text-[10px] text-amber-700 mt-0.5">
                          {typeof agent2Decision.discount === 'number'
                            ? `${Math.round(
                                agent2Decision.discount * 100
                              )}% recovery incentive applied`
                            : 'Customer retention strategy activated'}
                        </div>
                      </div>
                    </div>

                  </div>
                )}

              </div>

            </section>
          )}

        {/* Recovery Timeline */}
        <section className="space-y-3">

          <div className="flex items-center justify-between">

            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-green-50 text-green-600 flex items-center justify-center">
                <Building2 size={14} />
              </div>

              <div>
                <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Recovery Actions
                </h3>

                <p className="text-[9px] text-slate-400">
                  Execution history
                </p>
              </div>
            </div>

            <span className="px-2 py-1 rounded-full bg-slate-100 text-slate-500 text-[8px] font-bold">
              {actions.length} {actions.length === 1 ? 'ATTEMPT' : 'ATTEMPTS'}
            </span>

          </div>

          {actions.length === 0 ? (
            <div className="p-4 text-xs text-slate-400 italic text-center border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
              No recovery actions taken yet.
            </div>
          ) : (
            <div className="relative pl-5">

              <div className="absolute left-[7px] top-2 bottom-2 w-px bg-slate-200" />

              <div className="space-y-3">

                {actions.map((action, i) => {
                  const success =
                    action.result === 'SUCCESS';

                  return (
                    <div
                      key={i}
                      className="relative"
                    >

                      <div
                        className={`absolute -left-5 top-3 w-3.5 h-3.5 rounded-full border-2 border-white shadow-sm ${
                          success
                            ? 'bg-green-500'
                            : 'bg-red-500'
                        }`}
                      />

                      <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 hover:border-slate-200 transition-colors">

                        <div className="flex items-start justify-between gap-3">

                          <div className="min-w-0">

                            <div className="flex items-center gap-2">

                              <span className="text-xs font-bold text-slate-700">
                                {action.rail ||
                                  'Unknown recovery rail'}
                              </span>

                              <span
                                className={`text-[8px] font-bold px-1.5 py-0.5 rounded ${
                                  success
                                    ? 'bg-green-100 text-green-700'
                                    : 'bg-red-100 text-red-700'
                                }`}
                              >
                                {action.result || 'PENDING'}
                              </span>

                            </div>

                            <p className="text-[10px] leading-4 text-slate-500 mt-1.5">
                              {action.details ||
                                'No action details available.'}
                            </p>

                          </div>

                          <div className="shrink-0 text-[9px] text-slate-400 font-mono">
                            #{action.attemptNumber ?? i + 1}
                          </div>

                        </div>

                      </div>

                    </div>
                  );
                })}

              </div>

            </div>
          )}

        </section>

        {/* Controls */}
        <section className="pt-5 border-t border-slate-100">

          {!isClassified ? (
            <button
              onClick={() => onClassify(incident.id)}
              className="w-full py-3.5 px-4 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-200/60"
            >
              <Zap size={16} />
              Run AI Classification
              <ArrowRight size={14} />
            </button>
          ) : (
            <button
              onClick={() => onRecover(incident.id)}
              disabled={incident.status === 'RECOVERED'}
              className={`w-full py-3.5 px-4 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 shadow-lg ${
                incident.status === 'RECOVERED'
                  ? 'bg-green-50 text-green-600 border border-green-200 shadow-none cursor-not-allowed'
                  : 'bg-green-600 hover:bg-green-700 active:bg-green-800 text-white shadow-green-200/60'
              }`}
            >
              {incident.status === 'RECOVERED' ? (
                <>
                  <CheckCircle2 size={17} />
                  Successfully Recovered
                </>
              ) : (
                <>
                  <ArrowRight size={16} />
                  Trigger Next Recovery
                </>
              )}
            </button>
          )}

          <div className="flex items-center justify-center gap-1.5 mt-3 text-[8px] uppercase tracking-wider font-bold text-slate-400">
            <ShieldCheck size={10} />
            RIVA controlled recovery workflow
          </div>

        </section>

      </div>
    </div>
  );
}