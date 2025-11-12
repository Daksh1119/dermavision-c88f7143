import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import AppLayout from "@/components/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type SkinType = "normal" | "dry" | "oily" | "combination" | "sensitive";
type Sex = "Male" | "Female" | "Other" | "Prefer not to say";

interface ProfileRow {
  id: string;
  email?: string | null;
  full_name?: string | null;
  age?: number | null;
  sex?: Sex | null;
  phone?: string | null;
  skin_type?: SkinType | null;
  allergies?: string | null;
  notes?: string | null;
  avatar_url?: string | null;
}

export default function Onboarding() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const redirectTo = useMemo(() => params.get("redirect") || "/upload", [params]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [userId, setUserId] = useState("");
  const [userEmail, setUserEmail] = useState("");

  const [form, setForm] = useState<ProfileRow>({
    id: "",
    email: "",
    full_name: "",
    age: undefined,
    sex: undefined,
    phone: "",
    skin_type: undefined,
    allergies: "",
    notes: "",
    avatar_url: "",
  });

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { navigate("/auth"); return; }
      setUserId(session.user.id);
      setUserEmail(session.user.email || "");
      setForm(f => ({ ...f, id: session.user.id, email: session.user.email || "" }));

      const sb: any = supabase;
      const { data, error } = await sb
        .from("profiles")
        .select("*")
        .eq("id", session.user.id)
        .maybeSingle();

      if (!error && data) {
        const p = data as ProfileRow;
        if (isComplete(p)) {
          navigate(redirectTo, { replace: true });
          return;
        }
        setForm({
          id: p.id,
          email: p.email || session.user.email || "",
          full_name: p.full_name ?? "",
          age: p.age ?? undefined,
          sex: p.sex ?? undefined,
          phone: p.phone ?? "",
          skin_type: p.skin_type ?? undefined,
          allergies: p.allergies ?? "",
          notes: p.notes ?? "",
          avatar_url: p.avatar_url ?? "",
        });
      }
      setLoading(false);
    })();
  }, [navigate, redirectTo]);

  function isComplete(p: ProfileRow) {
    const hasName = !!(p.full_name && p.full_name.trim().length >= 2);
    const hasAge = typeof p.age === "number" && p.age >= 1 && p.age <= 120;
    const hasPhone = !!(p.phone && p.phone.trim().length >= 6);
    const hasSkin = !!p.skin_type;
    return hasName && hasAge && hasPhone && hasSkin;
  }

  function validate(): string | null {
    if (!form.full_name || form.full_name.trim().length < 2) return "Enter full name.";
    if (typeof form.age !== "number" || Number.isNaN(form.age) || form.age < 1 || form.age > 120) return "Enter a valid age.";
    if (!form.phone || form.phone.trim().length < 6) return "Enter a valid phone.";
    if (!form.skin_type) return "Select skin type.";
    return null;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!userId) return;
    const msg = validate();
    if (msg) { toast.error(msg); return; }
    setSaving(true);
    try {
      const payload: ProfileRow = {
        id: userId,
        // FIX: persist email reliably (use session email if missing in form)
        email: form.email || userEmail || null,
        full_name: form.full_name?.trim() || null,
        age: form.age ?? null,
        sex: form.sex ?? null,
        phone: form.phone?.trim() || null,
        skin_type: form.skin_type ?? null,
        allergies: form.allergies?.trim() || null,
        notes: form.notes?.trim() || null,
        avatar_url: form.avatar_url || null,
      };

      const sb: any = supabase;
      const { error } = await sb
        .from("profiles")
        .upsert(payload, { onConflict: "id" });
      if (error) throw error;

      toast.success("Profile saved.");
      navigate(redirectTo, { replace: true });
    } catch (err: any) {
      toast.error(err.message || "Failed to save profile");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-screen">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="medical-container py-10 max-w-3xl">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">Welcome! Let’s complete your profile</h1>
          <p className="text-muted-foreground">These details are required for a comprehensive medical-style report.</p>
        </div>

        <Card className="medical-card">
          <CardHeader>
            <CardTitle>Required details</CardTitle>
            <CardDescription>Your email is {userEmail}. You can edit these later in Profile Settings.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={onSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label>Full Name *</Label>
                <Input
                  value={form.full_name || ""}
                  onChange={(e) => setForm(f => ({ ...f, full_name: e.target.value }))}
                  required
                />
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Age *</Label>
                  <Input
                    type="number"
                    min={1}
                    max={120}
                    value={form.age ?? ""}
                    onChange={(e) => setForm(f => ({ ...f, age: e.target.value ? Number(e.target.value) : undefined }))}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Phone *</Label>
                  <Input
                    type="tel"
                    value={form.phone || ""}
                    onChange={(e) => setForm(f => ({ ...f, phone: e.target.value }))}
                    required
                  />
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Skin Type *</Label>
                  <Select
                    value={form.skin_type || ""}
                    onValueChange={(v) => setForm(f => ({ ...f, skin_type: v as SkinType }))}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select skin type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="normal">Normal</SelectItem>
                      <SelectItem value="dry">Dry</SelectItem>
                      <SelectItem value="oily">Oily</SelectItem>
                      <SelectItem value="combination">Combination</SelectItem>
                      <SelectItem value="sensitive">Sensitive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Sex (optional)</Label>
                  <Select
                    value={form.sex || ""}
                    onValueChange={(v) => setForm(f => ({ ...f, sex: v as Sex }))}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Male">Male</SelectItem>
                      <SelectItem value="Female">Female</SelectItem>
                      <SelectItem value="Other">Other</SelectItem>
                      <SelectItem value="Prefer not to say">Prefer not to say</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Known Allergies (optional)</Label>
                <Input
                  value={form.allergies || ""}
                  onChange={(e) => setForm(f => ({ ...f, allergies: e.target.value }))}
                  placeholder="e.g. benzoyl peroxide, fragrance"
                />
              </div>

              <div className="space-y-2">
                <Label>Notes for dermatologist (optional)</Label>
                <Textarea
                  rows={3}
                  value={form.notes || ""}
                  onChange={(e) => setForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="History, ongoing meds, etc."
                />
              </div>

              <Button
                type="submit"
                className="w-full bg-accent hover:bg-accent/90"
                disabled={saving}
              >
                {saving ? "Saving…" : "Save & Continue"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}