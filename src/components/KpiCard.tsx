import React from 'react';
import { LucideIcon } from 'lucide-react';

interface KpiCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  colorClass: string;
}

export default function KpiCard({ label, value, icon: Icon, colorClass }: KpiCardProps) {
  return (
    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-start justify-between">
      <div>
        <div className="text-sm font-medium text-slate-500 mb-1">{label}</div>
        <div className="text-2xl font-bold text-slate-900">{value}</div>
      </div>
      <div className={`p-3 rounded-lg ${colorClass}`}>
        <Icon size={20} className="text-current" />
      </div>
    </div>
  );
}
