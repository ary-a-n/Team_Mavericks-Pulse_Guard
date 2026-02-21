import { createContext, useContext, useState, useEffect } from "react";
import { loginUser, registerUser } from "@/lib/api/auth";
import { clearToken } from "@/lib/api/client";

interface User {
  id: string;
  email: string;
  name: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name: string) => Promise<void>;
  signOut: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const savedUser = localStorage.getItem("pg_user");
    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch {
        localStorage.removeItem("pg_user");
      }
    }
    setIsLoading(false);
  }, []);

  const signIn = async (email: string, password: string): Promise<void> => {
    await loginUser(email, password);
    const newUser: User = {
      id: `user_${Date.now()}`,
      email,
      name: email.split("@")[0],
    };
    setUser(newUser);
    localStorage.setItem("pg_user", JSON.stringify(newUser));
  };

  const signUp = async (
    email: string,
    password: string,
    name: string
  ): Promise<void> => {
    await registerUser(email, password);
    await loginUser(email, password);
    const newUser: User = { id: `user_${Date.now()}`, email, name };
    setUser(newUser);
    localStorage.setItem("pg_user", JSON.stringify(newUser));
  };

  const signOut = (): void => {
    setUser(null);
    clearToken();
    localStorage.removeItem("pg_user");
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
