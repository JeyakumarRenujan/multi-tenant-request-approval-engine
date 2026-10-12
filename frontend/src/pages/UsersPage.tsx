import React, { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/useAuth';
import type { Client, Role, User } from '../types';
import { Users, Plus, AlertCircle, RefreshCw, CheckCircle2 } from 'lucide-react';

export const UsersPage: React.FC = () => {
  const { user } = useAuth();
  const [usersList, setUsersList] = useState<User[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Create User Form State
  const [showCreate, setShowCreate] = useState<boolean>(false);
  const [name, setName] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [role, setRole] = useState<Role>('DEVELOPER');
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [creating, setCreating] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Status updating state
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;
    Promise.all([api.getUsers(), api.getClients()])
      .then(([usersRes, clientsRes]) => {
        if (!ignore) {
          setUsersList(usersRes.users || []);
          setClients(clientsRes.clients || []);
          setLoading(false);
        }
      })
      .catch((err: any) => {
        if (!ignore) {
          setError(err.message || 'Failed to load organization members.');
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
      const [uRes, cRes] = await Promise.all([api.getUsers(), api.getClients()]);
      setUsersList(uRes.users || []);
      setClients(cRes.clients || []);
    } catch (err: any) {
      setError(err.message || 'Failed to refresh members.');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !password.trim()) {
      setFormError('Please fill in all required fields.');
      return;
    }

    if (role === 'CLIENT_USER' && !selectedClientId) {
      setFormError('CLIENT_USER must be assigned to an organization client.');
      return;
    }

    setCreating(true);
    setFormError(null);
    setSuccessMsg(null);

    try {
      const res = await api.createUser({
        name: name.trim(),
        email: email.trim(),
        password,
        role,
        clientId: role === 'CLIENT_USER' ? selectedClientId : undefined,
      });

      setUsersList((prev) => [res.user, ...prev]);
      setSuccessMsg(`User ${res.user.name} (${res.user.email}) registered successfully.`);
      setName('');
      setEmail('');
      setPassword('');
      setSelectedClientId('');
      setShowCreate(false);
    } catch (err: any) {
      setFormError(err.message || 'Failed to create user.');
    } finally {
      setCreating(false);
    }
  };

  const handleToggleActive = async (targetUser: User) => {
    if (targetUser.id === user?.id) {
      alert('You cannot deactivate your own account.');
      return;
    }

    const newActive = targetUser.isActive === false;
    setUpdatingId(targetUser.id);
    setError(null);

    try {
      const res = await api.updateUser(targetUser.id, { isActive: newActive });
      setUsersList((prev) =>
        prev.map((u) => (u.id === targetUser.id ? { ...u, isActive: res.user.isActive } : u))
      );
    } catch (err: any) {
      setError(err.message || 'Failed to update user status.');
    } finally {
      setUpdatingId(null);
    }
  };

  if (user?.role !== 'ORG_ADMIN') {
    return (
      <div className="p-8 text-center bg-white rounded-xl border border-slate-200 max-w-md mx-auto">
        <AlertCircle className="h-10 w-10 text-amber-500 mx-auto" />
        <h2 className="mt-2 text-base font-bold text-slate-800">Access Restricted</h2>
        <p className="text-xs text-slate-500 mt-1">
          Only Organization Admins are permitted to manage users.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Organization Users</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Manage members, roles, and client user assignments for your tenant.
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
            <span>Invite User</span>
          </button>
        </div>
      </div>

      {successMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-sm text-emerald-800 flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Create User Box */}
      {showCreate && (
        <div className="bg-white rounded-xl border border-indigo-200 p-6 shadow-sm space-y-4 animate-fade-in">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Users className="h-5 w-5 text-indigo-600" />
            <span>Create New User</span>
          </h2>

          {formError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 font-medium">
              {formError}
            </div>
          )}

          <form onSubmit={handleCreateUser} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Jane Developer"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Email Address <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  required
                  placeholder="jane@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Password <span className="text-red-500">*</span>
                </label>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Role <span className="text-red-500">*</span>
                </label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as Role)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                >
                  <option value="DEVELOPER">Developer</option>
                  <option value="MANAGER">Manager</option>
                  <option value="CLIENT_USER">Client User</option>
                  <option value="ORG_ADMIN">Organization Admin</option>
                </select>
              </div>

              {role === 'CLIENT_USER' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Assign to Client <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={selectedClientId}
                    required
                    onChange={(e) => setSelectedClientId(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                  >
                    <option value="">Select a Client...</option>
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="px-3.5 py-2 text-sm font-medium text-slate-600 hover:text-slate-900"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={creating}
                className="px-4 py-2 text-sm font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50"
              >
                {creating ? 'Creating...' : 'Create User'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-center text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Loading skeleton */}
      {loading && !error && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-12 bg-slate-100 rounded-lg animate-pulse" />
          ))}
        </div>
      )}

      {/* User Table */}
      {!loading && !error && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
              <thead className="bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                <tr>
                  <th scope="col" className="px-6 py-3.5">Name</th>
                  <th scope="col" className="px-6 py-3.5">Email</th>
                  <th scope="col" className="px-6 py-3.5">Role</th>
                  <th scope="col" className="px-6 py-3.5">Status</th>
                  <th scope="col" className="px-6 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {usersList.map((u) => {
                  const isSelf = u.id === user?.id;
                  const isActive = u.isActive !== false;

                  return (
                    <tr key={u.id} className="hover:bg-slate-50/80">
                      <td className="px-6 py-4 font-medium text-slate-900">
                        {u.name}
                        {isSelf && (
                          <span className="ml-2 text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-bold">
                            You
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-slate-600 text-xs">{u.email}</td>
                      <td className="px-6 py-4">
                        <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                          {u.role.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-full ${
                            isActive
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-rose-100 text-rose-700'
                          }`}
                        >
                          {isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        {!isSelf && (
                          <button
                            onClick={() => handleToggleActive(u)}
                            disabled={updatingId === u.id}
                            className={`text-xs font-semibold px-2.5 py-1 rounded transition-colors ${
                              isActive
                                ? 'text-rose-600 hover:bg-rose-50'
                                : 'text-emerald-600 hover:bg-emerald-50'
                            }`}
                          >
                            {updatingId === u.id
                              ? 'Saving...'
                              : isActive
                              ? 'Deactivate'
                              : 'Activate'}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
