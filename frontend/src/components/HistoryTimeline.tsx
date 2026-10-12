import React from 'react';
import type { ActivityLog } from '../types';
import {
  FilePlus,
  Edit3,
  UserCheck,
  CheckCircle,
  XCircle,
  PlayCircle,
  Clock,
} from 'lucide-react';

interface HistoryTimelineProps {
  logs: ActivityLog[];
  loading?: boolean;
}

export const HistoryTimeline: React.FC<HistoryTimelineProps> = ({ logs, loading }) => {
  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-14 bg-slate-100 rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  if (!logs || logs.length === 0) {
    return (
      <div className="p-6 text-center text-xs text-slate-500 border border-dashed border-slate-200 rounded-xl">
        No activity recorded for this request yet.
      </div>
    );
  }

  const getEventIcon = (event: string, metadata?: any) => {
    switch (event) {
      case 'CREATED':
        return <FilePlus className="h-4 w-4 text-emerald-600" />;
      case 'UPDATED':
        return <Edit3 className="h-4 w-4 text-blue-600" />;
      case 'ASSIGNED':
        return <UserCheck className="h-4 w-4 text-indigo-600" />;
      case 'STATUS_CHANGED':
        if (metadata?.to === 'APPROVED' || metadata?.newStatus === 'APPROVED') {
          return <CheckCircle className="h-4 w-4 text-emerald-600" />;
        }
        if (metadata?.to === 'REJECTED' || metadata?.newStatus === 'REJECTED') {
          return <XCircle className="h-4 w-4 text-rose-600" />;
        }
        if (metadata?.to === 'IN_PROGRESS' || metadata?.newStatus === 'IN_PROGRESS') {
          return <PlayCircle className="h-4 w-4 text-indigo-600" />;
        }
        if (metadata?.to === 'COMPLETED' || metadata?.newStatus === 'COMPLETED') {
          return <CheckCircle className="h-4 w-4 text-green-600" />;
        }
        return <Clock className="h-4 w-4 text-amber-600" />;
      default:
        return <Clock className="h-4 w-4 text-slate-500" />;
    }
  };

  const formatEventDescription = (log: ActivityLog) => {
    const actorName = log.actor?.name || 'User';
    const actorRole = log.actor?.role ? `(${log.actor.role})` : '';

    switch (log.event) {
      case 'CREATED':
        return (
          <span>
            <strong className="text-slate-800">{actorName}</strong> {actorRole} created this request as <span className="font-semibold text-slate-700">DRAFT</span>.
          </span>
        );
      case 'UPDATED': {
        const fields = log.metadata?.changedFields || [];
        return (
          <span>
            <strong className="text-slate-800">{actorName}</strong> {actorRole} updated request fields:{' '}
            <code className="bg-slate-100 px-1.5 py-0.5 rounded text-xs text-slate-700">
              {Array.isArray(fields) && fields.length > 0 ? fields.join(', ') : 'details'}
            </code>
          </span>
        );
      }
      case 'ASSIGNED': {
        return (
          <span>
            <strong className="text-slate-800">{actorName}</strong> {actorRole} assigned request to developer.
          </span>
        );
      }
      case 'STATUS_CHANGED': {
        const from = log.metadata?.from || log.metadata?.previousStatus || '—';
        const to = log.metadata?.to || log.metadata?.newStatus || '—';
        const reason = log.metadata?.reason;

        return (
          <div>
            <span>
              <strong className="text-slate-800">{actorName}</strong> {actorRole} changed status from{' '}
              <span className="font-semibold text-slate-700">{from}</span> to{' '}
              <span className="font-semibold text-indigo-700">{to}</span>.
            </span>
            {reason && (
              <p className="mt-1 text-xs text-rose-700 bg-rose-50 border border-rose-200 p-2 rounded-md font-medium">
                Reason: "{reason}"
              </p>
            )}
          </div>
        );
      }
      default:
        return (
          <span>
            <strong className="text-slate-800">{actorName}</strong> performed {log.event}.
          </span>
        );
    }
  };

  return (
    <div className="flow-root">
      <ul className="-mb-8">
        {logs.map((log, logIdx) => {
          const isLast = logIdx === logs.length - 1;
          const date = new Date(log.createdAt).toLocaleString(undefined, {
            dateStyle: 'medium',
            timeStyle: 'short',
          });

          return (
            <li key={log.id}>
              <div className="relative pb-8">
                {!isLast && (
                  <span
                    className="absolute top-4 left-4 -ml-px h-full w-0.5 bg-slate-200"
                    aria-hidden="true"
                  />
                )}
                <div className="relative flex items-start space-x-3">
                  <div className="relative">
                    <div className="h-8 w-8 rounded-full bg-white border border-slate-200 flex items-center justify-center ring-4 ring-white shadow-xs">
                      {getEventIcon(log.event, log.metadata)}
                    </div>
                  </div>
                  <div className="min-w-0 flex-1 pt-1.5 flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-1">
                    <div className="text-sm text-slate-600">
                      {formatEventDescription(log)}
                    </div>
                    <div className="text-right text-xs text-slate-400 whitespace-nowrap">
                      {date}
                    </div>
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
};
