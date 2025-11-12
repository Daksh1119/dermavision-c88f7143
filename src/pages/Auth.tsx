import { useState, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger
} from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Activity, Loader2 } from "lucide-react";

/**
 * Minimal profile completeness rule (must match onboarding & guards)
 */
function isProfileComplete(p: any | null): boolean {
  if (!p) return false;
  const hasName = !!(p.full_name && p.full_name.trim().length >= 2);
  const hasAge =
    typeof p.age === "number" && !Number.isNaN(p.age) && p.age >= 1 && p.age <= 120;
  const hasPhone = !!(p.phone && p.phone.trim().length >= 6);
  const hasSkin = !!p.skin_type;
  return hasName && hasAge && hasPhone && hasSkin;
}

const Auth = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // tab + redirect
  const defaultTab = searchParams.get("tab") === "signup" ? "signup" : "signin";
  const redirectTarget = searchParams.get("redirect") || "/upload";

  // form state
  const [loading, setLoading] = useState(false);
  const [initialChecking, setInitialChecking] = useState(true);
  const [activeTab, setActiveTab] = useState(defaultTab);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  /**
   * After any successful auth, decide where to send user:
   *  - If profile complete -> redirectTarget
   *  - Else -> onboarding with redirect param
   */
  const routePostAuth = useCallback(
    async (fallbackRedirect?: string) => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        const userId = session.user.id;
        const { data, error } = await (supabase as any)
          .from("profiles")
          .select("*")
          .eq("id", userId)
          .maybeSingle();

        if (error) {
          // If profile table query fails, force onboarding to capture required data
          navigate(`/onboarding?redirect=${encodeURIComponent(redirectTarget)}`, { replace: true });
          return;
        }

        if (isProfileComplete(data)) {
          navigate(fallbackRedirect || redirectTarget, { replace: true });
        } else {
          navigate(`/onboarding?redirect=${encodeURIComponent(redirectTarget)}`, { replace: true });
        }
      } catch {
        navigate(`/onboarding?redirect=${encodeURIComponent(redirectTarget)}`, { replace: true });
      }
    },
    [navigate, redirectTarget]
  );

  // If already authenticated on visit, route accordingly
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (cancelled) return;
      if (session) {
        await routePostAuth();
      }
      setInitialChecking(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [routePostAuth]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password
      });
      if (error) throw error;

      toast.success("Welcome back!");
      await routePostAuth();
    } catch (error: any) {
      toast.error(error.message || "Failed to sign in");
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth?redirect=${encodeURIComponent(
            redirectTarget
          )}`
        }
      });
      if (error) throw error;

      if (data.session) {
        // Immediate session (e.g. email confirmation disabled)
        toast.success("Account created!");
        await routePostAuth();
      } else {
        toast.success(
          "Account created! Please confirm your email then return to sign in."
        );
        setActiveTab("signin");
        setPassword("");
        setConfirmPassword("");
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to create account");
    } finally {
      setLoading(false);
    }
  };

  if (initialChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6 animate-fade-in">
        <div className="text-center space-y-2">
          <div className="flex justify-center">
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
              <Activity className="h-6 w-6 text-primary" />
            </div>
          </div>
          <h1 className="text-3xl font-bold">DermaVision</h1>
          <p className="text-muted-foreground">
            Advanced skin disease detection powered by machine learning
          </p>
        </div>

        <Card className="medical-card">
          <CardHeader>
            <CardTitle>Account Access</CardTitle>
            <CardDescription>
              {activeTab === "signup"
                ? "Create your account to continue"
                : "Sign in to continue"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs
              defaultValue={defaultTab}
              value={activeTab}
              onValueChange={setActiveTab}
              className="w-full"
            >
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="signin" disabled={loading}>
                  Sign In
                </TabsTrigger>
                <TabsTrigger value="signup" disabled={loading}>
                  Sign Up
                </TabsTrigger>
              </TabsList>

              <TabsContent value="signin">
                <form onSubmit={handleSignIn} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signin-email">Email</Label>
                    <Input
                      id="signin-email"
                      type="email"
                      placeholder="your@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      disabled={loading}
                      autoComplete="email"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signin-password">Password</Label>
                    <Input
                      id="signin-password"
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      disabled={loading}
                      autoComplete="current-password"
                      minLength={6}
                    />
                  </div>
                  <Button
                    type="submit"
                    className="w-full"
                    disabled={loading}
                  >
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Signing in...
                      </>
                    ) : (
                      "Sign In"
                    )}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="signup">
                <form onSubmit={handleSignUp} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signup-email">Email</Label>
                    <Input
                      id="signup-email"
                      type="email"
                      placeholder="your@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      disabled={loading}
                      autoComplete="email"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-password">Password</Label>
                    <Input
                      id="signup-password"
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      disabled={loading}
                      minLength={6}
                      autoComplete="new-password"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-confirm">Confirm Password</Label>
                    <Input
                      id="signup-confirm"
                      type="password"
                      placeholder="••••••••"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      disabled={loading}
                      autoComplete="new-password"
                    />
                  </div>
                  <Button
                    type="submit"
                    className="w-full"
                    disabled={loading}
                  >
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Creating account...
                      </>
                    ) : (
                      "Create Account"
                    )}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <div className="text-center">
          <Button
            variant="link"
            onClick={() => navigate("/")}
            className="text-sm text-muted-foreground"
            disabled={loading}
          >
            ← Back to home
          </Button>
        </div>

        <div className="text-center text-xs text-muted-foreground">
          By continuing you agree to securely provide required personal &
          dermatology‑relevant data to generate clinical-style reports.
        </div>
      </div>
    </div>
  );
};

export default Auth;