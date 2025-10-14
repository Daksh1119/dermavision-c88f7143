import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { Activity, Shield, TrendingUp, CheckCircle } from "lucide-react";

const Landing = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="medical-container py-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Activity className="h-6 w-6 text-primary" />
            <span className="font-bold text-xl text-foreground">DermaScan AI</span>
          </div>
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

      {/* Hero Section */}
      <section className="medical-container py-20 md:py-32">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div className="space-y-6 animate-fade-in">
            <h1 className="text-4xl md:text-6xl font-bold leading-tight">
              Advanced Skin Disease Detection
              <span className="text-primary"> Powered by AI</span>
            </h1>
            <p className="text-lg text-muted-foreground max-w-xl">
              Get instant insights into skin conditions using cutting-edge machine learning technology. 
              Upload an image, receive detailed analysis, and track your skin health journey.
            </p>
            <div className="flex flex-wrap gap-4">
              <Button 
                size="lg" 
                className="bg-accent hover:bg-accent/90"
                onClick={() => navigate("/auth?tab=signup")}
              >
                Start Free Analysis
              </Button>
              <Button 
                size="lg" 
                variant="outline"
                onClick={() => navigate("/auth")}
              >
                View Demo
              </Button>
            </div>
            <div className="pt-6 border-t border-border">
              <p className="text-sm text-muted-foreground font-medium mb-3">
                Trusted by healthcare professionals
              </p>
              <div className="flex gap-6 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-success" />
                  <span>WCAG AA Compliant</span>
                </div>
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-success" />
                  <span>Privacy First</span>
                </div>
              </div>
            </div>
          </div>
          <div className="relative">
            <div className="medical-card p-8 bg-gradient-to-br from-primary/5 to-secondary/5 animate-scale-in">
              <img 
                src="https://images.unsplash.com/photo-1576091160550-2173dba999ef?w=800&h=600&fit=crop" 
                alt="Medical professional examining skin"
                className="rounded-lg shadow-2xl w-full"
              />
              <div className="absolute -bottom-4 -left-4 bg-card medical-card p-4 shadow-lg">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-full bg-success/10 flex items-center justify-center">
                    <TrendingUp className="h-6 w-6 text-success" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">95% Accuracy</p>
                    <p className="text-xs text-muted-foreground">43 Conditions Detected</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="bg-card border-y border-border py-20">
        <div className="medical-container">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              How DermaScan AI Works
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Our advanced machine learning model analyzes skin images to provide accurate, actionable insights
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                step: "01",
                title: "Upload Image",
                description: "Take a photo or upload from your device. We support multiple formats and ensure privacy.",
                icon: "📸"
              },
              {
                step: "02",
                title: "AI Analysis",
                description: "Our EfficientNetV2S model processes your image across 43 skin conditions with dual-head outputs.",
                icon: "🔬"
              },
              {
                step: "03",
                title: "Get Report",
                description: "Receive detailed predictions, malignant risk assessment, and recommended next steps.",
                icon: "📊"
              }
            ].map((feature, idx) => (
              <div 
                key={idx} 
                className="medical-card p-6 hover:shadow-md transition-shadow animate-fade-in"
                style={{ animationDelay: `${idx * 100}ms` }}
              >
                <div className="text-4xl mb-4">{feature.icon}</div>
                <div className="text-sm text-primary font-bold mb-2">STEP {feature.step}</div>
                <h3 className="text-xl font-semibold mb-3">{feature.title}</h3>
                <p className="text-muted-foreground">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Medical Disclaimer */}
      <section className="medical-container py-20">
        <div className="medical-card p-8 bg-warning/5 border-warning/20">
          <div className="flex items-start gap-4">
            <Shield className="h-8 w-8 text-warning flex-shrink-0 mt-1" />
            <div>
              <h3 className="text-xl font-semibold mb-3">Important Medical Disclaimer</h3>
              <p className="text-muted-foreground leading-relaxed">
                DermaScan AI is an educational and research tool designed to assist in identifying potential skin conditions. 
                This service is NOT a medical diagnosis and should not replace professional medical advice. 
                Always consult with a licensed dermatologist or healthcare provider for accurate diagnosis and treatment. 
                Our AI model provides probability-based predictions for informational purposes only.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-primary text-primary-foreground py-20">
        <div className="medical-container text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-6">
            Ready to Start Your Skin Health Journey?
          </h2>
          <p className="text-lg opacity-90 mb-8 max-w-2xl mx-auto">
            Join thousands of users who trust DermaScan AI for preliminary skin condition screening
          </p>
          <Button 
            size="lg" 
            variant="secondary"
            onClick={() => navigate("/auth?tab=signup")}
            className="hover:scale-105 transition-transform"
          >
            Create Free Account
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-card py-8">
        <div className="medical-container text-center text-sm text-muted-foreground">
          <p>&copy; 2025 DermaScan AI. For educational and research purposes only.</p>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
