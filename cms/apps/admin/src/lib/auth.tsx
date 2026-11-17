import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { api, clearToken, getToken, setToken } from "./api";

interface User {
  sub: string;
  email: string;
  role: "super_admin" | null;
}

interface AuthCtx {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      setLoading(false);
      return;
    }
    api<{ user: User }>("/api/admin/me")
      .then((r) => setUser(r.user))
      .catch((err) => {
        console.error("Auth check failed:", err);
      })
      .finally(() => setLoading(false));
  }, []);

  async function login(email: string, password: string) {
    const res = await api<{ accessToken: string }>(
      "/api/admin/auth/login",
      {
        method: "POST",
        body: JSON.stringify({ email, password }),
      }
    );
    setToken(res.accessToken);
    const me = await api<{ user: User }>("/api/admin/me");
    setUser(me.user);
  }

  function logout() {
    clearToken();
    setUser(null);
  }

  return (
    <Ctx.Provider value={{ user, loading, login, logout }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth(): AuthCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth outside AuthProvider");
  return ctx;
}