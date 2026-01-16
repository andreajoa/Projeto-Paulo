import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import {
  AuthResponse,
  MeResponse,
  User,
  clearAuthToken,
  getAuthToken,
  getMe,
  login as apiLogin,
  setAuthToken,
  signup as apiSignup
} from "./api";

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, name?: string) => Promise<void>;
  refresh: () => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getAuthToken();
    if (!token) {
      setLoading(false);
      return;
    }
    getMe()
      .then((response: MeResponse) => {
        setUser(response.user);
      })
      .catch(() => {
        clearAuthToken();
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  async function refresh() {
    const token = getAuthToken();
    if (!token) {
      setUser(null);
      return;
    }
    const response: MeResponse = await getMe();
    setUser(response.user);
  }

  async function login(email: string, password: string) {
    const response: AuthResponse = await apiLogin({ email, password });
    setAuthToken(response.token);
    setUser(response.user);
  }

  async function signup(email: string, password: string, name?: string) {
    const response: AuthResponse = await apiSignup({ email, password, name });
    setAuthToken(response.token);
    setUser(response.user);
  }

  function logout() {
    clearAuthToken();
    setUser(null);
  }

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      login,
      signup,
      refresh,
      logout
    }),
    [user, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("AuthProvider missing");
  }
  return ctx;
}
