import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api, ApiError } from '../api/client';
import { useAuth } from '../context/useAuth';
import type { ActivityLog, RequestItem, RequestStatus } from '../types';
import { HistoryTimeline } from '../components/HistoryTimeline';
import { RejectModal } from '../components/RejectModal';
import {
  ArrowLeft,
  Clock,
  AlertTriangle,
  UserCheck,
  Building,
  User as UserIcon,
  Calendar,
  Layers,
  RefreshCw,
  XCircle,
  Send,
  Eye,
  Check,
  Play,
  CheckCircle2,
} from 'lucide-react';

const statusBadgeStyles: Record<RequestStatus, string> = {
  DRAFT: 'bg-slate-100 text-slate-700 border-slate-300',
  SUBMITTED: 'bg-blue-50 text-blue-700 border-blue-200',
  UNDER_REVIEW: 'bg-amber-50 text-amber-700 border-amber-200',
  APPROVED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  REJECTED: 'bg-rose-50 text-rose-700 border-rose-200',
  IN_PROGRESS: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  COMPLETED: 'bg-green-50 text-green-700 border-green-200',
};

export const RequestDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();

  const [request, setRequest] = useState<RequestItem | null>(null);
  const [history, setHistory] = useState<ActivityLog[]>([]);
  const [developers, setDevelopers] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [historyLoading, setHistoryLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Assignment state
  const [selectedAssigneeId, setSelectedAssigneeId] = useState<string>('');
  const [assigning, setAssigning] = useState<boolean>(false);

  // Transition & Modal state
  const [transitioning, setTransitioning] = useState<boolean>(false);
  const [rejectModalOpen, setRejectModalOpen] = useState<boolean>(false);

  const [refreshTrigger, setRefreshTrigger] = useState<number>(0);

  // Load Request and History
  useEffect(() => {
    if (!id) return;
    let ignore = false;

    Promise.all([api.getRequestById(id), api.getRequestHistory(id)])
      .then(([reqRes, histRes]) => {
        if (!ignore) {
          setRequest(reqRes.request);
          setSelectedAssigneeId(reqRes.request.assigneeId || '');
          setHistory(histRes.history || []);
          setLoading(false);
        }
      })
      .catch((err: any) => {
        if (!ignore) {
          setError(err.message || 'Failed to load request details.');
          setLoading(false);
        }
      });

    return () => {
      ignore = true;
    };
  }, [id, refreshTrigger]);

  // If user is MANAGER and status is assignable, load active developers via /users/assignable
  useEffect(() => {
    if (!user || user.role !== 'MANAGER' || !request) return;
    const assignableStatuses: RequestStatus[] = [
      'SUBMITTED',
      'UNDER_REVIEW',
      'APPROVED',
      'IN_PROGRESS',
    ];
    if (assignableStatuses.includes(request.status)) {
      api
        .getAssignableDevelopers()
        .then((res) => setDevelopers(res.developers || (res as any).users || []))
        .catch(() => {});
    }
  }, [user, request]);

  const reloadData = async () => {
    if (!id) return;
    setLoading(true);
    setActionError(null);
    setRefreshTrigger((prev) => prev + 1);
  };

  // State Machine Approval Workflow Actions
  const handleTransition = async (toStatus: RequestStatus, reason?: string) => {
    if (!request || transitioning) return;
    setTransitioning(true);
    setActionError(null);

    try {
      // Rule: Always send expectedVersion from the loaded request
      const res = await api.transitionRequest(request.id, {
        toStatus,
        expectedVersion: request.version,
        reason,
      });

      setRequest(res.request);
      setHistoryLoading(true);
      const hist = await api.getRequestHistory(request.id);
      setHistory(hist.history || []);
    } catch (err: any) {
      if (err instanceof ApiError && err.code === 'CONFLICT') {
        setActionError('This request was changed by someone else. Reloading latest state...');
        setTimeout(() => reloadData(), 1200);
      } else {
        setActionError(err.message || `Failed to transition request to ${toStatus}.`);
      }
      throw err;
    } finally {
      setTransitioning(false);
      setHistoryLoading(false);
    }
  };

  const handleAssignDeveloper = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!request || !selectedAssigneeId || assigning) return;

    setAssigning(true);
    setActionError(null);

    try {
      const res = await api.assignRequest(request.id, selectedAssigneeId, request.version);
      setRequest(res.request);
      setHistoryLoading(true);
      const hist = await api.getRequestHistory(request.id);
      setHistory(hist.history || []);
    } catch (err: any) {
      if (err instanceof ApiError && err.code === 'CONFLICT') {
        setActionError('This request was changed by someone else. Reloading latest state...');
        setTimeout(() => reloadData(), 1200);
      } else {
        setActionError(err.message || 'Failed to assign developer.');
      }
    } finally {
      setAssigning(false);
      setHistoryLoading(false);
    }
  };

  const formatDate = (isoString?: string | null) => {
    if (!isoString) return '—';
    return new Date(isoString).toLocaleDateString(undefined, {
      dateStyle: 'medium',
    });
  };

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="h-6 bg-slate-200 rounded w-32 animate-pulse" />
        <div className="h-48 bg-white rounded-xl border border-slate-200 p-6 animate-pulse space-y-4">
          <div className="h-8 bg-slate-200 rounded w-1/2" />
          <div className="h-4 bg-slate-200 rounded w-1/3" />
        </div>
      </div>
    );
  }

  if (error || !request) {
    return (
      <div className="max-w-2xl mx-auto rounded-xl border border-red-200 bg-red-50 p-8 text-center shadow-xs">
        <AlertTriangle className="h-10 w-10 text-red-500 mx-auto" />
        <h2 className="mt-3 text-lg font-bold text-red-800">Request Not Found or Inaccessible</h2>
        <p className="mt-1 text-sm text-red-600">{error || 'Unable to load request.'}</p>
        <div className="mt-5 flex justify-center gap-3">
          <Link
            to="/requests"
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-white border border-slate-300 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-50"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Requests
          </Link>
          <button
            onClick={reloadData}
            className="px-4 py-2 bg-red-600 text-white text-sm font-semibold rounded-lg hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // State machine permission checks based on current role and status
  const canSubmitDraft =
    request.status === 'DRAFT' &&
    user?.role === 'CLIENT_USER' &&
    request.ownerId === user?.id;

  const canStartReview =
    request.status === 'SUBMITTED' && user?.role === 'MANAGER';

  const canApprove =
    request.status === 'UNDER_REVIEW' && user?.role === 'MANAGER';

  const canReject =
    request.status === 'UNDER_REVIEW' && user?.role === 'MANAGER';

  const canStartWork =
    request.status === 'APPROVED' &&
    user?.role === 'DEVELOPER' &&
    request.assigneeId === user?.id;

  const canComplete =
    request.status === 'IN_PROGRESS' &&
    user?.role === 'DEVELOPER' &&
    request.assigneeId === user?.id;

  const hasAnyWorkflowAction =
    canSubmitDraft || canStartReview || canApprove || canReject || canStartWork || canComplete;

  const isAssignableStatus =
    ['SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'IN_PROGRESS'].includes(request.status);

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Back button and quick actions */}
      <div className="flex items-center justify-between">
        <Link
          to="/requests"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Requests</span>
        </Link>
        <button
          onClick={reloadData}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors shadow-xs"
        >
          <RefreshCw className="h-3.5 w-3.5 text-slate-500" />
          <span>Refresh</span>
        </button>
      </div>

      {/* Action error banner */}
      {actionError && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
          <div className="text-sm text-red-700 font-medium">{actionError}</div>
        </div>
      )}

      {/* Rejection Reason Alert if Rejected */}
      {(request.status === 'REJECTED' || request.rejectionReason) && (
        <div className="rounded-xl border border-rose-300 bg-rose-50 p-5 shadow-xs flex items-start gap-3">
          <XCircle className="h-6 w-6 text-rose-600 shrink-0 mt-0.5" />
          <div>
            <h2 className="text-sm font-bold text-rose-900">Request Rejected</h2>
            <p className="text-sm text-rose-800 mt-1 font-medium">
              Reason: "{request.rejectionReason || 'No reason provided.'}"
            </p>
            <p className="text-xs text-rose-600 mt-1">
              This request is in a terminal state and cannot be transitioned further.
            </p>
          </div>
        </div>
      )}

      {/* Main Request Card */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 sm:p-8 shadow-xs space-y-6">
        {/* Title and Badges */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`inline-block px-2.5 py-1 text-xs font-semibold rounded-full border ${
                  statusBadgeStyles[request.status]
                }`}
              >
                {request.status.replace('_', ' ')}
              </span>
              <span className="text-xs font-medium bg-slate-100 text-slate-700 px-2 py-0.5 rounded">
                {request.category.replace('_', ' ')}
              </span>
              <span
                className={`text-xs font-semibold px-2 py-0.5 rounded ${
                  request.priority === 'URGENT'
                    ? 'bg-red-100 text-red-700'
                    : request.priority === 'HIGH'
                    ? 'bg-amber-100 text-amber-700'
                    : 'bg-blue-100 text-blue-700'
                }`}
              >
                {request.priority} Priority
              </span>
              {request.isOverdue && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-xs font-bold bg-rose-100 text-rose-700 border border-rose-200">
                  <Clock className="h-3 w-3" />
                  OVERDUE
                </span>
              )}
            </div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{request.title}</h1>
          </div>

          <div className="text-xs text-slate-400 font-mono sm:text-right">
            Version: v{request.version}
          </div>
        </div>

        {/* Workflow Approval Action Bar (Buttons shown only when state machine allows) */}
        {hasAnyWorkflowAction && (
          <div className="p-4 bg-indigo-50/70 border border-indigo-100 rounded-xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <span className="text-xs font-bold text-indigo-900 uppercase tracking-wider">
                Workflow Actions Available
              </span>
              <p className="text-xs text-indigo-700 mt-0.5">
                Current State: <strong className="font-semibold">{request.status}</strong>
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* DRAFT -> SUBMITTED (CLIENT_USER Owner) */}
              {canSubmitDraft && (
                <button
                  onClick={() => handleTransition('SUBMITTED')}
                  disabled={transitioning}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors disabled:opacity-50"
                >
                  <Send className="h-3.5 w-3.5" />
                  <span>Submit for Review</span>
                </button>
              )}

              {/* SUBMITTED -> UNDER_REVIEW (MANAGER) */}
              {canStartReview && (
                <button
                  onClick={() => handleTransition('UNDER_REVIEW')}
                  disabled={transitioning}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors disabled:opacity-50"
                >
                  <Eye className="h-3.5 w-3.5" />
                  <span>Start Review</span>
                </button>
              )}

              {/* UNDER_REVIEW -> APPROVED (MANAGER) */}
              {canApprove && (
                <button
                  onClick={() => handleTransition('APPROVED')}
                  disabled={transitioning}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors disabled:opacity-50"
                >
                  <Check className="h-3.5 w-3.5" />
                  <span>Approve Request</span>
                </button>
              )}

              {/* UNDER_REVIEW -> REJECTED (MANAGER) */}
              {canReject && (
                <button
                  onClick={() => setRejectModalOpen(true)}
                  disabled={transitioning}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors disabled:opacity-50"
                >
                  <XCircle className="h-3.5 w-3.5" />
                  <span>Reject Request</span>
                </button>
              )}

              {/* APPROVED -> IN_PROGRESS (DEVELOPER Assignee) */}
              {canStartWork && (
                <button
                  onClick={() => handleTransition('IN_PROGRESS')}
                  disabled={transitioning}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors disabled:opacity-50"
                >
                  <Play className="h-3.5 w-3.5" />
                  <span>Start Work</span>
                </button>
              )}

              {/* IN_PROGRESS -> COMPLETED (DEVELOPER Assignee) */}
              {canComplete && (
                <button
                  onClick={() => handleTransition('COMPLETED')}
                  disabled={transitioning}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors disabled:opacity-50"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>Mark Completed</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* Description */}
        <div className="border-t border-slate-100 pt-5">
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
            Description
          </h2>
          <div className="text-sm text-slate-800 whitespace-pre-wrap bg-slate-50/70 p-4 rounded-xl border border-slate-100 leading-relaxed font-sans">
            {request.description}
          </div>
        </div>

        {/* Request Metadata Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-4 border-t border-slate-100 text-xs">
          {/* Client */}
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
            <span className="text-slate-400 font-medium flex items-center gap-1">
              <Building className="h-3.5 w-3.5" />
              Client
            </span>
            <p className="mt-1 text-sm font-semibold text-slate-800">
              {request.client ? request.client.name : 'Direct / Self'}
            </p>
          </div>

          {/* Owner */}
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
            <span className="text-slate-400 font-medium flex items-center gap-1">
              <UserIcon className="h-3.5 w-3.5" />
              Creator
            </span>
            <p className="mt-1 text-sm font-semibold text-slate-800">
              {request.owner ? request.owner.name : 'Unknown'}
            </p>
            {request.owner && (
              <p className="text-slate-400 text-xs truncate">{request.owner.email}</p>
            )}
          </div>

          {/* Due Date */}
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
            <span className="text-slate-400 font-medium flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" />
              Target Due Date
            </span>
            <p
              className={`mt-1 text-sm font-semibold ${
                request.isOverdue ? 'text-rose-600' : 'text-slate-800'
              }`}
            >
              {formatDate(request.dueDate)}
            </p>
          </div>

          {/* Current Assignee */}
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
            <span className="text-slate-400 font-medium flex items-center gap-1">
              <UserCheck className="h-3.5 w-3.5" />
              Assignee
            </span>
            <p className="mt-1 text-sm font-semibold text-slate-800">
              {request.assignee ? request.assignee.name : 'Unassigned'}
            </p>
            {request.assignee && (
              <p className="text-slate-400 text-xs truncate">{request.assignee.email}</p>
            )}
          </div>
        </div>

        {/* Manager Developer Assignment Dropdown */}
        {user?.role === 'MANAGER' && isAssignableStatus && (
          <div className="pt-4 border-t border-slate-200 bg-amber-50/50 p-4 rounded-xl border border-amber-200">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                  <UserCheck className="h-4 w-4 text-amber-600" />
                  <span>Assign Developer</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Select an active developer in your organization to work on this request.
                </p>
              </div>

              <form onSubmit={handleAssignDeveloper} className="flex items-center gap-2">
                <select
                  value={selectedAssigneeId}
                  onChange={(e) => setSelectedAssigneeId(e.target.value)}
                  disabled={assigning}
                  className="px-3 py-1.5 text-xs border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">Select a Developer...</option>
                  {developers.map((dev) => (
                    <option key={dev.id} value={dev.id}>
                      {dev.name}
                    </option>
                  ))}
                </select>

                <button
                  type="submit"
                  disabled={!selectedAssigneeId || assigning}
                  className="px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors shadow-xs"
                >
                  {assigning ? 'Saving...' : 'Assign'}
                </button>
              </form>
            </div>
          </div>
        )}
      </div>

      {/* History Timeline Card */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 sm:p-8 shadow-xs">
        <h2 className="text-base font-bold text-slate-900 mb-6 flex items-center gap-2">
          <Layers className="h-5 w-5 text-indigo-600" />
          <span>Audit History Timeline</span>
        </h2>
        <HistoryTimeline logs={history} loading={historyLoading} />
      </div>

      {/* Reject Modal */}
      <RejectModal
        isOpen={rejectModalOpen}
        onClose={() => setRejectModalOpen(false)}
        onConfirm={(reason) => handleTransition('REJECTED', reason)}
        loading={transitioning}
      />
    </div>
  );
};

