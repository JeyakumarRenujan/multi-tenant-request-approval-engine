import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { useAuth } from './context/useAuth';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Layout } from './components/Layout';
import { Login } from './pages/Login';

const HomeRedirect: React.FC = () => {
  const { user } = useAuth();
  if (user?.role === 'PLATFORM_ADMIN') {
    return <Navigate to="/organizations" replace />;
  }
  return <Navigate to="/dashboard" replace />;
};

// Temporary placeholder until step implementation
const PlaceholderPage: React.FC<{ title: string }> = ({ title }) => (
  <div className="p-8 text-center bg-white rounded-xl border border-slate-200">
    <h2 className="text-xl font-bold text-slate-800">{title}</h2>
    <p className="mt-2 text-sm text-slate-500">Feature implementation in progress.</p>
  </div>
);

export function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />

          {/* Protected routes wrapped in Layout */}
          <Route element={<ProtectedRoute />}>
            <Route element={<Layout />}>
              <Route path="/" element={<HomeRedirect />} />
              <Route path="/dashboard" element={<PlaceholderPage title="Dashboard" />} />
              <Route path="/requests" element={<PlaceholderPage title="Requests" />} />
              <Route path="/requests/new" element={<PlaceholderPage title="New Request" />} />
              <Route path="/requests/:id" element={<PlaceholderPage title="Request Detail" />} />
              <Route path="/clients" element={<PlaceholderPage title="Clients" />} />
              <Route path="/users" element={<PlaceholderPage title="Users" />} />
              <Route path="/organizations" element={<PlaceholderPage title="Organizations" />} />
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
