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
import { Loader2, ArrowLeft, ExternalLink } from "lucide-react";
import AppLayout from "@/components/AppLayout";

type Sex = "Male" | "Female" | "Other" | "Prefer not to say";
type Smoking = "never" | "former" | "current" | "";
type Alcohol = "none" | "occasional" | "regular" | "";

interface FormData {
  symptoms: string;
  currentMedications: string;
  previousMedications: string;
  familyHistory: string;
  symptomDuration: string;
  durationUnit: "days" | "weeks" | "months" | "years";
  smoking: Smoking;
  alcohol: Alcohol;
  diet: string;
  occupation: string;
  // Only used if missing in profile
  age?: string;
  sex?: Sex | "";
  allergiesOverride?: string;
  updateProfileAllergies: boolean;
}

interface ProfileRow {
  id: string;
  age?: number | null;
  sex?: Sex | null;
  allergies?: string | null;
  full_name?: string | null;
}

const DEFAULT_FORM: FormData = {
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
  age: "",
  sex: "",
  allergiesOverride: "",
  updateProfileAllergies: false,
};

const Form = () => {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [profileLoading, setProfileLoading] = useState(true);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [formData, setFormData] = useState<FormData>(DEFAULT_FORM);

  // Flags derived from profile
  const hasAge = profile?.age && profile.age > 0;
  const hasSex = !!profile?.sex;
  const hasAllergies = !!(profile?.allergies && profile.allergies.trim().length > 0);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth");
        return;
      }

      // Ensure image uploaded first
      const uploadedFile = sessionStorage.getItem("uploadedFile");
      if (!uploadedFile) {
        toast.error("Please upload an image first");
        navigate("/upload");
        return;
      }

      // Load profile basics
      await loadProfile(session.user.id);
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadProfile(userId: string) {
    try {
      const sb: any = supabase;
      const { data, error } = await sb
        .from("profiles")
        .select("id, age, sex, allergies, full_name")
        .eq("id", userId)
        .maybeSingle();
      if (error) throw error;
      if (data) {
        setProfile(data);
        // Pre-fill override allergies with existing if missing profile allergies
        if (!data.allergies) {
          setFormData(f => ({ ...f, allergiesOverride: "" }));
        } else {
          // If allergies exist, we keep questionnaire allergies blank (no duplicate ask)
          setFormData(f => ({ ...f, allergiesOverride: "" }));
        }
      } else {
        setProfile({ id: userId });
      }
    } catch (err: any) {
      console.error("Failed to load profile:", err);
      setProfile(null);
    } finally {
      setProfileLoading(false);
    }
  }

  function handleChange<K extends keyof FormData>(field: K, value: FormData[K]) {
    setFormData(prev => ({ ...prev, [field]: value }));
  }

  async function persistMissingDemographics() {
    // Only update profile if age / sex are missing OR user wants to update allergies
    if (!profile) return;
    const updatePayload: Record<string, any> = { updated_at: new Date().toISOString() };

    const needsAge = !hasAge && formData.age;
    const needsSex = !hasSex && formData.sex;
    const wantsAllergyUpdate =
      (!hasAllergies && formData.allergiesOverride) ||
      (formData.updateProfileAllergies && formData.allergiesOverride);

    if (needsAge) {
      const ageNum = Number(formData.age);
      if (Number.isFinite(ageNum) && ageNum > 0 && ageNum <= 120) {
        updatePayload.age = ageNum;
      }
    }
    if (needsSex) updatePayload.sex = formData.sex || null;
    if (wantsAllergyUpdate) {
      updatePayload.allergies = (formData.allergiesOverride || "").trim() || null;
    }

    // If no changes needed, skip update
    const keys = Object.keys(updatePayload).filter(k => k !== "updated_at");
    if (keys.length === 0) return;

    try {
      const sb: any = supabase;
      const { error } = await sb
        .from("profiles")
        .update(updatePayload)
        .eq("id", profile.id);
      if (error) throw error;
      // Refresh profile for consistency
      await loadProfile(profile.id);
    } catch (err: any) {
      console.error("Failed to update profile demographics:", err);
      toast.error("Could not save new personal info (Age/Sex/Allergies).");
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    // Requirements:
    // Always require symptoms
    // Require Age/Sex ONLY if missing in profile
    if (!formData.symptoms.trim()) {
      toast.error("Please enter visible symptoms.");
      return;
    }
    if (!hasAge) {
      if (!formData.age || !Number.isFinite(Number(formData.age))) {
        toast.error("Please provide your age.");
        return;
      }
    }
    if (!hasSex) {
      if (!formData.sex) {
        toast.error("Please select your sex.");
        return;
      }
    }

    setLoading(true);
    try {
      // Update profile with any newly provided demographics
      await persistMissingDemographics();

      // Persist ONLY questionnaire context separate from demographics
      const questionnaireContext = {
        symptoms: formData.symptoms.trim(),
        currentMedications: formData.currentMedications.trim(),
        previousMedications: formData.previousMedications.trim(),
        familyHistory: formData.familyHistory.trim(),
        symptomDuration: formData.symptomDuration.trim(),
        durationUnit: formData.durationUnit,
        smoking: formData.smoking,
        alcohol: formData.alcohol,
        diet: formData.diet.trim(),
        occupation: formData.occupation.trim(),
        // If allergies were newly captured (override), include in context for this run
        allergiesUsed: hasAllergies
          ? profile?.allergies
          : (formData.allergiesOverride || "").trim() || null,
      };

      // Store under a distinct key
      sessionStorage.setItem("questionnaireData", JSON.stringify(questionnaireContext));
      // For backward compatibility (if other components still read formData)
      sessionStorage.setItem("formData", JSON.stringify(questionnaireContext));

      toast.success("Questionnaire saved. Proceeding to analysis...");
      navigate("/report/mock-id");
    } catch (err: any) {
      toast.error(err.message || "Failed to submit questionnaire");
    } finally {
      setLoading(false);
    }
  }

  if (profileLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-[60vh]">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Loading your profile...</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="medical-container py-8 max-w-4xl">
        <div className="mb-8 animate-fade-in">
          <h1 className="text-3xl font-bold mb-2">Health Questionnaire</h1>
          <p className="text-muted-foreground text-sm">
            This step collects contextual medical & lifestyle details. Personal demographics already saved in your profile (Age, Sex, Allergies) are not re‑asked.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Symptoms & (only missing demographics) */}
          <Card className="medical-card animate-fade-in">
            <CardHeader>
              <CardTitle>Symptoms & Essentials</CardTitle>
              <CardDescription>
                Provide visible skin concerns and any missing personal info.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {!hasAge && (
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="age">Age (required, not yet in profile)</Label>
                    <Input
                      id="age"
                      type="number"
                      min={1}
                      max={120}
                      placeholder="Enter age"
                      value={formData.age}
                      onChange={(e) => handleChange("age", e.target.value)}
                      required
                    />
                  </div>
                  {!hasSex && (
                    <div className="space-y-2">
                      <Label htmlFor="sex">Sex (required, not yet in profile)</Label>
                      <Select
                        value={formData.sex}
                        onValueChange={(v) => handleChange("sex", v as Sex)}
                      >
                        <SelectTrigger id="sex">
                          <SelectValue placeholder="Select sex" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Male">Male</SelectItem>
                          <SelectItem value="Female">Female</SelectItem>
                          <SelectItem value="Other">Other</SelectItem>
                          <SelectItem value="Prefer not to say">Prefer not to say</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
              )}

              {/* Show read-only demographics if present */}
              {(hasAge || hasSex) && (
                <div className="grid md:grid-cols-2 gap-4 text-xs bg-muted/40 p-3 rounded">
                  {hasAge && (
                    <div>
                      <span className="text-muted-foreground">Age (from profile): </span>
                      <span className="font-medium">{profile?.age}</span>
                    </div>
                  )}
                  {hasSex && (
                    <div>
                      <span className="text-muted-foreground">Sex (from profile): </span>
                      <span className="font-medium">{profile?.sex}</span>
                    </div>
                  )}
                  <div className="md:col-span-2">
                    <Button
                      variant="link"
                      type="button"
                      className="h-auto p-0 text-xs"
                      onClick={() => navigate("/profile")}
                    >
                      Edit personal info in Profile <ExternalLink className="h-3 w-3 ml-1" />
                    </Button>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="symptoms">Visible Symptoms *</Label>
                <Textarea
                  id="symptoms"
                  placeholder="e.g. redness, itching, scaling, dark patch"
                  value={formData.symptoms}
                  onChange={(e) => handleChange("symptoms", e.target.value)}
                  rows={3}
                  required
                />
              </div>

              {/* Allergies only if missing or override checkbox */}
              {!hasAllergies && (
                <div className="space-y-2">
                  <Label htmlFor="allergiesOverride">
                    Known Allergies (optional – not yet in profile)
                  </Label>
                  <Input
                    id="allergiesOverride"
                    placeholder="e.g. benzoyl peroxide, fragrance"
                    value={formData.allergiesOverride || ""}
                    onChange={(e) => handleChange("allergiesOverride", e.target.value)}
                  />
                  <label className="flex items-center gap-2 text-xs mt-1">
                    <input
                      type="checkbox"
                      checked={formData.updateProfileAllergies}
                      onChange={(e) => handleChange("updateProfileAllergies", e.target.checked)}
                    />
                    Save to Profile
                  </label>
                </div>
              )}
              {hasAllergies && (
                <div className="text-xs bg-muted/40 p-2 rounded">
                  <span className="text-muted-foreground">Allergies (from profile): </span>
                  <span className="font-medium">{profile?.allergies}</span>{" "}
                  <Button
                    variant="link"
                    type="button"
                    className="h-auto p-0 text-xs"
                    onClick={() => navigate("/profile")}
                  >
                    Edit in Profile
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Medical History */}
          <Card className="medical-card animate-fade-in" style={{ animationDelay: "60ms" }}>
            <CardHeader>
              <CardTitle>Medical History</CardTitle>
              <CardDescription>Background information</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="currentMedications">Current Medications</Label>
                <Textarea
                  id="currentMedications"
                  placeholder="List current meds"
                  value={formData.currentMedications}
                  onChange={(e) => handleChange("currentMedications", e.target.value)}
                  rows={2}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="previousMedications">Previous Medications</Label>
                <Textarea
                  id="previousMedications"
                  placeholder="List previous meds"
                  value={formData.previousMedications}
                  onChange={(e) => handleChange("previousMedications", e.target.value)}
                  rows={2}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="familyHistory">Family History</Label>
                <Textarea
                  id="familyHistory"
                  placeholder="Relevant family skin conditions?"
                  value={formData.familyHistory}
                  onChange={(e) => handleChange("familyHistory", e.target.value)}
                  rows={2}
                />
              </div>
            </CardContent>
          </Card>

          {/* Duration & Lifestyle */}
            <Card className="medical-card animate-fade-in" style={{ animationDelay: "120ms" }}>
              <CardHeader>
                <CardTitle>Duration & Lifestyle</CardTitle>
                <CardDescription>Contextual modifiers</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="symptomDuration">Symptom Duration</Label>
                    <Input
                      id="symptomDuration"
                      type="number"
                      min={0}
                      placeholder="e.g. 3"
                      value={formData.symptomDuration}
                      onChange={(e) => handleChange("symptomDuration", e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="durationUnit">Unit</Label>
                    <Select
                      value={formData.durationUnit}
                      onValueChange={(v) => handleChange("durationUnit", v as FormData["durationUnit"])}
                    >
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
                  <RadioGroup
                    value={formData.smoking}
                    onValueChange={(v) => handleChange("smoking", v as Smoking)}
                  >
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
                  <RadioGroup
                    value={formData.alcohol}
                    onValueChange={(v) => handleChange("alcohol", v as Alcohol)}
                  >
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
                    placeholder="Brief description"
                    value={formData.diet}
                    onChange={(e) => handleChange("diet", e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="occupation">Occupation</Label>
                  <Input
                    id="occupation"
                    placeholder="If relevant to skin exposure"
                    value={formData.occupation}
                    onChange={(e) => handleChange("occupation", e.target.value)}
                  />
                </div>
              </CardContent>
            </Card>

          <div className="flex gap-4 animate-fade-in" style={{ animationDelay: "180ms" }}>
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate("/upload")}
              className="flex-1"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="flex-1 bg-accent hover:bg-accent/90"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Submitting...
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