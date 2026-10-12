import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/useAuth';
import type { DashboardMetrics, RequestPriority, RequestStatus } from '../types';
import {
  AlertTriangle,
  Clock,
  CheckCircle2,
  ListFilter,
  RefreshCw,
  PlusCircle,
  FileQuestion,
  Layers,
  ArrowRight,
} from 'lucide-react';

const statusDisplay: Record<RequestStatus, { label: string; color: string; bg: string }> = {
  DRAFT: { label: 'Draft', color: 'text-slate-700', bg: 'bg-slate-100' },
  SUBMITTED: { label: 'Submitted', color: 'text-blue-700', bg: 'bg-blue-100' },
  UNDER_REVIEW: { label: 'Under Review', color: 'text-amber-700', bg: 'bg-amber-100' },
  APPROVED: { label: 'Approved', color: 'text-emerald-700', bg: 'bg-emerald-100' },
  REJECTED: { label: 'Rejected', color: 'text-rose-700', bg: 'bg-rose-100' },
  IN_PROGRESS: { label: 'In Progress', color: 'text-indigo-700', bg: 'bg-indigo-100' },
  COMPLETED: { label: 'Completed', color: 'text-green-800', bg: 'bg-green-100' },
};

const priorityDisplay: Record<RequestPriority, { label: string; color: string; border: string }> = {
  LOW: { label: 'Low', color: 'text-slate-600', border: 'border-slate-300' },
  MEDIUM: { label: 'Medium', color: 'text-blue-600', border: 'border-blue-300' },
  HIGH: { label: 'High', color: 'text-amber-600', border: 'border-amber-300' },
  URGENT: { label: 'Urgent', color: 'text-red-600', border: 'border-red-300' },
};

