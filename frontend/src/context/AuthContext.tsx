import { createContext, useContext, useState, ReactNode, useEffect } from "react";

// ============================================================================
//                                TYPES & INTERFACES
// ============================================================================

interface User {
  id: string | number;
  name: string;
  email: string;
  role: "student" | "lecturer" | "admin";
  token?: string; // Present only for Admin users (JWT)
}

interface AuthContextType {
  user: User | null;
  /**
   * Logs a user in and persists their session.
   * @param userData - The user object returned from the backend.
   * @param token - Optional JWT token (required for Admins).
   */
  login: (userData: User, token?: string) => void;
  /** Clears the user session and storage. */
  logout: () => void;
  isAuthenticated: boolean;
}

// ============================================================================
//                                CONTEXT SETUP
// ============================================================================

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * AuthProvider
 * * Manages global authentication state.
 * * Persists user session to localStorage so refresh works.
 * * Syncs state across tabs (e.g., if token is deleted elsewhere).
 */
export const AuthProvider = ({ children }: { children: ReactNode }) => {
  // Initialize state from LocalStorage to prevent logout on refresh
  const [user, setUser] = useState<User | null>(() => {
    const savedUser = localStorage.getItem("user");
    const savedToken = localStorage.getItem("admin_token");
    
    if (!savedUser) return null;

    try {
      const parsed: User = JSON.parse(savedUser);
      // Re-attach token for admins if it exists in separate storage
      if (savedToken && parsed.role === "admin") {
        parsed.token = savedToken;
      }
      return parsed;
    } catch (err) {
      console.error("Failed to parse user from storage:", err);
      return null;
    }
  });

  /**
   * Login Handler
   * Saves user to state and localStorage.
   */
  const login = (userData: User, token?: string) => {
    // If a token is provided, merge it into the user object for internal state
    const userToStore = token ? { ...userData, token } : userData;
    
    setUser(userToStore);
    localStorage.setItem("user", JSON.stringify(userToStore));
    
    // Store admin token separately for easier header injection later
    if (token) {
      localStorage.setItem("admin_token", token);
    }
  };

  /**
   * Logout Handler
   * Clears all auth data.
   */
  const logout = () => {
    setUser(null);
    localStorage.removeItem("user");
    localStorage.removeItem("admin_token");
  };

  /**
   * Storage Sync Effect
   * Listens for changes to localStorage in OTHER tabs.
   * If 'admin_token' is removed elsewhere, force logout here.
   */
  useEffect(() => {
    const onStorageChange = (e: StorageEvent) => {
      if (e.key === "admin_token" && !e.newValue) {
        // Token was removed (likely logout in another tab)
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

    window.addEventListener("storage", onStorageChange);
    return () => window.removeEventListener("storage", onStorageChange);
  }, []);

  return (
    <AuthContext.Provider value={{ user, login, logout, isAuthenticated: user !== null }}>
      {children}
    </AuthContext.Provider>
  );
};

/**
 * useAuth Hook
 * Access the authentication context throughout the app.
 */
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};