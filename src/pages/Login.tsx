import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Building2, Lock, User, Loader2, ArrowRight, Eye, EyeOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/context/AuthContext.jsx";
import Particles from "react-tsparticles";
import { loadSlim } from "tsparticles-slim";
import type { Engine } from "tsparticles-engine";

export default function Login() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { login: authLogin } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const particlesInit = useCallback(async (engine: Engine) => {
    await loadSlim(engine);
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const result = await authLogin({ username, password });

      if (result.success && result.user) {
        toast({
          title: "Login Successful",
          description: `Welcome ${result.user.full_name || result.user.username}`,
        });

        if (result.user.role === "encoder") {
          navigate("/dashboard");
        } else if (result.user.role === "approver" || result.user.role === "administrator") {
          navigate("/approvals");
        } else {
          navigate("/dashboard");
        }
      } else {
        toast({
          title: "Login Failed",
          description: result.error || "Invalid credentials",
          variant: "destructive",
        });
      }
    } catch (error: unknown) {
      const err = error as { error?: string };
      toast({
        title: "Login Failed",
        description: err?.error || "Server error. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      {/* Animated gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-gray-50 via-white to-gray-100">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_120%,rgba(59,130,246,0.03),transparent_50%)]"></div>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(148,163,184,0.04),transparent_50%)]"></div>
      </div>

      {/* Particles Background */}
      <Particles
        id="tsparticles"
        init={particlesInit}
        options={{
          background: {
            color: {
              value: "transparent",
            },
          },
          fpsLimit: 120,
          interactivity: {
            events: {
              onClick: {
                enable: true,
                mode: "push",
              },
              onHover: {
                enable: true,
                mode: "attract",
              },
              resize: true,
            },
            modes: {
              push: {
                quantity: 4,
              },
              attract: {
                distance: 200,
                duration: 0.2,
                speed: 2,
              },
            },
          },
          particles: {
            color: {
              value: "#649ded",
            },
            links: {
              color: "#649ded",
              distance: 150,
              enable: true,
              opacity: 0.4,
              width: 1,
            },
            move: {
              direction: "none",
              enable: true,
              outModes: {
                default: "bounce",
              },
              random: false,
              speed: 0.5,
              straight: false,
            },
            number: {
              density: {
                enable: true,
                area: 850,
              },
              value: 80,
            },
            opacity: {
              value: 0.4,
            },
            shape: {
              type: "circle",
            },
            size: {
              value: { min: 1, max: 5 },
            },
          },
          detectRetina: true,
        }}
        className="absolute inset-0 z-0"
      />

      <div className="w-full max-w-md relative z-10">
        {/* Login Card */}
        <Card className="border-0 bg-white backdrop-blur-sm shadow-2xl overflow-hidden rounded-3xl ring-1 ring-gray-200/50">
          <CardContent className="p-10">
            {/* Logo and Title */}
            <div className="mb-8 flex flex-col items-center text-center space-y-4">
              <div className="relative">
                <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/20">
                  <Building2 className="w-8 h-8 text-white" strokeWidth={2} />
                </div>
              </div>
              <div className="space-y-2">
                <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
                  FAAS System
                </h1>
                <p className="text-sm text-gray-600 font-medium">
                  Real Property Approval System
                </p>
              </div>
            </div>

            <form onSubmit={handleLogin} className="space-y-5">
              {/* Username Field */}
              <div className="space-y-2.5">
                <Label 
                  htmlFor="username" 
                  className="text-sm font-semibold text-gray-700 tracking-wide"
                >
                  Username
                </Label>
                <div className="relative group">
                  <div className="absolute left-3.5 top-1/2 -translate-y-1/2 flex items-center justify-center z-10">
                    <User className="w-4.5 h-4.5 text-gray-400 group-focus-within:text-blue-500 transition-colors duration-200" strokeWidth={2} />
                  </div>
                  <Input
                    id="username"
                    type="text"
                    placeholder="Enter your username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="pl-11 h-12 rounded-xl border border-gray-200 bg-gray-50/50 text-gray-900 placeholder:text-gray-400 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all duration-200"
                    required
                    disabled={isLoading}
                  />
                </div>
              </div>

              {/* Password Field */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <Label 
                    htmlFor="password" 
                    className="text-sm font-semibold text-gray-700 tracking-wide"
                  >
                    Password
                  </Label>
                </div>
                <div className="relative group">
                  <div className="absolute left-3.5 top-1/2 -translate-y-1/2 flex items-center justify-center z-10">
                    <Lock className="w-4.5 h-4.5 text-gray-400 group-focus-within:text-blue-500 transition-colors duration-200" strokeWidth={2} />
                  </div>
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-11 pr-11 h-12 rounded-xl border border-gray-200 bg-gray-50/50 text-gray-900 placeholder:text-gray-400 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all duration-200"
                    required
                    disabled={isLoading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors duration-200"
                    disabled={isLoading}
                  >
                    {showPassword ? (
                      <EyeOff className="w-5 h-5" strokeWidth={2} />
                    ) : (
                      <Eye className="w-5 h-5" strokeWidth={2} />
                    )}
                  </button>
                </div>
              </div>

              {/* Submit Button */}
              <Button
                type="submit"
                className="w-full h-12 rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white shadow-lg shadow-blue-500/30 font-bold tracking-wide transition-all duration-200 hover:shadow-xl hover:shadow-blue-500/40 hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 mt-6"
                disabled={isLoading}
              >
                {isLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Signing in...</span>
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    <span>Sign In</span>
                    <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform duration-200" />
                  </span>
                )}
              </Button>
            </form>


          </CardContent>
        </Card>

        {/* Footer */}
        <div className="mt-6 text-center">
          <p className="text-xs text-gray-500 font-medium">
            © 2026 ICTS - Local Government Unit Boac
          </p>
        </div>
      </div>

      {/* Decorative elements */}
      <div className="absolute top-10 left-10 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-10 right-10 w-96 h-96 bg-gray-400/5 rounded-full blur-3xl pointer-events-none"></div>
    </div>
  );
}