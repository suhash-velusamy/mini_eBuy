import React from 'react';

const statusConfig = {
  Active: {
    bg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    dot: 'bg-emerald-500',
    label: 'Active Auction',
  },
  'Pending Approval': {
    bg: 'bg-amber-50 text-amber-700 border-amber-200',
    dot: 'bg-amber-500',
    label: 'Pending Approval',
  },
  Reserved: {
    bg: 'bg-purple-50 text-purple-700 border-purple-200',
    dot: 'bg-purple-500',
    label: 'Reserved (Handover)',
  },
  Sold: {
    bg: 'bg-blue-50 text-blue-700 border-blue-200',
    dot: 'bg-blue-600',
    label: 'Sold',
  },
  Unsold: {
    bg: 'bg-slate-100 text-slate-700 border-slate-300',
    dot: 'bg-slate-400',
    label: 'Unsold',
  },
  Cancelled: {
    bg: 'bg-rose-50 text-rose-700 border-rose-200',
    dot: 'bg-rose-500',
    label: 'Cancelled',
  },
  Rejected: {
    bg: 'bg-red-50 text-red-700 border-red-200',
    dot: 'bg-red-500',
    label: 'Rejected',
  },
  'Failed Pickup': {
    bg: 'bg-stone-100 text-stone-700 border-stone-300',
    dot: 'bg-stone-500',
    label: 'Failed Pickup',
  },
};

const StatusBadge = ({ status, size = 'sm' }) => {
  const config = statusConfig[status] || {
    bg: 'bg-slate-100 text-slate-700 border-slate-200',
    dot: 'bg-slate-400',
    label: status || 'Unknown',
  };

  const sizeClasses =
    size === 'lg'
      ? 'px-3 py-1.5 text-sm font-semibold'
      : size === 'md'
      ? 'px-2.5 py-1 text-xs font-semibold'
      : 'px-2 py-0.5 text-xs font-medium';

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border ${config.bg} ${sizeClasses}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
      {config.label}
    </span>
  );
};

export default StatusBadge;
