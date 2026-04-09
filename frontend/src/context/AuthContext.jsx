import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { getProfile, login as loginUser, register as registerUser } from "../services/authService";
import { clearMockStorage } from "../utils/storage";

const AuthContext = createContext(null);

function normalizeStoredUser(user) {
  if (!user) {
    return null;
  }

  return {
    ...user,
    name: user.name || user.full_name || ""
  };
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    clearMockStorage();
    localStorage.removeItem("travel_current_user");
    localStorage.removeItem("travel_auth_token");

    const storedUser = sessionStorage.getItem("travel_current_user");
    if (storedUser) {
      setUser(normalizeStoredUser(JSON.parse(storedUser)));
    }
    setLoading(false);
  }, []);

  const persistSession = useCallback((session) => {
    const nextUser = normalizeStoredUser(session.user);
    sessionStorage.setItem("travel_current_user", JSON.stringify(nextUser));
    sessionStorage.setItem("travel_auth_token", session.token);
    setUser(nextUser);
  }, []);

  const refreshProfile = useCallback(async () => {
    const profile = await getProfile();
    sessionStorage.setItem("travel_current_user", JSON.stringify(profile));
    setUser(profile);
    return profile;
  }, []);

  const login = async (credentials) => {
    const session = await loginUser(credentials);
    persistSession(session);
    return session;
  };

  const register = async (payload) => {
    const session = await registerUser(payload);
    persistSession(session);
    return session;
  };

  const logout = () => {
    sessionStorage.removeItem("travel_current_user");
    sessionStorage.removeItem("travel_auth_token");
    localStorage.removeItem("travel_current_user");
    localStorage.removeItem("travel_auth_token");
    setUser(null);
  };

  const value = useMemo(
    () => ({
      user,
      loading,
      isAuthenticated: Boolean(user),
      isUser: user?.role === "user",
      isAdmin: user?.role === "admin",
      login,
      register,
      logout,
      refreshProfile
    }),
    [user, loading, persistSession, refreshProfile]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
