import { createContext, useContext, useState, useCallback } from "react";
import { logout as apiLogout } from "../services/api";

const Ctx = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try { const s = sessionStorage.getItem("aar_user"); return s ? JSON.parse(s) : null; }
    catch { return null; }
  });

  const doLogin = useCallback((data) => {
    setUser(data);
    try { sessionStorage.setItem("aar_user", JSON.stringify(data)); } catch {}
  }, []);

  const refreshUser = useCallback((updates) => {
    setUser((prev) => {
      const merged = { ...(prev || {}), ...(updates || {}) };
      try { sessionStorage.setItem("aar_user", JSON.stringify(merged)); } catch {}
      return merged;
    });
  }, []);

  const doLogout = useCallback(async () => {
    await apiLogout();
    setUser(null);
    try { sessionStorage.removeItem("aar_user"); } catch {}
  }, []);

  const hasRole = useCallback((roles) => {
    if (!user) return false;
    return Array.isArray(roles) ? roles.includes(user.role) : user.role === roles;
  }, [user]);

  return (
    <Ctx.Provider value={{
      user, login: doLogin, logout: doLogout, hasRole, refreshUser,
      isAdmin: user?.role === "admin",
      isSecurity: user?.role === "security",
    }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAuth must be inside AuthProvider");
  return c;
}