export const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMetrics = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getDashboard();
      setMetrics(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load dashboard metrics from server.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let ignore = false;
    api.getDashboard()
      .then((data) => {
        if (!ignore) {
          setMetrics(data);
          setLoading(false);
        }
      })
      .catch((err: any) => {
        if (!ignore) {
          setError(err.message || 'Failed to load dashboard metrics from server.');
          setLoading(false);
        }
      });

    return () => {
      ignore = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 bg-slate-200 rounded-md w-48 animate-pulse"></div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-32 bg-white rounded-xl border border-slate-200 p-5 animate-pulse">
              <div className="h-4 bg-slate-200 rounded-md w-24 mb-3"></div>
              <div className="h-8 bg-slate-200 rounded-md w-16"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
        <AlertTriangle className="h-10 w-10 text-red-500 mx-auto" />
        <h3 className="mt-2 text-base font-semibold text-red-800">Unable to load dashboard</h3>
        <p className="mt-1 text-sm text-red-600">{error}</p>
        <button
          onClick={fetchMetrics}
          className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors shadow-xs"
        >
          <RefreshCw className="h-4 w-4" />
          Retry
        </button>
      </div>
    );
  }

  if (!metrics) {
    return null;
  }

  const activeCount =
    (metrics.byStatus.SUBMITTED || 0) +
    (metrics.byStatus.UNDER_REVIEW || 0) +
    (metrics.byStatus.APPROVED || 0) +
    (metrics.byStatus.IN_PROGRESS || 0);

  return (
    <div className="space-y-8">
      {/* Header with Title and Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Overview Dashboard</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Real-time status, priorities and SLA tracking for your organization.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchMetrics}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors shadow-xs"
            title="Refresh metrics"
          >
            <RefreshCw className="h-4 w-4 text-slate-500" />
            <span>Refresh</span>
          </button>
          {user?.role === 'CLIENT_USER' && (
            <Link
              to="/requests/new"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors shadow-xs"
            >
              <PlusCircle className="h-4 w-4" />
              <span>Create Request</span>
            </Link>
          )}
        </div>
      </div>

      {/* Clear Overdue Alert Banner if overdue > 0 */}
      {metrics.overdue > 0 && (
        <div className="rounded-xl border border-red-300 bg-red-50 p-4 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 animate-fade-in">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-red-100 text-red-600 shrink-0">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-red-900">
                Action Required: {metrics.overdue} {metrics.overdue === 1 ? 'Request is' : 'Requests are'} Past Due!
              </h2>
              <p className="text-xs text-red-700 mt-0.5">
                These requests have exceeded their due date and require immediate attention.
              </p>
            </div>
          </div>
          <Link
            to="/requests?overdue=true"
            className="inline-flex items-center justify-center gap-1 px-3 py-1.5 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-md transition-colors shadow-xs"
          >
            <span>View Overdue Requests</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      )}

      {/* Top 4 KPI Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Requests */}
        <Link
          to="/requests"
          className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs hover:border-slate-300 hover:shadow-sm transition-all"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Total Requests</span>
            <div className="p-2 bg-slate-100 rounded-lg text-slate-600">
              <Layers className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-3xl font-extrabold text-slate-900">{metrics.total}</span>
            <span className="text-xs text-indigo-600 font-medium">View all &rarr;</span>
          </div>
        </Link>

        {/* Overdue Requests - Prominently highlighted */}
        <Link
          to="/requests?overdue=true"
          className={`rounded-xl border p-5 shadow-xs transition-all ${
            metrics.overdue > 0
              ? 'bg-rose-50 border-rose-300 ring-1 ring-rose-200 hover:bg-rose-100/60'
              : 'bg-white border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span
              className={`text-xs font-medium uppercase tracking-wider ${
                metrics.overdue > 0 ? 'text-rose-700 font-bold' : 'text-slate-500'
              }`}
            >
              Overdue
            </span>
            <div
              className={`p-2 rounded-lg ${
                metrics.overdue > 0 ? 'bg-rose-200 text-rose-700' : 'bg-slate-100 text-slate-600'
              }`}
            >
              <Clock className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span
              className={`text-3xl font-extrabold ${
                metrics.overdue > 0 ? 'text-rose-700' : 'text-slate-900'
              }`}
            >
              {metrics.overdue}
            </span>
            <span className={`text-xs font-medium ${metrics.overdue > 0 ? 'text-rose-700' : 'text-slate-500'}`}>
              {metrics.overdue > 0 ? 'Attention needed &rarr;' : 'On schedule'}
            </span>
          </div>
        </Link>

        {/* In Workflow / Active */}
        <Link
          to="/requests"
          className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs hover:border-slate-300 hover:shadow-sm transition-all"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">In Progress & Active</span>
            <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600">
              <ListFilter className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-3xl font-extrabold text-indigo-700">{activeCount}</span>
            <span className="text-xs text-indigo-600 font-medium">In pipeline</span>
          </div>
        </Link>

        {/* Completed */}
        <Link
          to="/requests?status=COMPLETED"
          className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs hover:border-slate-300 hover:shadow-sm transition-all"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Completed</span>
            <div className="p-2 bg-emerald-50 rounded-lg text-emerald-600">
              <CheckCircle2 className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-3xl font-extrabold text-emerald-700">{metrics.byStatus.COMPLETED || 0}</span>
            <span className="text-xs text-emerald-600 font-medium">Delivered</span>
          </div>
        </Link>
      </div>

      {/* Breakdown Grids: Status and Priority */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Breakdown by Status */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs">
          <h2 className="text-base font-bold text-slate-900 mb-4 flex items-center justify-between">
            <span>Requests by Status</span>
            <span className="text-xs font-normal text-slate-500">Click to filter</span>
          </h2>

          <div className="space-y-3">
            {(Object.keys(statusDisplay) as RequestStatus[]).map((st) => {
              const count = metrics.byStatus[st] || 0;
              const meta = statusDisplay[st];
              const pct = metrics.total > 0 ? Math.round((count / metrics.total) * 100) : 0;

              return (
                <Link
                  key={st}
                  to={`/requests?status=${st}`}
                  className="flex items-center justify-between p-3 rounded-lg hover:bg-slate-50 border border-slate-100 transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`text-xs font-semibold px-2.5 py-1 rounded-md ${meta.bg} ${meta.color}`}
                    >
                      {meta.label}
                    </span>
                    <span className="text-xs text-slate-400 font-medium">{pct}% of total</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-slate-900 group-hover:text-indigo-600">
                      {count}
                    </span>
                    <ArrowRight className="h-3.5 w-3.5 text-slate-400 group-hover:text-indigo-600 transition-colors" />
                  </div>
                </Link>
              );
            })}
          </div>
        </div>

        {/* Breakdown by Priority */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs">
          <h2 className="text-base font-bold text-slate-900 mb-4 flex items-center justify-between">
            <span>Requests by Priority</span>
            <span className="text-xs font-normal text-slate-500">Click to filter</span>
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {(Object.keys(priorityDisplay) as RequestPriority[]).map((pr) => {
              const count = metrics.byPriority[pr] || 0;
              const meta = priorityDisplay[pr];

              return (
                <Link
                  key={pr}
                  to={`/requests?priority=${pr}`}
                  className={`p-4 rounded-xl border ${meta.border} bg-slate-50/50 hover:bg-white hover:shadow-xs transition-all flex flex-col justify-between`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`text-xs font-bold uppercase tracking-wider ${meta.color}`}>
                      {meta.label}
                    </span>
                    <div
                      className={`h-2.5 w-2.5 rounded-full ${
                        pr === 'URGENT'
                          ? 'bg-red-500'
                          : pr === 'HIGH'
                          ? 'bg-amber-500'
                          : pr === 'MEDIUM'
                          ? 'bg-blue-500'
                          : 'bg-slate-400'
                      }`}
                    />
                  </div>
                  <div className="mt-4 flex items-baseline justify-between">
                    <span className="text-2xl font-black text-slate-900">{count}</span>
                    <span className="text-xs text-slate-500">Filter &rarr;</span>
                  </div>
                </Link>
              );
            })}
          </div>

          {metrics.total === 0 && (
            <div className="mt-6 p-6 text-center border border-dashed border-slate-200 rounded-xl">
              <FileQuestion className="h-8 w-8 text-slate-400 mx-auto" />
              <p className="mt-2 text-sm text-slate-600 font-medium">No requests found</p>
              <p className="text-xs text-slate-400 mt-0.5">
                {user?.role === 'CLIENT_USER'
                  ? 'Start by creating your first request.'
                  : 'No requests have been submitted in your tenant yet.'}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
