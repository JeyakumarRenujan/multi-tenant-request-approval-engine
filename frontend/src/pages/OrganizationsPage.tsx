import React, { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/useAuth';
import type { Organization } from '../types';
import { Building2, Plus, AlertCircle, RefreshCw, CheckCircle2 } from 'lucide-react';

export const OrganizationsPage: React.FC = () => {
  const { user } = useAuth();
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [showCreate, setShowCreate] = useState<boolean>(false);
  const [orgName, setOrgName] = useState<string>('');
  const [creating, setCreating] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;
    api
      .getOrganizations()
      .then((res) => {
        if (!ignore) {
          setOrgs(res.organizations || []);
          setLoading(false);
        }
      })
      .catch((err: any) => {
        if (!ignore) {
          setError(err.message || 'Failed to load organizations.');
          setLoading(false);
        }
      });

    return () => {
      ignore = true;
    };
  }, []);

  const handleRefresh = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getOrganizations();
      setOrgs(res.organizations || []);
    } catch (err: any) {
      setError(err.message || 'Failed to refresh organizations.');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgName.trim()) {
      setFormError('Organization name is required.');
      return;
    }

    setCreating(true);
    setFormError(null);
    setSuccessMsg(null);

    try {
      const res = await api.createOrganization({ name: orgName.trim() });
      setOrgs((prev) => [res.organization, ...prev]);
      setSuccessMsg(`Organization "${res.organization.name}" created successfully.`);
      setOrgName('');
      setShowCreate(false);
    } catch (err: any) {
      setFormError(err.message || 'Failed to create organization.');
    } finally {
      setCreating(false);
    }
  };

  if (user?.role !== 'PLATFORM_ADMIN') {
    return (
      <div className="p-8 text-center bg-white rounded-xl border border-slate-200 max-w-md mx-auto">
        <AlertCircle className="h-10 w-10 text-amber-500 mx-auto" />
        <h2 className="mt-2 text-base font-bold text-slate-800">Access Restricted</h2>
        <p className="text-xs text-slate-500 mt-1">
          Only Platform Administrators are authorized to view organizations.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Platform Organizations</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Provision and view multi-tenant organizations across the system.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleRefresh}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors shadow-xs"
          >
            <RefreshCw className="h-4 w-4 text-slate-500" />
            <span>Refresh</span>
          </button>
          <button
            onClick={() => setShowCreate(!showCreate)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors shadow-xs"
          >
            <Plus className="h-4 w-4" />
            <span>Add Organization</span>
          </button>
        </div>
      </div>

      {successMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-sm text-emerald-800 flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Create Org Form Box */}
      {showCreate && (
        <div className="bg-white rounded-xl border border-indigo-200 p-6 shadow-sm space-y-4 animate-fade-in">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Building2 className="h-5 w-5 text-indigo-600" />
            <span>Provision New Tenant Organization</span>
          </h2>

          {formError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 font-medium">
              {formError}
            </div>
          )}

          <form onSubmit={handleCreateOrg} className="flex flex-col sm:flex-row items-center gap-3">
            <input
              type="text"
              placeholder="e.g. Acme Enterprises"
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              className="flex-1 w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                type="submit"
                disabled={creating}
                className="flex-1 sm:flex-none px-4 py-2 text-sm font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50"
              >
                {creating ? 'Saving...' : 'Save Organization'}
              </button>
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="px-3 py-2 text-sm font-medium text-slate-600 hover:text-slate-900"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="p-6 bg-red-50 border border-red-200 rounded-xl text-center text-sm text-red-700">
          <AlertCircle className="h-8 w-8 text-red-500 mx-auto mb-2" />
          <p>{error}</p>
        </div>
      )}

      {/* Loading Skeleton */}
      {loading && !error && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-12 bg-slate-100 rounded-lg animate-pulse" />
          ))}
        </div>
      )}

      {/* Organizations Table */}
      {!loading && !error && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          {orgs.length === 0 ? (
            <div className="p-10 text-center text-sm text-slate-500">
              No organizations found.
            </div>
          ) : (
            <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
              <thead className="bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                <tr>
                  <th scope="col" className="px-6 py-3.5">Organization Name</th>
                  <th scope="col" className="px-6 py-3.5">ID</th>
                  <th scope="col" className="px-6 py-3.5">Created Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {orgs.map((o) => (
                  <tr key={o.id} className="hover:bg-slate-50/80">
                    <td className="px-6 py-4 font-medium text-slate-900">{o.name}</td>
                    <td className="px-6 py-4 text-xs font-mono text-slate-400">{o.id}</td>
                    <td className="px-6 py-4 text-xs text-slate-500">
                      {new Date(o.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
};
