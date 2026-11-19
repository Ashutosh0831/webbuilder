import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

import {
  api,
  clearToken,
  setToken,
} from "./api";

interface User {
  sub: string;
  email: string;
  role: "super_admin" | null;
}

interface LoginResponse {
  accessToken: string;
}

interface AuthCtx {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function initializeAuth() {
      try {
        const response = await api<{ user: User }>("/api/admin/me");
        if (active) setUser(response.user);
      } catch (error) {
        console.error("Auth initialization failed:", error);
        if (active) setUser(null);
      } finally {
        if (active) setLoading(false);
      }
    }

    initializeAuth();
    return () => {
      active = false;
    };
  }, []);

  async function login(email: string, password: string): Promise<void> {
    const response = await api<LoginResponse>("/api/admin/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password, useCookies: true }),
    });

    if (!response.accessToken) {
      throw new Error("Login response is missing the access token");
    }

    setToken(response.accessToken);

    try {
      const me = await api<{ user: User }>("/api/admin/me");
      setUser(me.user);
    } catch (error) {
      clearToken();
      setUser(null);
      throw error;
    }
  }

  async function logout(): Promise<void> {
    try {
      await api("/api/admin/auth/logout", {
        method: "POST",
        body: JSON.stringify({}),
      });
    } catch {
      // Best-effort server revocation
    } finally {
      clearToken();
      setUser(null);
    }
  }

  return (
    <Ctx.Provider value={{ user, loading, login, logout }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth(): AuthCtx {
  const context = useContext(Ctx);
  if (!context) {
    throw new Error("useAuth outside AuthProvider");
  }
  return context;
}
