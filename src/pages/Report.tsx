import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Download, AlertTriangle, CheckCircle2, TrendingUp, Info } from "lucide-react";
import AppLayout from "@/components/AppLayout";

interface Prediction {
  label: string;
  confidence: number;
}

const Report = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [loading, setLoading] = useState(true);
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [malignantRisk, setMalignantRisk] = useState({
    probability: 0,
    threshold: 0.5,
    riskLabel: "Low risk"
  });

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth");
        return;
      }

      // Mock data for demonstration
      // In production, this would fetch from the database using the report ID
      setPredictions([
        { label: "Actinic Keratosis", confidence: 0.78 },
        { label: "Melanoma", confidence: 0.12 },
        { label: "Basal Cell Carcinoma", confidence: 0.06 },
      ]);
      
      setMalignantRisk({
        probability: 0.23,
        threshold: 0.30,
        riskLabel: "Low risk"
      });
      
      setLoading(false);
    };
    
    checkAuth();
  }, [navigate, id]);

  const downloadReport = () => {
    toast.success("Report download feature coming soon!");
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-screen">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="medical-container py-8 max-w-5xl">
        <div className="mb-8 animate-fade-in">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold mb-2">Diagnostic Report</h1>
              <p className="text-muted-foreground">
                Analysis ID: {id} • Generated: {new Date().toLocaleDateString()}
              </p>
            </div>
            <Button onClick={downloadReport} variant="outline">
              <Download className="h-4 w-4 mr-2" />
              Download PDF
            </Button>
          </div>
        </div>

        <Alert className="mb-6 border-warning bg-warning/5 animate-fade-in">
          <AlertTriangle className="h-4 w-4 text-warning" />
          <AlertDescription className="text-sm font-medium">
            <strong>Medical Disclaimer:</strong> This is NOT a medical diagnosis. Results are for educational and 
            research purposes only. Always consult a licensed dermatologist for accurate diagnosis and treatment.
          </AlertDescription>
        </Alert>

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card className="medical-card animate-fade-in">
              <CardHeader>
                <CardTitle>Top Predicted Conditions</CardTitle>
                <CardDescription>
                  AI model predictions with confidence scores
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {predictions.map((prediction, idx) => (
                  <div 
                    key={idx} 
                    className="space-y-2 p-4 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{idx + 1}.</span>
                        <span className="font-medium">{prediction.label}</span>
                      </div>
                      <Badge variant={idx === 0 ? "default" : "secondary"}>
                        {(prediction.confidence * 100).toFixed(1)}%
                      </Badge>
                    </div>
                    <Progress value={prediction.confidence * 100} className="h-2" />
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="medical-card animate-fade-in" style={{ animationDelay: "100ms" }}>
              <CardHeader>
                <CardTitle>Recommended Next Steps</CardTitle>
                <CardDescription>
                  Based on the analysis results
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-start gap-3 p-3 rounded-lg bg-primary/5">
                  <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium mb-1">Consult a Dermatologist</p>
                    <p className="text-sm text-muted-foreground">
                      Schedule an appointment with a licensed dermatologist for professional evaluation.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-lg bg-secondary/5">
                  <Info className="h-5 w-5 text-secondary flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium mb-1">Monitor Changes</p>
                    <p className="text-sm text-muted-foreground">
                      Track any changes in size, color, or symptoms. Take photos periodically.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-lg bg-accent/5">
                  <TrendingUp className="h-5 w-5 text-accent flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium mb-1">Follow Up Analysis</p>
                    <p className="text-sm text-muted-foreground">
                      Consider re-scanning in 2-4 weeks to track progression or improvement.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card className={`medical-card animate-fade-in ${malignantRisk.riskLabel === "High risk" ? "border-destructive" : "border-success"}`} style={{ animationDelay: "200ms" }}>
              <CardHeader>
                <CardTitle>Malignant Risk Assessment</CardTitle>
                <CardDescription>
                  Binary risk probability analysis
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-center p-6 rounded-lg bg-muted/30">
                  <div className={`text-4xl font-bold mb-2 ${malignantRisk.riskLabel === "High risk" ? "text-destructive" : "text-success"}`}>
                    {(malignantRisk.probability * 100).toFixed(1)}%
                  </div>
                  <Badge 
                    variant={malignantRisk.riskLabel === "High risk" ? "destructive" : "default"}
                    className="text-sm"
                  >
                    {malignantRisk.riskLabel}
                  </Badge>
                </div>
                
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Risk Probability:</span>
                    <span className="font-medium">{(malignantRisk.probability * 100).toFixed(2)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Decision Threshold:</span>
                    <span className="font-medium">{(malignantRisk.threshold * 100).toFixed(0)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Model Version:</span>
                    <span className="font-medium">v2.5-folds</span>
                  </div>
                </div>

                <Alert className="border-info bg-info/5">
                  <Info className="h-4 w-4" />
                  <AlertDescription className="text-xs">
                    Threshold calibrated on validation data targeting 30% precision. 
                    Risk assessment includes gating logic for improved accuracy.
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>

            <Card className="medical-card animate-fade-in" style={{ animationDelay: "300ms" }}>
              <CardHeader>
                <CardTitle>Model Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Architecture:</span>
                  <span className="font-medium">EfficientNetV2S</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Folds Used:</span>
                  <span className="font-medium">0, 1, 2</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">TTA Enabled:</span>
                  <span className="font-medium">Yes</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Gating:</span>
                  <span className="font-medium">Active</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Conditions:</span>
                  <span className="font-medium">43 classes</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="mt-6 flex gap-4 animate-fade-in" style={{ animationDelay: "400ms" }}>
          <Button onClick={() => navigate("/history")} variant="outline" className="flex-1">
            View History
          </Button>
          <Button onClick={() => navigate("/upload")} className="flex-1 bg-accent hover:bg-accent/90">
            New Analysis
          </Button>
        </div>
      </div>
    </AppLayout>
  );
};

export default Report;
