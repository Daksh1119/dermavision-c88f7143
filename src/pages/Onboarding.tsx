import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
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
import { Loader2, UploadCloud, Trash2 } from "lucide-react";

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

const AVATAR_BUCKET = "avatars";

export default function Onboarding() {
  const navigate = useNavigate();
  const location = useLocation();
  const redirectTo = new URLSearchParams(location.search).get("redirect") || "/upload";

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const [userId, setUserId] = useState("");
  const [email, setEmail] = useState("");

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
      setEmail(session.user.email || "");
      setForm(f => ({ ...f, id: session.user.id, email: session.user.email || "" }));

      // Cast supabase to any to avoid TS "never" errors when no generated DB types are present
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
    if (typeof form.age !== "number" || Number.isNaN(form.age) || form.age < 1 || form.age > 120) return "Enter valid age.";
    if (!form.phone || form.phone.trim().length < 6) return "Enter valid phone.";
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
      const payload = {
        id: userId,
        email: email || null, // satisfy NOT NULL if enforced; otherwise nullable is ok
        full_name: form.full_name?.trim() || null,
        age: form.age ?? null,
        sex: form.sex ?? null,
        phone: form.phone?.trim() || null,
        skin_type: form.skin_type ?? null,
        allergies: form.allergies?.trim() || null,
        notes: form.notes?.trim() || null,
        avatar_url: form.avatar_url || null,
        updated_at: new Date().toISOString(),
      };

      // Cast supabase to any to fix TS generic mismatch without generated types
      const sb: any = supabase;
      const { error } = await sb
        .from("profiles")
        .upsert(payload)
        .eq("id", userId);
      if (error) throw error;

      toast.success("Profile saved.");
      navigate(redirectTo, { replace: true });
    } catch (err: any) {
      toast.error(err.message || "Failed to save profile");
    } finally {
      setSaving(false);
    }
  }

  async function onAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !userId) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `${userId}/avatar_${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from(AVATAR_BUCKET)
        .upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) throw upErr;

      const {
        data: { publicUrl },
      } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path);

      setForm(f => ({ ...f, avatar_url: publicUrl }));
      toast.success("Photo uploaded.");
    } catch (err: any) {
      toast.error(err.message || "Failed to upload photo");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function removeAvatar() {
    setForm(f => ({ ...f, avatar_url: "" }));
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
            <CardDescription>Your email is {email}. You can edit these later in Profile Settings.</CardDescription>
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

              <div className="space-y-2">
                <Label>Profile Photo (optional)</Label>
                <div className="flex gap-2">
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={onAvatarUpload}
                  />
                  <Button type="button" variant="outline" onClick={() => fileRef.current?.click()} disabled={uploading}>
                    {uploading ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Uploading...
                      </>
                    ) : (
                      <>
                        <UploadCloud className="h-4 w-4 mr-2" />
                        Upload Photo
                      </>
                    )}
                  </Button>
                  {form.avatar_url ? (
                    <Button type="button" variant="ghost" onClick={removeAvatar} disabled={uploading}>
                      <Trash2 className="h-4 w-4 mr-2" />
                      Remove
                    </Button>
                  ) : null}
                </div>
                {form.avatar_url && (
                  <div className="text-xs text-muted-foreground break-all">
                    Saved URL: {form.avatar_url}
                  </div>
                )}
              </div>

              <Button
                type="submit"
                className="w-full bg-accent hover:bg-accent/90"
                disabled={saving}
              >
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save & Continue"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}