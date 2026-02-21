import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Shield } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";

const SignIn = () => {
  const navigate = useNavigate();
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      await signIn(email, password);
      navigate("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign in failed");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background dark:bg-slate-950">
      <div className="absolute inset-0 bg-gradient-to-br from-blue-50 via-background to-background dark:hidden -z-10"></div>
      <div className="relative flex flex-col min-h-screen animate-fade-in">
      {/* Header */}
      <header className="border-b border-blue-100/50 dark:border-blue-900/30 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm transition-all duration-300">
        <div className="flex items-center justify-between px-4 py-4 lg:px-8 max-w-7xl mx-auto w-full">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-blue-400 to-blue-500 dark:from-blue-500 dark:to-blue-600 rounded-lg shadow-md">
              <Shield size={24} className="text-white" />
            </div>
            <div>
              <div className="font-heading text-xl font-semibold text-slate-900 dark:text-white">PulseGuard</div>
              <div className="text-xs font-body text-slate-500 dark:text-slate-400 uppercase tracking-widest hidden sm:block">
                Patient Monitoring System
              </div>
            </div>
          </div>
          <ThemeToggle />
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-md space-y-6 animate-fade-in-slow-2">
          {/* Welcome Section */}
          <div className="text-center space-y-2 animate-fade-in-slow">
            <h1 className="font-heading text-4xl font-bold text-slate-900 dark:text-white transition-opacity duration-500">Welcome Back</h1>
            <p className="text-slate-600 dark:text-slate-300 font-body text-sm transition-colors duration-500">Sign in to your account to continue</p>
          </div>

          {/* Card */}
          <Card className="border border-blue-100/50 dark:border-slate-700 shadow-2xl bg-white/95 dark:bg-slate-800/80 backdrop-blur animate-fade-in-slow-2 transition-all duration-500 hover:shadow-blue-100/50 dark:hover:shadow-slate-950/50">
            <CardContent className="p-8">
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Error Message */}
                {error && (
                  <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg p-4 text-sm text-red-600 dark:text-red-400 font-body animate-fade-in transition-all duration-300">
                    {error}
                  </div>
                )}

                {/* Email Field */}
                <div className="space-y-2 animate-fade-in-slow transition-all duration-500" style={{animationDelay: '0.1s'}}>
                  <label htmlFor="email" className="block text-sm font-semibold text-slate-700 dark:text-slate-200 font-body">
                    Email Address
                  </label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={isLoading}
                    placeholder="you@example.com"
                    className="bg-blue-50/50 dark:bg-slate-700/50 border-blue-100 dark:border-slate-600 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 transition-all duration-300 focus:border-blue-300 dark:focus:border-slate-500 focus:ring-2 focus:ring-blue-200/50 dark:focus:ring-slate-600/50 focus:bg-white dark:focus:bg-slate-700"
                    required
                  />
                </div>

                {/* Password Field */}
                <div className="space-y-2 animate-fade-in-slow transition-all duration-500" style={{animationDelay: '0.2s'}}>
                  <div className="flex items-center justify-between">
                    <label htmlFor="password" className="block text-sm font-semibold text-slate-700 dark:text-slate-200 font-body">
                      Password
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-body transition-colors duration-300"
                    >
                      {showPassword ? "Hide" : "Show"}
                    </button>
                  </div>
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={isLoading}
                    placeholder="••••••••"
                    className="bg-blue-50/50 dark:bg-slate-700/50 border-blue-100 dark:border-slate-600 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 transition-all duration-300 focus:border-blue-300 dark:focus:border-slate-500 focus:ring-2 focus:ring-blue-200/50 dark:focus:ring-slate-600/50 focus:bg-white dark:focus:bg-slate-700"
                    required
                  />
                </div>

                {/* Remember me checkbox */}
                <div className="flex items-center gap-2 animate-fade-in-slow transition-all duration-500" style={{animationDelay: '0.3s'}}>
                  <input
                    type="checkbox"
                    id="remember"
                    className="w-4 h-4 rounded border-blue-200 dark:border-slate-600 cursor-pointer dark:bg-slate-700 dark:checked:bg-blue-600"
                  />
                  <label htmlFor="remember" className="text-sm text-slate-600 dark:text-slate-300 font-body cursor-pointer">
                    Remember me
                  </label>
                </div>

                {/* Sign In Button */}
                <Button
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 dark:from-blue-600 dark:to-blue-700 dark:hover:from-blue-700 dark:hover:to-blue-800 text-white font-semibold py-2.5 rounded-lg transition-all font-body duration-300 hover:shadow-lg hover:shadow-blue-300/40 dark:hover:shadow-blue-950/40 active:scale-95 animate-fade-in-slow" 
                  style={{animationDelay: '0.4s'}}
                >
                  {isLoading ? "Signing in..." : "Sign In"}
                </Button>
              </form>

              {/* Sign Up Link */}
              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-blue-100/50 dark:border-slate-700"></div>
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="px-2 bg-white/95 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 font-body">New user?</span>
                </div>
              </div>

              <Link
                to="/signup"
                className="block w-full text-center py-2.5 px-4 rounded-lg font-body text-sm font-semibold text-blue-600 dark:text-blue-400 border-2 border-blue-200 dark:border-slate-700 hover:bg-blue-50 dark:hover:bg-slate-700/50 transition-all duration-300 animate-fade-in-slow hover:shadow-md hover:border-blue-300 dark:hover:border-slate-600" 
                style={{animationDelay: '0.6s'}}
              >
                Create Account
              </Link>
            </CardContent>
          </Card>

          {/* Demo Info */}
          <div className="p-4 rounded-lg bg-blue-50/60 dark:bg-slate-800/50 border border-blue-100/50 dark:border-slate-700/50 text-center animate-fade-in-slow-3 transition-all duration-500 shadow-sm" style={{animationDelay: '0.7s'}}>
            <p className="text-xs text-blue-700 dark:text-blue-300 font-body">
              <span className="font-semibold">Demo:</span> Use any email and password (6+ chars)
            </p>
          </div>
        </div>
      </main>
    </div>
    </div>
  );
};

export default SignIn;

