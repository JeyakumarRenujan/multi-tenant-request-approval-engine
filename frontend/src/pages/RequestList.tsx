import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/useAuth';
import type { RequestItem, RequestPriority, RequestStatus } from '../types';
import {
  Search,
  Filter,
  PlusCircle,
  AlertCircle,
  Clock,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  FileQuestion,
  RefreshCw,
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

const priorityBadgeStyles: Record<RequestPriority, string> = {
  LOW: 'text-slate-600 bg-slate-100',
  MEDIUM: 'text-blue-700 bg-blue-100',
  HIGH: 'text-amber-700 bg-amber-100',
  URGENT: 'text-red-700 bg-red-100 font-bold',
};

export const RequestList: React.FC = () => {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  // Directly derive active filters from URL searchParams
  const status = searchParams.get('status') || '';
  const priority = searchParams.get('priority') || '';
  const category = searchParams.get('category') || '';
  const overdue = searchParams.get('overdue') || '';
  const search = searchParams.get('search') || '';
  const page = Number(searchParams.get('page')) || 1;
  const pageSize = 10;

  const [searchInput, setSearchInput] = useState(search);
  const [requests, setRequests] = useState<RequestItem[]>([]);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState<number>(0);

  useEffect(() => {
    let ignore = false;
    api
      .getRequests({
        status: status || undefined,
        priority: priority || undefined,
        category: category || undefined,
        overdue: overdue === 'true' ? true : overdue === 'false' ? false : undefined,
        search: search.trim() || undefined,
        page,
        pageSize,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      })
      .then((res) => {
        if (!ignore) {
          setRequests(res.data);
          setTotalPages(res.pagination.totalPages || 1);
          setTotalCount(res.pagination.total || 0);
          setLoading(false);
        }
      })
      .catch((err: any) => {
        if (!ignore) {
          setError(err.message || 'Failed to load requests from server.');
          setLoading(false);
        }
      });

    return () => {
      ignore = true;
    };
  }, [status, priority, category, overdue, search, page, refreshTrigger]);

  const updateFilters = (newParams: Record<string, string | number>) => {
    setLoading(true);
    const updated = new URLSearchParams(searchParams);
    Object.entries(newParams).forEach(([key, val]) => {
      if (val === '' || val === undefined) {
        updated.delete(key);
      } else {
        updated.set(key, String(val));
      }
    });
    // Reset page to 1 whenever filters change unless explicitly changing page
    if (!('page' in newParams)) {
      updated.set('page', '1');
    }
    setSearchParams(updated);
  };

  const handleResetFilters = () => {
    setLoading(true);
    setSearchInput('');
    setSearchParams(new URLSearchParams());
  };

  const formatDate = (isoString?: string | null) => {
    if (!isoString) return '—';
    return new Date(isoString).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Requests</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Browse and manage approval requests in your organization.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setLoading(true);
              setRefreshTrigger((prev) => prev + 1);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors shadow-xs"
            title="Refresh list"
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
              <span>New Request</span>
            </Link>
          )}
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Search by title / description */}
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
              <Search className="h-4 w-4" />
            </div>
            <input
              type="text"
              placeholder="Search by title..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  updateFilters({ search: searchInput, page: 1 });
                }
              }}
              onBlur={() => {
                if (searchInput !== search) {
                  updateFilters({ search: searchInput, page: 1 });
                }
              }}
              className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Status filter */}
          <div>
            <select
              value={status}
              onChange={(e) => updateFilters({ status: e.target.value, page: 1 })}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white text-slate-700"
            >
              <option value="">All Statuses</option>
              <option value="DRAFT">Draft</option>
              <option value="SUBMITTED">Submitted</option>
              <option value="UNDER_REVIEW">Under Review</option>
              <option value="APPROVED">Approved</option>
              <option value="REJECTED">Rejected</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="COMPLETED">Completed</option>
            </select>
          </div>

          {/* Priority filter */}
          <div>
            <select
              value={priority}
              onChange={(e) => updateFilters({ priority: e.target.value, page: 1 })}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white text-slate-700"
            >
              <option value="">All Priorities</option>
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
              <option value="URGENT">Urgent</option>
            </select>
          </div>

          {/* Category filter */}
          <div>
            <select
              value={category}
              onChange={(e) => updateFilters({ category: e.target.value, page: 1 })}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white text-slate-700"
            >
              <option value="">All Categories</option>
              <option value="BUG">Bug</option>
              <option value="FEATURE_REQUEST">Feature Request</option>
              <option value="SUPPORT">Support</option>
              <option value="GENERAL">General</option>
            </select>
          </div>

          {/* Overdue filter */}
          <div>
            <select
              value={overdue}
              onChange={(e) => updateFilters({ overdue: e.target.value, page: 1 })}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white text-slate-700 font-medium"
            >
              <option value="">All Due Dates</option>
              <option value="true">⚠️ Overdue Only</option>
              <option value="false">On Schedule</option>
            </select>
          </div>
        </div>

        {/* Active Filters & Reset button */}
        {(status || priority || category || overdue || search) && (
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 text-xs text-slate-600">
            <div className="flex items-center gap-1.5 flex-wrap">
              <Filter className="h-3.5 w-3.5 text-slate-400" />
              <span className="font-semibold text-slate-700">Filters active:</span>
              {status && <span className="bg-slate-100 px-2 py-0.5 rounded">Status: {status}</span>}
              {priority && <span className="bg-slate-100 px-2 py-0.5 rounded">Priority: {priority}</span>}
              {category && <span className="bg-slate-100 px-2 py-0.5 rounded">Category: {category}</span>}
              {overdue === 'true' && <span className="bg-rose-100 text-rose-700 px-2 py-0.5 rounded font-bold">Overdue Only</span>}
              {search && <span className="bg-slate-100 px-2 py-0.5 rounded">"{search}"</span>}
            </div>
            <button
              onClick={handleResetFilters}
              className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-medium cursor-pointer"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset Filters
            </button>
          </div>
        )}
      </div>

      {/* Error state */}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
          <AlertCircle className="h-8 w-8 text-red-500 mx-auto" />
          <h3 className="mt-2 text-sm font-bold text-red-800">Failed to load requests</h3>
          <p className="mt-1 text-xs text-red-600">{error}</p>
          <button
            onClick={() => {
              setLoading(true);
              setRefreshTrigger((prev) => prev + 1);
            }}
            className="mt-3 px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs font-semibold hover:bg-red-700"
          >
            Try Again
          </button>
        </div>
      )}

      {/* Loading Skeleton */}
      {loading && !error && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-14 bg-slate-100 rounded-lg animate-pulse" />
          ))}
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && requests.length === 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center shadow-xs">
          <FileQuestion className="h-12 w-12 text-slate-300 mx-auto" />
          <h3 className="mt-3 text-base font-bold text-slate-800">No requests match your criteria</h3>
          <p className="mt-1 text-sm text-slate-500 max-w-sm mx-auto">
            Try adjusting your search terms or filters to find what you are looking for.
          </p>
          <div className="mt-5 flex justify-center gap-3">
            {(status || priority || category || overdue || search) && (
              <button
                onClick={handleResetFilters}
                className="px-3.5 py-2 text-sm font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200"
              >
                Clear Filters
              </button>
            )}
            {user?.role === 'CLIENT_USER' && (
              <Link
                to="/requests/new"
                className="px-3.5 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700"
              >
                Create New Request
              </Link>
            )}
          </div>
        </div>
      )}

      {/* Requests Data Display */}
      {!loading && !error && requests.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
              <thead className="bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                <tr>
                  <th scope="col" className="px-6 py-3.5">Title</th>
                  <th scope="col" className="px-6 py-3.5">Status</th>
                  <th scope="col" className="px-6 py-3.5">Priority</th>
                  <th scope="col" className="px-6 py-3.5">Category</th>
                  <th scope="col" className="px-6 py-3.5">Due Date</th>
                  <th scope="col" className="px-6 py-3.5">Assignee</th>
                  <th scope="col" className="px-6 py-3.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {requests.map((req) => (
                  <tr key={req.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <Link
                          to={`/requests/${req.id}`}
                          className="font-medium text-slate-900 hover:text-indigo-600 transition-colors"
                        >
                          {req.title}
                        </Link>
                        {/* Clear Overdue Badge */}
                        {req.isOverdue && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold bg-rose-100 text-rose-700 border border-rose-200">
                            <Clock className="h-3 w-3" />
                            OVERDUE
                          </span>
                        )}
                      </div>
                      {req.client && (
                        <p className="text-xs text-slate-500 mt-0.5 font-medium">
                          Client: {req.client.name}
                        </p>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`inline-block px-2.5 py-1 text-xs font-semibold rounded-full border ${
                          statusBadgeStyles[req.status]
                        }`}
                      >
                        {req.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`inline-block px-2 py-0.5 text-xs font-medium rounded ${
                          priorityBadgeStyles[req.priority]
                        }`}
                      >
                        {req.priority}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-xs text-slate-600">
                      {req.category.replace('_', ' ')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-xs text-slate-600 font-medium">
                      <span className={req.isOverdue ? 'text-rose-600 font-bold' : ''}>
                        {formatDate(req.dueDate)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-xs text-slate-600">
                      {req.assignee ? (
                        <span className="font-medium text-slate-800">{req.assignee.name}</span>
                      ) : (
                        <span className="text-slate-400 italic">Unassigned</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-xs">
                      <Link
                        to={`/requests/${req.id}`}
                        className="inline-flex items-center gap-1 font-semibold text-indigo-600 hover:text-indigo-800"
                      >
                        <span>View</span>
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Card View (Phone width responsive layout) */}
          <div className="md:hidden divide-y divide-slate-100">
            {requests.map((req) => (
              <div key={req.id} className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <Link
                      to={`/requests/${req.id}`}
                      className="font-semibold text-slate-900 text-sm hover:text-indigo-600"
                    >
                      {req.title}
                    </Link>
                    {req.client && (
                      <p className="text-xs text-slate-500 mt-0.5">Client: {req.client.name}</p>
                    )}
                  </div>
                  <span
                    className={`inline-block px-2 py-0.5 text-xs font-semibold rounded-full border shrink-0 ${
                      statusBadgeStyles[req.status]
                    }`}
                  >
                    {req.status.replace('_', ' ')}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span
                    className={`px-2 py-0.5 rounded font-medium ${priorityBadgeStyles[req.priority]}`}
                  >
                    {req.priority}
                  </span>
                  <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded">
                    {req.category.replace('_', ' ')}
                  </span>
                  {req.isOverdue && (
                    <span className="bg-rose-100 text-rose-700 px-2 py-0.5 rounded font-bold border border-rose-200">
                      OVERDUE
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-50">
                  <div>
                    <span>Due: </span>
                    <span className={req.isOverdue ? 'text-rose-600 font-bold' : 'font-medium'}>
                      {formatDate(req.dueDate)}
                    </span>
                  </div>
                  <Link
                    to={`/requests/${req.id}`}
                    className="inline-flex items-center gap-1 font-semibold text-indigo-600"
                  >
                    <span>Details</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination Controls */}
          <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600">
            <div>
              Showing <span className="font-semibold">{(page - 1) * pageSize + 1}</span> to{' '}
              <span className="font-semibold">
                {Math.min(page * pageSize, totalCount)}
              </span>{' '}
              of <span className="font-semibold">{totalCount}</span> results
            </div>

            <div className="flex items-center gap-2">
              <button
                disabled={page <= 1}
                onClick={() => updateFilters({ page: page - 1 })}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors font-medium shadow-xs"
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </button>
              <span className="px-2 font-medium">
                Page {page} of {totalPages}
              </span>
              <button
                disabled={page >= totalPages}
                onClick={() => updateFilters({ page: page + 1 })}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors font-medium shadow-xs"
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
