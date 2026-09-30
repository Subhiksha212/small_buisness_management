import React, { createContext, useContext, useState, useEffect } from 'react';
import { loginApi, registerApi, getMeApi, updateOnboardingApi } from '../services/api';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token') || null);
  const [loading, setLoading] = useState(true);

  // Load user data if token exists
  useEffect(() => {
    const loadUser = async () => {
      if (token) {
        try {
          const res = await getMeApi();
          if (res.success) {
            setUser(res.data);
          } else {
            logout();
          }
        } catch (err) {
          console.error('Failed to load user profile:', err);
          logout();
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    };

    loadUser();
  }, [token]);

  const login = async (credentials) => {
    const data = await loginApi(credentials);
    if (data.success) {
      localStorage.setItem('token', data.token);
      setToken(data.token);
      setUser(data.user);
    }
    return data;
  };

  const register = async (userData) => {
    const data = await registerApi(userData);
    if (data.success) {
      localStorage.setItem('token', data.token);
      setToken(data.token);
      setUser(data.user);
    }
    return data;
  };

  const updateOnboarding = async (setupData) => {
    const data = await updateOnboardingApi(setupData);
    if (data.success) {
      setUser(data.user);
    }
    return data;
  };

  const logout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        login,
        register,
        updateOnboarding,
        logout,
        isAuthenticated: !!user,
        isOnboarded: user?.isOnboarded || false,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;
