import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api, ApiError } from '../api/client';
import { useAuth } from '../context/useAuth';
import type { RequestCategory, RequestItem, RequestPriority } from '../types';
import {
  FileText,
  AlertCircle,
  CheckCircle2,
  ArrowLeft,
  Send,
  Save,
  ArrowRight,
} from 'lucide-react';

export const CreateRequest: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Form fields
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<RequestCategory>('GENERAL');
  const [priority, setPriority] = useState<RequestPriority>('MEDIUM');
  const [dueDate, setDueDate] = useState('');

  // Validation & Submission State
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [transitioning, setTransitioning] = useState(false);
  const [createdRequest, setCreatedRequest] = useState<RequestItem | null>(null);

  // Permission check: only CLIENT_USER can create requests
  if (user?.role !== 'CLIENT_USER') {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-8 text-center max-w-lg mx-auto">
        <AlertCircle className="h-10 w-10 text-amber-500 mx-auto" />
        <h2 className="mt-3 text-lg font-bold text-slate-900">Access Restricted</h2>
        <p className="mt-1 text-sm text-slate-600">
          Only Client Users ({'CLIENT_USER'}) are authorized to initiate new requests.
        </p>
        <Link
          to="/requests"
          className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Requests
        </Link>
      </div>
    );
  }

  const validateForm = () => {
    const errors: Record<string, string> = {};
    if (!title.trim()) {
      errors.title = 'Title is required.';
    } else if (title.trim().length < 3) {
      errors.title = 'Title must be at least 3 characters.';
    }

    if (!description.trim()) {
      errors.description = 'Description is required.';
    } else if (description.trim().length < 10) {
      errors.description = 'Description must be at least 10 characters.';
    }

    if (!category) {
      errors.category = 'Category is required.';
    }

    if (!priority) {
      errors.priority = 'Priority is required.';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleCreate = async (autoSubmit: boolean) => {
    setServerError(null);
    if (!validateForm()) return;

    setSubmitting(true);
    try {
      // Rule: Never send organizationId or role in the body
      const payload = {
        title: title.trim(),
        description: description.trim(),
        category,
        priority,
        dueDate: dueDate ? new Date(dueDate).toISOString() : null,
      };

      const res = await api.createRequest(payload);
      const newReq = res.request;

      if (autoSubmit) {
        // Run DRAFT -> SUBMITTED transition immediately
        setTransitioning(true);
        await api.transitionRequest(newReq.id, {
          toStatus: 'SUBMITTED',
          expectedVersion: newReq.version,
        });
        navigate(`/requests/${newReq.id}`, { replace: true });
      } else {
        // Save as draft and present option to submit
        setCreatedRequest(newReq);
      }
    } catch (err: any) {
      if (err instanceof ApiError && err.details) {
        if (Array.isArray(err.details)) {
          const mapped: Record<string, string> = {};
          err.details.forEach((d: any) => {
            const field = d.path?.[0] || 'general';
            mapped[field] = d.message;
          });
          setFieldErrors(mapped);
        }
      }
      setServerError(err.message || 'Failed to create request.');
    } finally {
      setSubmitting(false);
      setTransitioning(false);
    }
  };

  // Submit draft to SUBMITTED after creation
  const handleSubmitCreatedDraft = async () => {
    if (!createdRequest) return;
    setTransitioning(true);
    setServerError(null);
    try {
      await api.transitionRequest(createdRequest.id, {
        toStatus: 'SUBMITTED',
        expectedVersion: createdRequest.version,
      });
      navigate(`/requests/${createdRequest.id}`, { replace: true });
    } catch (err: any) {
      setServerError(err.message || 'Failed to submit request for review.');
      setTransitioning(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            to="/requests"
            className="p-2 rounded-lg border border-slate-200 bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors"
            title="Back to requests"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Create Request</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Submit a feature request, bug report, or support ticket.
            </p>
          </div>
        </div>
      </div>

      {/* Draft Created Success Confirmation Box */}
      {createdRequest && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-6 space-y-4 shadow-xs">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="h-6 w-6 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <h2 className="text-base font-bold text-emerald-900">
                Request Saved as DRAFT!
              </h2>
              <p className="text-sm text-emerald-700 mt-1">
                "{createdRequest.title}" was saved as a draft. You can submit it now so managers can review it, or view the draft detail.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              onClick={handleSubmitCreatedDraft}
              disabled={transitioning}
              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-sm rounded-lg shadow-xs transition-colors disabled:opacity-50"
            >
              {transitioning ? (
                <>
                  <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  <span>Submitting...</span>
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  <span>Submit for Review Now</span>
                </>
              )}
            </button>

            <Link
              to={`/requests/${createdRequest.id}`}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-white border border-slate-300 text-slate-700 font-medium text-sm rounded-lg hover:bg-slate-50 transition-colors"
            >
              <span>View Request</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      )}

      {/* Main Form */}
      {!createdRequest && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 sm:p-8 shadow-xs">
          {serverError && (
            <div className="mb-6 rounded-lg bg-red-50 p-4 border border-red-200 flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
              <div className="text-sm text-red-700 font-medium">{serverError}</div>
            </div>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleCreate(false);
            }}
            className="space-y-6"
          >
            {/* Title */}
            <div>
              <label htmlFor="title" className="block text-sm font-semibold text-slate-800">
                Title <span className="text-red-500">*</span>
              </label>
              <div className="mt-1">
                <input
                  id="title"
                  type="text"
                  placeholder="e.g. Implement Single Sign-On via Okta"
                  value={title}
                  onChange={(e) => {
                    setTitle(e.target.value);
                    if (fieldErrors.title) {
                      setFieldErrors((prev) => ({ ...prev, title: '' }));
                    }
                  }}
                  className={`w-full px-3.5 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 ${
                    fieldErrors.title
                      ? 'border-red-300 focus:ring-red-500 bg-red-50/20'
                      : 'border-slate-300 focus:ring-indigo-500'
                  }`}
                />
              </div>
              {fieldErrors.title && (
                <p className="mt-1 text-xs text-red-600 font-medium">{fieldErrors.title}</p>
              )}
            </div>

            {/* Description */}
            <div>
              <label htmlFor="description" className="block text-sm font-semibold text-slate-800">
                Description <span className="text-red-500">*</span>
              </label>
              <div className="mt-1">
                <textarea
                  id="description"
                  rows={5}
                  placeholder="Provide detailed requirements, context, and expected outcome..."
                  value={description}
                  onChange={(e) => {
                    setDescription(e.target.value);
                    if (fieldErrors.description) {
                      setFieldErrors((prev) => ({ ...prev, description: '' }));
                    }
                  }}
                  className={`w-full px-3.5 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 ${
                    fieldErrors.description
                      ? 'border-red-300 focus:ring-red-500 bg-red-50/20'
                      : 'border-slate-300 focus:ring-indigo-500'
                  }`}
                />
              </div>
              {fieldErrors.description && (
                <p className="mt-1 text-xs text-red-600 font-medium">{fieldErrors.description}</p>
              )}
            </div>

            {/* Category and Priority Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Category */}
              <div>
                <label htmlFor="category" className="block text-sm font-semibold text-slate-800">
                  Category <span className="text-red-500">*</span>
                </label>
                <div className="mt-1">
                  <select
                    id="category"
                    value={category}
                    onChange={(e) => setCategory(e.target.value as RequestCategory)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                  >
                    <option value="GENERAL">General</option>
                    <option value="FEATURE_REQUEST">Feature Request</option>
                    <option value="BUG">Bug</option>
                    <option value="SUPPORT">Support</option>
                  </select>
                </div>
              </div>

              {/* Priority */}
              <div>
                <label htmlFor="priority" className="block text-sm font-semibold text-slate-800">
                  Priority <span className="text-red-500">*</span>
                </label>
                <div className="mt-1">
                  <select
                    id="priority"
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as RequestPriority)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                  >
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                    <option value="URGENT">Urgent</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Due Date */}
            <div>
              <label htmlFor="dueDate" className="block text-sm font-semibold text-slate-800">
                Target Due Date (Optional)
              </label>
              <div className="mt-1">
                <input
                  id="dueDate"
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full sm:w-64 px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                />
              </div>
              <p className="mt-1 text-xs text-slate-400">
                Used to compute SLA and overdue warnings for managers and assignees.
              </p>
            </div>

            {/* Actions */}
            <div className="pt-4 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-end gap-3">
              <Link
                to="/requests"
                className="w-full sm:w-auto px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors text-center"
              >
                Cancel
              </Link>

              <button
                type="submit"
                disabled={submitting || transitioning}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 border border-slate-300 rounded-lg hover:bg-slate-200 transition-colors disabled:opacity-50"
              >
                <Save className="h-4 w-4" />
                <span>Save as Draft</span>
              </button>

              <button
                type="button"
                disabled={submitting || transitioning}
                onClick={() => handleCreate(true)}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-5 py-2 text-sm font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors shadow-xs disabled:opacity-50"
              >
                {submitting || transitioning ? (
                  <>
                    <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    <span>Processing...</span>
                  </>
                ) : (
                  <>
                    <FileText className="h-4 w-4" />
                    <span>Save & Submit for Approval</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
