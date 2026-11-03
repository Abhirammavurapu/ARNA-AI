import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { getCurrentUser, loginUser, logoutUser, registerUser } from '../services/authApi.js';
import { AUTH_REQUIRED_EVENT } from '../services/chatApi.js';

const AuthContext = createContext(null);
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let live = true;
    getCurrentUser().then((data) => { if (live) setUser(data.user); }).catch(() => { if (live) setUser(null); }).finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, []);
  useEffect(() => {
    const handleAuthRequired = () => setUser(null);
    window.addEventListener(AUTH_REQUIRED_EVENT, handleAuthRequired);
    return () => window.removeEventListener(AUTH_REQUIRED_EVENT, handleAuthRequired);
  }, []);
  const login = useCallback(async (email, password) => { const data = await loginUser(email, password); setUser(data.user); return data.user; }, []);
  const signup = useCallback(async (name, email, password) => { const data = await registerUser(name, email, password); setUser(data.user); return data.user; }, []);
  const logout = useCallback(async () => { try { await logoutUser(); } finally { setUser(null); } }, []);
  const value = useMemo(() => ({ user, loading, login, signup, logout }), [user, loading, login, signup, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider');
  return value;
}
