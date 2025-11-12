import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

type ProfileRow = {
  id: string;
  full_name?: string | null;
  age?: number | null;
  phone?: string | null;
  sex?: "Male" | "Female" | "Other" | "Prefer not to say" | null;
  skin_type?: "normal" | "dry" | "oily" | "combination" | "sensitive" | null;
  allergies?: string | null;
  notes?: string | null;
  avatar_url?: string | null;
};

// UPDATED completeness: require sex; skin_type optional
function isProfileComplete(p: ProfileRow | null | undefined) {
  if (!p) return false;
  const hasName = !!(p.full_name && p.full_name.trim().length >= 2);
  const hasAge = typeof p.age === "number" && p.age >= 1 && p.age <= 120;
  const hasPhone = !!(p.phone && p.phone.trim().length >= 6);
  const hasSex = !!p.sex;
  return hasName && hasAge && hasPhone && hasSex;
}

/**
 * Wrap protected routes with <ProfileGuard><YourComponent/></ProfileGuard>
 * If user is unauthenticated -> redirect to /auth
 * If user is authenticated but profile incomplete -> redirect to /onboarding?redirect=<original-path>
 */
export default function ProfileGuard({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [sessionOK, setSessionOK] = useState(false);
  const [complete, setComplete] = useState(false);

  useEffect(() => {
    const run = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setSessionOK(false);
        setLoading(false);
        return;
      }
      setSessionOK(true);

      const sb: any = supabase;
      const { data, error } = await sb
        .from("profiles")
        .select("*")
        .eq("id", session.user.id)
        .maybeSingle();

      if (error) {
        setComplete(false);
        setLoading(false);
        return;
      }

      setComplete(isProfileComplete(data as ProfileRow));
      setLoading(false);
    };
    run();
  }, [location.pathname]);

  if (loading) return null;

  if (!sessionOK) {
    return <Navigate to="/auth" replace />;
  }

  if (!complete) {
    const redirect = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/onboarding?redirect=${redirect}`} replace />;
  }

  return <>{children}</>;
}