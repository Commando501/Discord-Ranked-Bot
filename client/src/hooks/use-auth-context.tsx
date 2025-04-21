import { createContext, useContext, useState, ReactNode, useEffect } from "react";

type User = {
  username: string;
};

type AuthContextType = {
  user: User | null;
  login: (username: string, password: string) => boolean;
  logout: () => void;
};

const AuthContext = createContext<AuthContextType | null>(null);

// Hard-coded credentials as requested
const VALID_CREDENTIALS = [
  { username: "lateleague1", password: "1@t3L3aGu3!23" },
  { username: "lateleague2", password: "LaTe134gUE123" },
  { username: "lateleague3", password: "lateL34GU3!23" },
];

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);

  // Check for existing session on mount
  useEffect(() => {
    const storedUser = localStorage.getItem("authUser");
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch (e) {
        localStorage.removeItem("authUser");
      }
    }
  }, []);

  const login = (username: string, password: string): boolean => {
    const isValid = VALID_CREDENTIALS.some(
      (cred) => cred.username === username && cred.password === password
    );

    if (isValid) {
      const user = { username };
      setUser(user);
      localStorage.setItem("authUser", JSON.stringify(user));
      return true;
    }
    
    return false;
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem("authUser");
  };

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}