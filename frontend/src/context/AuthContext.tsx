import React, { useEffect, useState } from 'react';
import { api, tokenStorage } from '../api/client';
import type { User } from '../types';
import { AuthContext } from './authContextDef';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Register listener so api client can notify AuthContext when a session expires
    tokenStorage.setOnLogout(() => {
      setUser(null);
    });

    // Check if there is an existing session to resume
    const initAuth = async () => {
      const refreshToken = tokenStorage.getRefreshToken();
      if (!refreshToken) {
        setLoading(false);
        return;
      }

      try {
        // Request current user profile (API client automatically refreshes token on 401)
        const meRes = await api.getMe();
        const profile = meRes.user || meRes;
        setUser(profile);
      } catch {
        // Session invalid or expired
        tokenStorage.clear();
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    initAuth();
  }, []);

  const login = async (credentials: { email: string; password: string }) => {
    setError(null);
    setLoading(true);
    try {
      const res = await api.login(credentials);
      // Access token stored strictly in memory
      tokenStorage.setAccessToken(res.accessToken);
      // Refresh token stored in sessionStorage as documented trade-off
      tokenStorage.setRefreshToken(res.refreshToken);
      setUser(res.user);
    } catch (err: any) {
      setError(err.message || 'Login failed. Please check your credentials.');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      await api.logout();
    } catch {
      // Ignore network errors on logout
    } finally {
      tokenStorage.clear();
      setUser(null);
    }
  };

  const clearError = () => setError(null);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        error,
        login,
        logout,
        isAuthenticated: !!user,
        clearError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
