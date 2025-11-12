import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  User,
  Mail,
  Calendar,
  Save,
  Loader2,
  UploadCloud,
  Trash2,
} from "lucide-react";
import AppLayout from "@/components/AppLayout";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle } from "lucide-react";

type Sex = "Male" | "Female" | "Other" | "Prefer not to say";

type ProfileRow = {
  id: string;
  email?: string | null;
  full_name?: string | null;
  age?: number | null;
  sex?: Sex | null;
  phone?: string | null;
  skin_type?: "normal" | "dry" | "oily" | "combination" | "sensitive" | null;
  allergies?: string | null;
  notes?: string | null;
  avatar_url?: string | null;
  created_at?: string;
  updated_at?: string;
};

const DEFAULT_PROFILE: ProfileRow = {
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
};

const AVATAR_BUCKET = import.meta.env.VITE_SUPABASE_AVATAR_BUCKET || "avatars";
const withBuster = (url: string) => `${url}${url.includes("?") ? "&" : "?"}v=${Date.now()}`;

const Profile = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [userId, setUserId] = useState<string>("");
  const [userEmail, setUserEmail] = useState("");
  const [joinedDate, setJoinedDate] = useState("");

  const [profile, setProfile] = useState<ProfileRow>(DEFAULT_PROFILE);

  useEffect(() => {
    const init = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth");
        return;
      }

      setUserId(session.user.id);
      setUserEmail(session.user.email || "");
      setJoinedDate(new Date(session.user.created_at).toLocaleDateString());

      await ensureProfileRow(session.user.id, session.user.email || "");
      await loadProfile(session.user.id);
      setLoading(false);
    };

    init();
  }, [navigate]);

  const ensureProfileRow = async (id: string, email: string) => {
    try {
      const sb: any = supabase;
      const { data, error } = await sb
        .from("profiles")
        .select("id")
        .eq("id", id)
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        const { error: insErr } = await sb
          .from("profiles")
          .insert({
            id,
            email,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });
        if (insErr) throw insErr;
      }
    } catch (e: any) {
      console.error("ensureProfileRow failed:", e);
    }
  };

  const loadProfile = async (id: string) => {
    try {
      const sb: any = supabase;
      const { data, error } = await sb
        .from("profiles")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;

      if (!data) {
        setProfile({ ...DEFAULT_PROFILE, id, email: userEmail });
      } else {
        const storedUrl: string | null = data.avatar_url ?? "";
        const displayUrl = storedUrl ? withBuster(storedUrl) : "";
        setProfile({
          id: data.id,
          email: data.email ?? userEmail,
          full_name: data.full_name ?? "",
          age: data.age ?? undefined,
          sex: data.sex ?? undefined,
          phone: data.phone ?? "",
          skin_type: data.skin_type ?? undefined,
          allergies: data.allergies ?? "",
          notes: data.notes ?? "",
          avatar_url: displayUrl,
          created_at: data.created_at,
          updated_at: data.updated_at,
        });

        if (displayUrl) {
          localStorage.setItem("avatar_url", displayUrl);
          window.dispatchEvent(new CustomEvent("avatar:changed", { detail: displayUrl }));
        }
      }
    } catch (err: any) {
      console.error("Load profile failed:", err);
      toast.error("Failed to load profile");
      setProfile({ ...DEFAULT_PROFILE, id, email: userEmail });
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) return;
    setSaving(true);

    try {
      const sb: any = supabase;

      const ageNum =
        profile.age !== undefined && profile.age !== null && profile.age !== ("" as any)
          ? Number(profile.age)
          : null;
      if (ageNum !== null && (isNaN(ageNum) || ageNum < 1 || ageNum > 120)) {
        toast.error("Please enter a valid age (1–120).");
        setSaving(false);
        return;
      }

      const baseAvatarUrl = (profile.avatar_url || "").split("?")[0] || null;

      const payload = {
        id: userId,
        email: userEmail,
        full_name: (profile.full_name || "").trim() || null,
        age: ageNum,
        sex: profile.sex ?? null,
        phone: (profile.phone || "").trim() || null,
        skin_type: profile.skin_type ?? null,
        allergies: (profile.allergies || "").trim() || null,
        notes: (profile.notes || "").trim() || null,
        avatar_url: baseAvatarUrl,
        updated_at: new Date().toISOString(),
      };

      const { error } = await sb.from("profiles").upsert(payload).eq("id", userId);
      if (error) throw error;

      toast.success("Profile updated successfully!");
      await loadProfile(userId);
    } catch (err: any) {
      console.error("Save profile failed:", err);
      toast.error(err.message || "Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !userId) return;

    setUploading(true);
    try {
      await ensureProfileRow(userId, userEmail);

      const fileExt = file.name.split(".").pop();
      const filePath = `${userId}/avatar_${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from(AVATAR_BUCKET)
        .upload(filePath, file, { upsert: true, contentType: file.type });

      if (uploadError) {
        toast.error(uploadError.message || "Failed to upload photo");
        throw uploadError;
      }

      const { data: pub } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(filePath);
      const baseUrl = pub.publicUrl;

      const sb: any = supabase;
      const { error: upErr } = await sb
        .from("profiles")
        .upsert({
          id: userId,
          email: userEmail,
          avatar_url: baseUrl,
          updated_at: new Date().toISOString(),
        })
        .eq("id", userId);
      if (upErr) throw upErr;

      const displayUrl = withBuster(baseUrl);
      setProfile(p => ({ ...p, avatar_url: displayUrl }));
      localStorage.setItem("avatar_url", displayUrl);
      window.dispatchEvent(new CustomEvent("avatar:changed", { detail: displayUrl }));

      toast.success("Profile picture updated!");
    } catch (err: any) {
      console.error("Upload avatar failed:", err);
      toast.error(err?.message || "Failed to upload profile picture");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleAvatarRemove = async () => {
    if (!userId) return;
    setUploading(true);
    try {
      const sb: any = supabase;
      const { error } = await sb
        .from("profiles")
        .upsert({ id: userId, email: userEmail, avatar_url: null, updated_at: new Date().toISOString() })
        .eq("id", userId);
      if (error) throw error;

      setProfile(p => ({ ...p, avatar_url: "" }));
      localStorage.removeItem("avatar_url");
      window.dispatchEvent(new CustomEvent("avatar:changed", { detail: "" }));

      toast.success("Profile picture removed");
    } catch (err: any) {
      console.error("Remove avatar failed:", err);
      toast.error("Failed to remove profile picture");
    } finally {
      setUploading(false);
    }
  };

  async function deleteAccount() {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return navigate("/auth");
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/delete-account`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ confirm: true }),
      });
      if (!res.ok) {
        const msg = await res.text();
        throw new Error(msg || "Delete failed");
      }
      await supabase.auth.signOut();
      localStorage.removeItem("avatar_url");
      toast.success("Your account was deleted.");
      navigate("/", { replace: true });
    } catch (err: any) {
      console.error("Delete account failed:", err);
      toast.error(err.message || "Failed to delete account");
    }
  }

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-screen">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </AppLayout>
    );
  }

  const initials =
    (profile.full_name || userEmail || "U")
      .split(" ")
      .map(n => n[0])
      .join("")
      .toUpperCase();

  return (
    <AppLayout>
      <div className="medical-container py-8 max-w-5xl">
        <div className="mb-8 animate-fade-in">
          <h1 className="text-3xl font-bold mb-2">Profile Settings</h1>
          <p className="text-muted-foreground">
            Manage your account information and preferences
          </p>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          <Card className="medical-card animate-fade-in">
            <CardHeader>
              <CardTitle>Account</CardTitle>
              <CardDescription>Your DermaVision account</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-center space-y-4">
                <div className="relative">
                  <Avatar className="h-24 w-24 bg-primary/10">
                    {profile.avatar_url ? (
                      <AvatarImage key={profile.avatar_url} src={profile.avatar_url} alt="Profile" />
                    ) : null}
                    <AvatarFallback className="text-2xl font-bold text-primary">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    ref={fileInputRef}
                    onChange={handleAvatarUpload}
                  />
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                  >
                    {uploading ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Uploading...
                      </>
                    ) : (
                      <>
                        <UploadCloud className="h-4 w-4 mr-2" />
                        {profile.avatar_url ? "Change Photo" : "Upload Photo"}
                      </>
                    )}
                  </Button>
                  {profile.avatar_url ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleAvatarRemove}
                      disabled={uploading}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Remove
                    </Button>
                  ) : null}
                </div>

                <div className="text-center">
                  <p className="font-medium">{profile.full_name || "User"}</p>
                  <p className="text-sm text-muted-foreground">{userEmail}</p>
                </div>

                <div className="w-full space-y-2 text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    <span>Joined {joinedDate}</span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Mail className="h-4 w-4" />
                    <span>Email verified</span>
                  </div>
                </div>

                <div className="w-full border-t pt-4 space-y-2 text-sm">
                  {profile.phone ? (
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">Phone:</span>
                      <span className="font-medium">{profile.phone}</span>
                    </div>
                  ) : null}
                  {profile.skin_type ? (
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">Skin type:</span>
                      <span className="font-medium capitalize">{profile.skin_type}</span>
                    </div>
                  ) : null}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card
            className="medical-card lg:col-span-2 animate-fade-in"
            style={{ animationDelay: "100ms" }}
          >
            <CardHeader>
              <CardTitle>Personal Information</CardTitle>
              <CardDescription>Update your personal details</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSave} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="fullName">Full Name</Label>
                  <Input
                    id="fullName"
                    placeholder="Enter your full name"
                    value={profile.full_name || ""}
                    onChange={(e) =>
                      setProfile(p => ({ ...p, full_name: e.target.value }))
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <Input id="email" type="email" value={userEmail} disabled className="bg-muted" />
                  <p className="text-xs text-muted-foreground">Email cannot be changed</p>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="age">Age</Label>
                    <Input
                      id="age"
                      type="number"
                      min={1}
                      max={120}
                      placeholder="Your age"
                      value={profile.age ?? ""}
                      onChange={(e) =>
                        setProfile(p => ({
                          ...p,
                          age: e.target.value ? Number(e.target.value) : ("" as unknown as number),
                        }))
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="sex">Sex</Label>
                    <Select
                      value={profile.sex || ""}
                      onValueChange={(v) =>
                        setProfile(p => ({ ...p, sex: (v as Sex) || null }))
                      }
                    >
                      <SelectTrigger id="sex">
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

                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone Number</Label>
                    <Input
                      id="phone"
                      type="tel"
                      placeholder="+1 (555) 000-0000"
                      value={profile.phone || ""}
                      onChange={(e) =>
                        setProfile(p => ({ ...p, phone: e.target.value }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Skin Type</Label>
                    <Select
                      value={profile.skin_type || ""}
                      onValueChange={(v) =>
                        setProfile(p => ({ ...p, skin_type: (v as ProfileRow["skin_type"]) || null }))
                      }
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
                </div>

                <div className="space-y-2">
                  <Label htmlFor="allergies">Known Allergies</Label>
                  <Input
                    id="allergies"
                    placeholder="e.g., benzoyl peroxide, fragrances"
                    value={profile.allergies || ""}
                    onChange={(e) =>
                      setProfile(p => ({ ...p, allergies: e.target.value }))
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes">Notes for dermatologist (optional)</Label>
                  <Textarea
                    id="notes"
                    placeholder="Brief history, ongoing medication, photos taken frequency, etc."
                    rows={4}
                    value={profile.notes || ""}
                    onChange={(e) =>
                      setProfile(p => ({ ...p, notes: e.target.value }))
                    }
                  />
                </div>

                <Button
                  type="submit"
                  disabled={saving}
                  className="w-full bg-accent hover:bg-accent/90"
                >
                  {saving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      Save Changes
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

        <Card
          className="medical-card mt-6 border-destructive/50 animate-fade-in"
          style={{ animationDelay: "200ms" }}
        >
          <CardHeader>
            <CardTitle className="text-destructive">Danger Zone</CardTitle>
            <CardDescription>Irreversible actions</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Delete Account</p>
                <p className="text-sm text-muted-foreground">
                  Permanently delete your account and all associated data
                </p>
              </div>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive">Delete Account</Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete your account?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently delete your account, profile, and report history. This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={deleteAccount}>Delete</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>

            <Alert className="border-warning bg-warning/10">
              <AlertTriangle className="h-4 w-4 text-warning" />
              <AlertDescription className="text-xs">
                When deleted, your data cannot be recovered. You will be signed out automatically.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};

export default Profile;