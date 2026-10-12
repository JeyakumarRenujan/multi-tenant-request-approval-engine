import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/useAuth';
import {
  LayoutDashboard,
  FileText,
  PlusCircle,
  Users,
  Building2,
  LogOut,
  Menu,
  X,
  Briefcase,
} from 'lucide-react';

export const Navbar: React.FC = () => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  if (!user) return null;

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const isActive = (path: string) => location.pathname === path;

  const roleColors: Record<string, string> = {
    PLATFORM_ADMIN: 'bg-purple-100 text-purple-800 border-purple-300',
    ORG_ADMIN: 'bg-blue-100 text-blue-800 border-blue-300',
    MANAGER: 'bg-amber-100 text-amber-800 border-amber-300',
    DEVELOPER: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    CLIENT_USER: 'bg-slate-100 text-slate-800 border-slate-300',
  };

  return (
    <nav className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          {/* Brand & Desktop Links */}
          <div className="flex items-center">
            <Link to="/" className="flex items-center gap-2 font-bold text-lg text-slate-900 mr-8">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-white font-black text-base shadow-xs">
                R
              </span>
              <span>ReqFlow</span>
            </Link>

            <div className="hidden md:flex md:space-x-2">
              {/* PLATFORM_ADMIN Menu */}
              {user.role === 'PLATFORM_ADMIN' && (
                <Link
                  to="/organizations"
                  className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    isActive('/organizations')
                      ? 'bg-indigo-50 text-indigo-700 font-semibold'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  <Building2 className="h-4 w-4" />
                  Organizations
                </Link>
              )}

              {/* Non-Platform-Admin: Dashboard & Requests */}
              {user.role !== 'PLATFORM_ADMIN' && (
                <>
                  <Link
                    to="/dashboard"
                    className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                      isActive('/dashboard')
                        ? 'bg-indigo-50 text-indigo-700 font-semibold'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                    }`}
                  >
                    <LayoutDashboard className="h-4 w-4" />
                    Dashboard
                  </Link>

                  <Link
                    to="/requests"
                    className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                      isActive('/requests')
                        ? 'bg-indigo-50 text-indigo-700 font-semibold'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                    }`}
                  >
                    <FileText className="h-4 w-4" />
                    Requests
                  </Link>
                </>
              )}

              {/* CLIENT_USER: New Request */}
              {user.role === 'CLIENT_USER' && (
                <Link
                  to="/requests/new"
                  className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    isActive('/requests/new')
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
                  }`}
                >
                  <PlusCircle className="h-4 w-4" />
                  New Request
                </Link>
              )}

              {/* ORG_ADMIN: Clients and Users management */}
              {user.role === 'ORG_ADMIN' && (
                <>
                  <Link
                    to="/clients"
                    className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                      isActive('/clients')
                        ? 'bg-indigo-50 text-indigo-700 font-semibold'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                    }`}
                  >
                    <Briefcase className="h-4 w-4" />
                    Clients
                  </Link>
                  <Link
                    to="/users"
                    className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                      isActive('/users')
                        ? 'bg-indigo-50 text-indigo-700 font-semibold'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                    }`}
                  >
                    <Users className="h-4 w-4" />
                    Users
                  </Link>
                </>
              )}
            </div>
          </div>

          {/* User profile and Logout on Desktop */}
          <div className="hidden md:flex items-center gap-4">
            <div className="flex flex-col items-end text-right">
              <span className="text-sm font-medium text-slate-900 leading-tight">{user.name}</span>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span
                  className={`text-xs px-2 py-0.5 rounded-full border font-semibold ${
                    roleColors[user.role] || 'bg-slate-100 text-slate-800'
                  }`}
                >
                  {user.role.replace('_', ' ')}
                </span>
              </div>
            </div>

            <button
              onClick={handleLogout}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
              title="Log out"
            >
              <LogOut className="h-4 w-4" />
              <span>Logout</span>
            </button>
          </div>

          {/* Mobile menu button */}
          <div className="flex items-center md:hidden">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-md text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-slate-200 bg-white px-4 pt-2 pb-4 space-y-1">
          <div className="py-2 border-b border-slate-100 mb-2">
            <p className="text-sm font-semibold text-slate-900">{user.name}</p>
            <p className="text-xs text-slate-500">{user.email}</p>
            <span
              className={`inline-block mt-1 text-xs px-2 py-0.5 rounded-full border font-semibold ${
                roleColors[user.role] || 'bg-slate-100 text-slate-800'
              }`}
            >
              {user.role.replace('_', ' ')}
            </span>
          </div>

          {user.role === 'PLATFORM_ADMIN' && (
            <Link
              to="/organizations"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center gap-2 px-3 py-2 rounded-md text-base font-medium text-slate-700 hover:bg-slate-100"
            >
              <Building2 className="h-5 w-5" />
              Organizations
            </Link>
          )}

          {user.role !== 'PLATFORM_ADMIN' && (
            <>
              <Link
                to="/dashboard"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-2 px-3 py-2 rounded-md text-base font-medium text-slate-700 hover:bg-slate-100"
              >
                <LayoutDashboard className="h-5 w-5" />
                Dashboard
              </Link>
              <Link
                to="/requests"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-2 px-3 py-2 rounded-md text-base font-medium text-slate-700 hover:bg-slate-100"
              >
                <FileText className="h-5 w-5" />
                Requests
              </Link>
            </>
          )}

          {user.role === 'CLIENT_USER' && (
            <Link
              to="/requests/new"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center gap-2 px-3 py-2 rounded-md text-base font-medium text-indigo-600 bg-indigo-50 font-semibold"
            >
              <PlusCircle className="h-5 w-5" />
              New Request
            </Link>
          )}

          {user.role === 'ORG_ADMIN' && (
            <>
              <Link
                to="/clients"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-2 px-3 py-2 rounded-md text-base font-medium text-slate-700 hover:bg-slate-100"
              >
                <Briefcase className="h-5 w-5" />
                Clients
              </Link>
              <Link
                to="/users"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-2 px-3 py-2 rounded-md text-base font-medium text-slate-700 hover:bg-slate-100"
              >
                <Users className="h-5 w-5" />
                Users
              </Link>
            </>
          )}

          <div className="pt-2 border-t border-slate-100">
            <button
              onClick={() => {
                setMobileMenuOpen(false);
                handleLogout();
              }}
              className="flex w-full items-center gap-2 px-3 py-2 rounded-md text-base font-medium text-red-600 hover:bg-red-50"
            >
              <LogOut className="h-5 w-5" />
              Logout
            </button>
          </div>
        </div>
      )}
    </nav>
  );
};
