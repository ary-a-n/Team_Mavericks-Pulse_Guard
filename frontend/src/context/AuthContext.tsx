import { createContext, useContext, useState, useEffect } from "react";

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
    // Check if user is still logged in (from localStorage)
    const savedUser = localStorage.getItem("wardpulse_user");
    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch (error) {
        console.error("Failed to parse saved user:", error);
        localStorage.removeItem("wardpulse_user");
      }
    }
    setIsLoading(false);
  }, []);

  const signIn = async (email: string, password: string) => {
    // Simulate API call
    try {
      // Basic validation
      if (!email || !password) {
        throw new Error("Email and password are required");
      }

      // Simulate successful login
      const newUser: User = {
        id: `user_${Date.now()}`,
        email,
        name: email.split("@")[0],
      };

      setUser(newUser);
      localStorage.setItem("wardpulse_user", JSON.stringify(newUser));
    } catch (error) {
      throw error;
    }
  };

  const signUp = async (email: string, password: string, name: string) => {
    // Simulate API call
    try {
      // Basic validation
      if (!email || !password || !name) {
        throw new Error("All fields are required");
      }
      if (password.length < 6) {
        throw new Error("Password must be at least 6 characters");
      }

      // Simulate successful signup
      const newUser: User = {
        id: `user_${Date.now()}`,
        email,
        name,
      };

      setUser(newUser);
      localStorage.setItem("wardpulse_user", JSON.stringify(newUser));
    } catch (error) {
      throw error;
    }
  };

  const signOut = () => {
    setUser(null);
    localStorage.removeItem("wardpulse_user");
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
