import React from 'react';
import { LayoutDashboard, ShieldCheck, ChevronDown } from 'lucide-react';
import Overview from './pages/Overview';

export default function App() {
  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
      <nav className="bg-white border-b border-slate-200 px-8 py-4 flex justify-between items-center sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 p-2 rounded-lg">
            <ShieldCheck size={20} className="text-white" />
          </div>

          <div>
            <div className="text-xl font-bold tracking-tight">
              RIVA
            </div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-slate-400">
              Revenue Integrity & Verification
            </div>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 border border-blue-100">
            <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
            <span className="text-[11px] font-bold text-blue-600 uppercase tracking-wide">
              System Online
            </span>
          </div>

          <div className="flex items-center gap-2 pl-6 border-l border-slate-200">
            <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center font-bold text-slate-600 text-xs">
              AD
            </div>

            <div className="flex items-center gap-1">
              <span className="text-sm font-medium text-slate-700">
                Admin
              </span>
              <ChevronDown size={14} className="text-slate-400" />
            </div>
          </div>
        </div>
      </nav>

      <main className="p-8 max-w-7xl mx-auto">
        <div className="mb-8">
          <div className="flex items-center gap-2 text-sm text-slate-400 mb-2">
            <LayoutDashboard size={15} />
            <span>Command Center</span>
          </div>

          <h1 className="text-2xl font-bold text-slate-900">
            Revenue Recovery Operations
          </h1>

          <p className="text-sm text-slate-500 mt-1">
            Monitor payment incidents, recovery activity, and audit integrity.
          </p>
        </div>

        <Overview />
      </main>
    </div>
  );
}