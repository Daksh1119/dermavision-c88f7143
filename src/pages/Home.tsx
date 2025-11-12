import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import AppLayout from "@/components/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  History,
  MapPin,
  User,
  ImagePlus,
  AlertTriangle,
  FileText,
  Cpu,
  Database,
  ShieldCheck,
  LogIn,
  ArrowRight,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { getConditionName } from "@/data/conditionMap"; // mapping internal labels -> clinical names

interface Diagnosis {
  id: string;
  created_at: string;
  top_condition: string | null;
  top_confidence: number | null;
}

const formatPercent = (v?: number | null, digits = 1) =>
  v === null || v === undefined ? "—" : `${(v * 100).toFixed(digits)}%`;

function displayCondition(label?: string | null): string {
  if (!label) return "Not available";
  const mapped = getConditionName(label) || label;
  if (/^class[_\- ]?\d+$/i.test(mapped)) return "Unlabeled internal class";
  return mapped;
}

const Home = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [authChecked, setAuthChecked] = useState(false);
  const [diagLoading, setDiagLoading] = useState(false);
  const [recent, setRecent] = useState<Diagnosis | null>(null);
  const [userEmail, setUserEmail] = useState<string>("");

  useEffect(() => {
    const init = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      setAuthChecked(true);
      if (!session) {
        navigate("/auth");
        return;
      }
      setUserEmail(session.user.email || "");
      await loadRecent(session.user.id);
      setLoading(false);
    };
    init();
  }, [navigate]);

  async function loadRecent(userId: string) {
    setDiagLoading(true);
    try {
      const sb: any = supabase;
      const { data, error } = await sb
        .from("diagnoses")
        .select("id, created_at, top_condition, top_confidence")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(1);
      if (error) throw error;
      setRecent(data?.[0] || null);
    } catch {
      toast.error("Failed to load latest report");
    } finally {
      setDiagLoading(false);
    }
  }

  if (!authChecked || loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-screen">
          <div className="flex flex-col items-center gap-3">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            <p className="text-sm text-muted-foreground">Loading your home dashboard…</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="medical-container py-8 max-w-7xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">Welcome back</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Signed in as <span className="font-medium">{userEmail}</span>
          </p>
        </div>

        {/* Main Grid */}
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Left Column */}
          <div className="space-y-8 lg:col-span-2">
            {/* Latest Report Snapshot */}
            <Card className="medical-card">
              <CardHeader className="pb-3">
                <CardTitle>Latest Report Snapshot</CardTitle>
                <CardDescription>
                  A concise overview of your most recent AI skin assessment
                </CardDescription>
              </CardHeader>
              <CardContent>
                {diagLoading ? (
                  <div className="flex items-center gap-3 text-sm text-muted-foreground">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary" />
                    Loading latest report…
                  </div>
                ) : recent ? (
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-center gap-3">
                      <Badge variant="outline" className="text-xs">
                        {new Date(recent.created_at).toLocaleDateString()}
                      </Badge>
                    </div>
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <div className="text-xs text-muted-foreground">Top Condition</div>
                        <div className="font-semibold">
                          {displayCondition(recent.top_condition)}
                        </div>
                      </div>
                      <div className="space-y-1">
                        <div className="text-xs text-muted-foreground">Confidence</div>
                        <div className="font-semibold">
                          {formatPercent(recent.top_confidence)}
                        </div>
                      </div>
                      <div className="space-y-1">
                        <div className="text-xs text-muted-foreground">Report ID</div>
                        <div className="font-mono text-xs">{recent.id}</div>
                      </div>
                    </div>
                    <div className="flex gap-3 pt-2">
                      <Button size="sm" variant="default" onClick={() => navigate(`/report/${recent.id}`)}>
                        Open Full Report
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => navigate("/history")}>
                        View All
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                      No reports yet. Upload an image to generate your first assessment.
                    </p>
                    <Button className="bg-accent hover:bg-accent/90" onClick={() => navigate("/upload")}>
                      Upload Image Now
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Quick Start Guidance */}
            <Card className="medical-card">
              <CardHeader className="pb-3">
                <CardTitle>Quick Start Guidance</CardTitle>
                <CardDescription>Simple steps for a clinically useful capture</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <div className="grid md:grid-cols-3 gap-3">
                  {[
                    {
                      icon: ImagePlus,
                      title: "Capture",
                      text: "Use clear lighting. Avoid motion blur. No facial regions.",
                    },
                    {
                      icon: AlertTriangle,
                      title: "Check",
                      text: "Ensure focus on lesion. Remove jewelry or obstructing items.",
                    },
                    {
                      icon: FileText,
                      title: "Report",
                      text: "Receive a concise summary and share PDF with your clinician.",
                    },
                  ].map((b, i) => (
                    <div key={i} className="rounded-lg border bg-card/60 p-3 flex flex-col gap-2">
                      <div className="flex items-center gap-2">
                        <b.icon className="h-5 w-5 text-primary" />
                        <div className="font-medium text-sm">{b.title}</div>
                      </div>
                      <p className="text-xs text-muted-foreground">{b.text}</p>
                    </div>
                  ))}
                </div>
                <Button className="w-full bg-accent hover:bg-accent/90" onClick={() => navigate("/upload")}>
                  Upload Image Now
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Right Column */}
          <div className="space-y-8">
            {/* Platform Overview */}
            <Card className="medical-card">
              <CardHeader className="pb-3">
                <CardTitle>Platform Overview</CardTitle>
                <CardDescription>Core technical & safety aspects</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <div className="flex items-start gap-3">
                  <Cpu className="h-5 w-5 text-primary mt-0.5" />
                  <div>
                    <div className="font-medium">Analysis Provider</div>
                    <p className="text-xs text-muted-foreground">
                      Images are analyzed via a trusted third‑party AI service (AILabTools) through a secure API.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Database className="h-5 w-5 text-primary mt-0.5" />
                  <div>
                    <div className="font-medium">Condition Coverage</div>
                    <p className="text-xs text-muted-foreground">
                      Broad set of common dermatology conditions with confidence estimates.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <ShieldCheck className="h-5 w-5 text-primary mt-0.5" />
                  <div>
                    <div className="font-medium">Safety Philosophy</div>
                    <p className="text-xs text-muted-foreground">
                      Patient‑first summaries; explicit disclaimers; encourages licensed clinical follow‑up.
                    </p>
                  </div>
                </div>
                <Alert className="bg-warning/5 border-warning/30">
                  <AlertDescription className="text-xs leading-relaxed">
                    Not a substitute for medical diagnosis. Always consult a licensed dermatologist for treatment decisions.
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>

            {/* Account & Navigation */}
            <Card className="medical-card">
              <CardHeader className="pb-3">
                <CardTitle>Account & Navigation</CardTitle>
                <CardDescription>Access your data & supporting resources</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <div className="grid gap-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-primary" />
                      <span>Profile & Medical Info</span>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => navigate("/profile")}>
                      Open
                    </Button>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <History className="h-4 w-4 text-primary" />
                      <span>Report History</span>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => navigate("/history")}>
                      Open
                    </Button>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-primary" />
                      <span>Nearby Dermatology Centers</span>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => navigate("/nearby")}>
                      Open
                    </Button>
                  </div>
                </div>
                {!userEmail && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => navigate("/auth")}
                    className="w-full justify-center"
                  >
                    <LogIn className="h-4 w-4 mr-2" />
                    Sign In
                  </Button>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default Home;