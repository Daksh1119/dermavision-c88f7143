import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import {
  Activity,
  Shield,
  FileText,
  Database,
  Cpu,
  Lock,
  ImagePlus,
  ArrowRight,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Landing page (public)
 * - If a session already exists, user is redirected to /home (no repeated sign‑in).
 * - Branding unified: "DermaVision"
 */
const Landing = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const checkExistingSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session) {
        // User already authenticated -> go straight to Home
        navigate("/home", { replace: true });
      }
    };
    checkExistingSession();
  }, [navigate]);

  return (
    <div className="min-h-screen bg-background relative overflow-clip">
      {/* Soft background accents */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 -right-24 h-[28rem] w-[28rem] rounded-full opacity-30 blur-3xl"
        style={{
          background:
            "radial-gradient(closest-side, hsl(var(--primary)/0.18), transparent 70%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-32 -left-24 h-[26rem] w-[26rem] rounded-full opacity-30 blur-3xl"
        style={{
          background:
            "radial-gradient(closest-side, hsl(var(--accent)/0.18), transparent 70%)",
        }}
      />

      {/* Top navigation */}
      <nav className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="medical-container py-4 flex justify-between items-center">
          <button
            type="button"
            onClick={() => navigate("/")}
            className="flex items-center gap-2"
            aria-label="DermaVision Home"
          >
            <Activity className="h-6 w-6 text-primary" />
            <span className="font-bold text-xl text-foreground">DermaVision</span>
          </button>
          <div className="flex gap-3">
            <Button variant="ghost" onClick={() => navigate("/auth")}>
              Sign In
            </Button>
            <Button variant="default" onClick={() => navigate("/auth?tab=signup")}>
              Get Started
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="medical-container pt-14 pb-8 md:pt-20 md:pb-16">
        <div className="grid lg:grid-cols-2 gap-10 lg:gap-14 items-center">
          {/* Copy */}
          <div className="space-y-6 animate-fade-in">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold leading-tight tracking-tight">
              Advanced Skin Disease Detection{" "}
              <span className="block text-primary">Powered by AI</span>
            </h1>
            <p className="text-base md:text-lg text-muted-foreground max-w-xl leading-relaxed">
              Get structured insights into potential skin conditions using a clinician‑oriented workflow.
              Upload an image, review a clear, concise report, and share a downloadable summary with your dermatologist.
            </p>

            <div className="flex flex-wrap gap-4">
              <Button
                size="lg"
                className="bg-accent hover:bg-accent/90"
                onClick={() => navigate("/auth?tab=signup")}
              >
                Start Free Analysis
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
              <Button size="lg" variant="outline" onClick={() => navigate("/auth")}>
                View Demo
              </Button>
            </div>

            {/* Assurance row */}
            <div className="grid sm:grid-cols-3 gap-3 pt-4">
              <div className="medical-card p-3 flex items-center gap-3 animate-fade-in">
                <Lock className="h-5 w-5 text-primary" />
                <div className="text-sm">
                  <p className="font-medium">Privacy‑aware flow</p>
                  <p className="text-muted-foreground text-xs">User‑controlled data handling</p>
                </div>
              </div>
              <div
                className="medical-card p-3 flex items-center gap-3 animate-fade-in"
                style={{ animationDelay: "60ms" }}
              >
                <FileText className="h-5 w-5 text-primary" />
                <div className="text-sm">
                  <p className="font-medium">Clinician‑ready report</p>
                  <p className="text-muted-foreground text-xs">Downloadable PDF</p>
                </div>
              </div>
              <div
                className="medical-card p-3 flex items-center gap-3 animate-fade-in"
                style={{ animationDelay: "120ms" }}
              >
                <Shield className="h-5 w-5 text-primary" />
                <div className="text-sm">
                  <p className="font-medium">Medical disclaimer</p>
                  <p className="text-muted-foreground text-xs">Assistive, not diagnostic</p>
                </div>
              </div>
            </div>
          </div>

          {/* Visual */}
          <div className="relative">
            <div className="medical-card p-3 md:p-5 animate-scale-in">
              <div className="rounded-xl overflow-hidden shadow-2xl bg-muted/20">
                <img
                  src="https://images.unsplash.com/photo-1532938911079-1b06ac7ceec7?q=80&w=1600&auto=format&fit=crop"
                  alt="Dermatology examination illustration"
                  className="w-full h-[320px] md:h-[380px] object-cover"
                />
              </div>

              {/* Floating stat chips */}
              <div className="absolute -bottom-5 left-6 md:left-10">
                <div className="bg-card shadow-xl rounded-xl border p-3 pr-4 flex items-center gap-3 animate-fade-in">
                  <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center">
                    <Database className="h-4 w-4 text-primary" />
                  </div>
                  <div className="leading-tight">
                    <p className="text-sm font-semibold">Broad Condition Coverage</p>
                    <p className="text-xs text-muted-foreground">Common dermatologic classes</p>
                  </div>
                </div>
              </div>

              <div className="absolute -top-5 right-6 md:right-10">
                <div
                  className="bg-card shadow-xl rounded-xl border p-3 pr-4 flex items-center gap-3 animate-fade-in"
                  style={{ animationDelay: "120ms" }}
                >
                  <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center">
                    <Cpu className="h-4 w-4 text-primary" />
                  </div>
                  <div className="leading-tight">
                    <p className="text-sm font-semibold">AI Analysis Service</p>
                    <p className="text-xs text-muted-foreground">Secure API‑based processing</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Process */}
      <section className="bg-card/40 border-y border-border">
        <div className="medical-container py-16 md:py-20">
          <div className="text-center mb-12 md:mb-16">
            <h2 className="text-2xl md:text-4xl font-bold mb-3">How DermaVision Works</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              A focused, three‑step flow to keep patients informed and clinicians prepared.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 md:gap-8">
            {[
              {
                title: "Upload Image",
                description:
                  "Capture or upload a clear photo of the skin region. Simple, guided, and fast.",
                icon: <ImagePlus className="h-5 w-5 text-primary" />,
                step: "01",
                delay: "0ms",
              },
              {
                title: "AI Analysis",
                description:
                  "Your image is analyzed via a trusted third‑party AI service integrated into our platform.",
                icon: <Cpu className="h-5 w-5 text-primary" />,
                step: "02",
                delay: "80ms",
              },
              {
                title: "Get Report",
                description:
                  "Receive a concise summary for patients and a downloadable clinician‑ready PDF.",
                icon: <FileText className="h-5 w-5 text-primary" />,
                step: "03",
                delay: "160ms",
              },
            ].map((item, idx) => (
              <div
                key={idx}
                className="medical-card p-6 hover:shadow-md transition-all animate-fade-in"
                style={{ animationDelay: item.delay }}
              >
                <div className="text-sm text-primary font-bold tracking-wider mb-2">
                  STEP {item.step}
                </div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center">
                    {item.icon}
                  </div>
                  <h3 className="text-lg font-semibold">{item.title}</h3>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Technology snapshot */}
      <section className="medical-container py-16 md:py-20">
        <div className="grid lg:grid-cols-2 gap-8 items-start">
          <div className="space-y-4 animate-fade-in">
            <h3 className="text-2xl md:text-3xl font-bold">Designed for clarity and safety</h3>
            <p className="text-muted-foreground leading-relaxed">
              The interface prioritizes patient comprehension while exposing concise, technical context for clinicians.
              Reports avoid jargon, keep essential facts upfront, and provide optional depth when needed.
            </p>
            <div className="grid sm:grid-cols-2 gap-3 pt-2">
              <div className="medical-card p-4">
                <div className="text-xs text-muted-foreground">Analysis</div>
                <div className="font-medium">Trusted AI service (vendor)</div>
              </div>
              <div className="medical-card p-4">
                <div className="text-xs text-muted-foreground">Conditions</div>
                <div className="font-medium">Broad coverage</div>
              </div>
              <div className="medical-card p-4">
                <div className="text-xs text-muted-foreground">Confidence</div>
                <div className="font-medium">Top‑N probabilities</div>
              </div>
              <div className="medical-card p-4">
                <div className="text-xs text-muted-foreground">Report</div>
                <div className="font-medium">Downloadable PDF summary</div>
              </div>
            </div>
            <div className="pt-2">
              <Button
                variant="outline"
                onClick={() => navigate("/auth?tab=signup")}
                className="group"
              >
                Begin Assessment
                <ArrowRight className="h-4 w-4 ml-2 transition-transform group-hover:translate-x-0.5" />
              </Button>
            </div>
          </div>

          <div className="medical-card p-0 overflow-hidden animate-scale-in">
            <div className="bg-gradient-to-br from-primary/5 to-secondary/5 px-6 py-5 border-b">
              <div className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-primary" />
                <span className="font-semibold">Patient‑first presentation</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Clear summaries for patients, structured context for clinicians.
              </p>
            </div>
            <div className="p-6 grid sm:grid-cols-2 gap-4">
              <div className="rounded-lg border p-4 bg-card/60">
                <div className="text-xs text-muted-foreground">Top condition</div>
                <div className="font-semibold mt-1">Shown prominently</div>
                <p className="text-xs text-muted-foreground mt-2">
                  Most likely condition shown clearly.
                </p>
              </div>
              <div className="rounded-lg border p-4 bg-card/60">
                <div className="text-xs text-muted-foreground">Next steps</div>
                <div className="font-semibold mt-1">Actionable and simple</div>
                <p className="text-xs text-muted-foreground mt-2">
                  Clear, safe follow‑up guidance.
                </p>
              </div>
              <div className="rounded-lg border p-4 bg-card/60">
                <div className="text-xs text-muted-foreground">Technical panel</div>
                <div className="font-semibold mt-1">Always available</div>
                <p className="text-xs text-muted-foreground mt-2">
                  Optional clinician detail.
                </p>
              </div>
              <div className="rounded-lg border p-4 bg-card/60">
                <div className="text-xs text-muted-foreground">PDF handover</div>
                <div className="font-semibold mt-1">Shareable summary</div>
                <p className="text-xs text-muted-foreground mt-2">
                  Compact for consultations.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Disclaimer */}
      <section className="medical-container pb-20">
        <div className="medical-card p-6 md:p-8 bg-warning/5 border-warning/20 animate-fade-in">
          <div className="flex items-start gap-4">
            <Shield className="h-7 w-7 text-warning flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="text-lg md:text-xl font-semibold mb-2">Important Medical Disclaimer</h3>
              <p className="text-sm md:text-base text-muted-foreground leading-relaxed">
                DermaVision is an educational and research tool designed to assist in identifying potential skin conditions.
                This service is NOT a medical diagnosis and should not replace professional medical advice. Always consult a licensed
                dermatologist or healthcare provider for diagnosis and treatment. AI outputs are probability‑based indicators only.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-primary text-primary-foreground py-16 md:py-20">
        <div className="medical-container text-center">
          <h2 className="text-2xl md:text-4xl font-bold mb-3">
            Begin a privacy‑aware screening in minutes
          </h2>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-card py-8">
        <div className="medical-container text-center text-sm text-muted-foreground">
          <p>&copy; {new Date().getFullYear()} DermaVision. For educational and research purposes only.</p>
        </div>
      </footer>
    </div>
  );
};

export default Landing;