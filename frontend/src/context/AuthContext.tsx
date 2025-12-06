import { createContext, useContext, useState, ReactNode, useEffect } from "react";

interface User {
  id: string | number;
  name: string;
  email: string;
  role: "student" | "lecturer" | "admin";
  token?: string; // optional — only present for admins
}

interface AuthContextType {
  user: User | null;
  login: (userData: User, token?: string) => void;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(() => {
    const savedUser = localStorage.getItem("user");
    const savedToken = localStorage.getItem("admin_token");
    if (!savedUser) return null;
    try {
      const parsed: User = JSON.parse(savedUser);
      if (savedToken && parsed.role === "admin") parsed.token = savedToken;
      return parsed;
    } catch {
      return null;
    }
  });

  // login accepts optional token (token only for admins)
  const login = (userData: User, token?: string) => {
    const userToStore = token ? { ...userData, token } : userData;
    setUser(userToStore);
    localStorage.setItem("user", JSON.stringify(userToStore));
    if (token) localStorage.setItem("admin_token", token);
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem("user");
    localStorage.removeItem("admin_token");
  };

  const isAuthenticated = user !== null;

  // Keep state synced if admin_token changed elsewhere (optional)
  useEffect(() => {
    // if token removed from localStorage externally, log out
    const onStorage = (e: StorageEvent) => {
      if (e.key === "admin_token" && !e.newValue) {
        // token removed — if current user is admin, clear
        const current = localStorage.getItem("user");
        if (current) {
          try {
            const parsed = JSON.parse(current) as User;
            if (parsed.role === "admin") {
              logout();
            }
          } catch {}
        }
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  return (
    <AuthContext.Provider value={{ user, login, logout, isAuthenticated }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
};