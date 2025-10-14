import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import AppLayout from "@/components/AppLayout";

interface FormData {
  age: string;
  sex: string;
  allergies: string;
  symptoms: string;
  currentMedications: string;
  previousMedications: string;
  familyHistory: string;
  symptomDuration: string;
  durationUnit: string;
  smoking: string;
  alcohol: string;
  diet: string;
  occupation: string;
}

const Form = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<FormData>({
    age: "",
    sex: "",
    allergies: "",
    symptoms: "",
    currentMedications: "",
    previousMedications: "",
    familyHistory: "",
    symptomDuration: "",
    durationUnit: "days",
    smoking: "",
    alcohol: "",
    diet: "",
    occupation: "",
  });

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth");
        return;
      }

      // Check if image was uploaded
      const uploadedFile = sessionStorage.getItem("uploadedFile");
      if (!uploadedFile) {
        toast.error("Please upload an image first");
        navigate("/upload");
      }
    };
    checkAuth();
  }, [navigate]);

  const handleChange = (field: keyof FormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.age || !formData.sex || !formData.symptoms) {
      toast.error("Please fill in all required fields");
      return;
    }

    setLoading(true);

    try {
      // In a real implementation, this would send to the ML API
      // For now, we'll create a mock report
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) throw new Error("User not found");

      // Store form data in session for the report page
      sessionStorage.setItem("formData", JSON.stringify(formData));
      
      toast.success("Analysis in progress...");
      
      // Simulate API processing time
      setTimeout(() => {
        navigate("/report/mock-id");
      }, 1500);

    } catch (error: any) {
      toast.error(error.message || "Failed to submit form");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppLayout>
      <div className="medical-container py-8 max-w-4xl">
        <div className="mb-8 animate-fade-in">
          <h1 className="text-3xl font-bold mb-2">Health Questionnaire</h1>
          <p className="text-muted-foreground">
            Please provide accurate information to help improve the diagnostic accuracy
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <Card className="medical-card animate-fade-in">
            <CardHeader>
              <CardTitle>Basic Information *</CardTitle>
              <CardDescription>Required fields for analysis</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="age">Age *</Label>
                  <Input
                    id="age"
                    type="number"
                    min="1"
                    max="120"
                    placeholder="Enter your age"
                    value={formData.age}
                    onChange={(e) => handleChange("age", e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sex">Sex *</Label>
                  <Select value={formData.sex} onValueChange={(value) => handleChange("sex", value)}>
                    <SelectTrigger id="sex">
                      <SelectValue placeholder="Select sex" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="male">Male</SelectItem>
                      <SelectItem value="female">Female</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="symptoms">Visible Symptoms *</Label>
                <Textarea
                  id="symptoms"
                  placeholder="Describe the symptoms you're experiencing (e.g., redness, itching, pain, discoloration)"
                  value={formData.symptoms}
                  onChange={(e) => handleChange("symptoms", e.target.value)}
                  required
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="allergies">Known Allergies</Label>
                <Input
                  id="allergies"
                  placeholder="List any known allergies (e.g., medications, foods, materials)"
                  value={formData.allergies}
                  onChange={(e) => handleChange("allergies", e.target.value)}
                />
              </div>
            </CardContent>
          </Card>

          <Card className="medical-card animate-fade-in" style={{ animationDelay: "100ms" }}>
            <CardHeader>
              <CardTitle>Medical History</CardTitle>
              <CardDescription>Help us understand your medical background</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="currentMedications">Current Medications</Label>
                <Textarea
                  id="currentMedications"
                  placeholder="List medications you're currently taking"
                  value={formData.currentMedications}
                  onChange={(e) => handleChange("currentMedications", e.target.value)}
                  rows={2}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="previousMedications">Previous Medications</Label>
                <Textarea
                  id="previousMedications"
                  placeholder="List medications you've taken for this condition"
                  value={formData.previousMedications}
                  onChange={(e) => handleChange("previousMedications", e.target.value)}
                  rows={2}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="familyHistory">Family History</Label>
                <Textarea
                  id="familyHistory"
                  placeholder="Any family history of skin conditions?"
                  value={formData.familyHistory}
                  onChange={(e) => handleChange("familyHistory", e.target.value)}
                  rows={2}
                />
              </div>
            </CardContent>
          </Card>

          <Card className="medical-card animate-fade-in" style={{ animationDelay: "200ms" }}>
            <CardHeader>
              <CardTitle>Symptom Duration & Lifestyle</CardTitle>
              <CardDescription>Additional information for comprehensive analysis</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="symptomDuration">Symptom Duration</Label>
                  <Input
                    id="symptomDuration"
                    type="number"
                    min="0"
                    placeholder="Enter duration"
                    value={formData.symptomDuration}
                    onChange={(e) => handleChange("symptomDuration", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="durationUnit">Unit</Label>
                  <Select value={formData.durationUnit} onValueChange={(value) => handleChange("durationUnit", value)}>
                    <SelectTrigger id="durationUnit">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="days">Days</SelectItem>
                      <SelectItem value="weeks">Weeks</SelectItem>
                      <SelectItem value="months">Months</SelectItem>
                      <SelectItem value="years">Years</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Smoking Habits</Label>
                <RadioGroup value={formData.smoking} onValueChange={(value) => handleChange("smoking", value)}>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="never" id="smoking-never" />
                    <Label htmlFor="smoking-never" className="font-normal cursor-pointer">Never</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="former" id="smoking-former" />
                    <Label htmlFor="smoking-former" className="font-normal cursor-pointer">Former</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="current" id="smoking-current" />
                    <Label htmlFor="smoking-current" className="font-normal cursor-pointer">Current</Label>
                  </div>
                </RadioGroup>
              </div>

              <div className="space-y-2">
                <Label>Alcohol Consumption</Label>
                <RadioGroup value={formData.alcohol} onValueChange={(value) => handleChange("alcohol", value)}>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="none" id="alcohol-none" />
                    <Label htmlFor="alcohol-none" className="font-normal cursor-pointer">None</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="occasional" id="alcohol-occasional" />
                    <Label htmlFor="alcohol-occasional" className="font-normal cursor-pointer">Occasional</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="regular" id="alcohol-regular" />
                    <Label htmlFor="alcohol-regular" className="font-normal cursor-pointer">Regular</Label>
                  </div>
                </RadioGroup>
              </div>

              <div className="space-y-2">
                <Label htmlFor="diet">Diet</Label>
                <Input
                  id="diet"
                  placeholder="Brief description of your diet"
                  value={formData.diet}
                  onChange={(e) => handleChange("diet", e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="occupation">Occupation</Label>
                <Input
                  id="occupation"
                  placeholder="Your occupation (if relevant to skin exposure)"
                  value={formData.occupation}
                  onChange={(e) => handleChange("occupation", e.target.value)}
                />
              </div>
            </CardContent>
          </Card>

          <div className="flex gap-4 animate-fade-in" style={{ animationDelay: "300ms" }}>
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate("/upload")}
              className="flex-1"
            >
              ← Back
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="flex-1 bg-accent hover:bg-accent/90"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Analyzing...
                </>
              ) : (
                "Submit for Analysis"
              )}
            </Button>
          </div>
        </form>
      </div>
    </AppLayout>
  );
};

export default Form;
