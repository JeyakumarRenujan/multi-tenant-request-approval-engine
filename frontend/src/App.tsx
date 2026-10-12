import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { useAuth } from './context/useAuth';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Layout } from './components/Layout';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { RequestList } from './pages/RequestList';
import { CreateRequest } from './pages/CreateRequest';
import { RequestDetail } from './pages/RequestDetail';
import { ClientsPage } from './pages/ClientsPage';
import { UsersPage } from './pages/UsersPage';
import { OrganizationsPage } from './pages/OrganizationsPage';

const HomeRedirect: React.FC = () => {
  const { user } = useAuth();
  if (user?.role === 'PLATFORM_ADMIN') {
    return <Navigate to="/organizations" replace />;
  }
  return <Navigate to="/dashboard" replace />;
};

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
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/requests" element={<RequestList />} />
              <Route path="/requests/new" element={<CreateRequest />} />
              <Route path="/requests/:id" element={<RequestDetail />} />
              <Route path="/clients" element={<ClientsPage />} />
              <Route path="/users" element={<UsersPage />} />
              <Route path="/organizations" element={<OrganizationsPage />} />
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
