import React, { createContext, useState, useContext, useEffect } from 'react';
import { authAPI } from '@/services/api';

const AuthContext = createContext({});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if user is logged in on mount
    const token = localStorage.getItem('token');
    if (token) {
      fetchProfile();
    } else {
      setLoading(false);
    }
  }, []);

  const fetchProfile = async () => {
    try {
      const data = await authAPI.getProfile();
      setUser(data?.user ?? data);
    } catch (error) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    } finally {
      setLoading(false);
    }
  };

  const login = async (credentials) => {
    try {
      const response = await authAPI.login(credentials);
      localStorage.setItem('token', response.token);
      localStorage.setItem('user', JSON.stringify(response.user));
      setUser(response.user);
      return { success: true, user: response.user };
    } catch (error) {
      return { success: false, error: error.error || 'Login failed' };
    }
  };

  const logout = async () => {
    try {
      await authAPI.logout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      setUser(null);
      window.location.href = '/login';
    }
  };

  const value = {
    user,
    loading,
    login,
    logout,
    isAuthenticated: !!user,
    isEncoder: user?.role === 'encoder',
    isApprover: user?.role === 'approver',
    isAdmin: user?.role === 'administrator',
    isAdministrator: user?.role === 'administrator',
    userRole: user?.role ?? null,
    updateUser: (newData) => {
      const updatedUser = { ...user, ...newData };
      localStorage.setItem('user', JSON.stringify(updatedUser));
      setUser(updatedUser);
    }
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};