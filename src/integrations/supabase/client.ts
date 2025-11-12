import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

/**
 * Safely read env vars with trimming.
 */
function getEnv(name: string): string | undefined {
  const raw = import.meta.env[name as keyof ImportMetaEnv] as string | undefined;
  if (!raw) return undefined;
  const trimmed = raw.trim();
  return trimmed.length ? trimmed : undefined;
}

const SUPABASE_URL = getEnv("VITE_SUPABASE_URL");
const ANON_KEY = getEnv("VITE_SUPABASE_ANON_KEY");
const FALLBACK_PUBLISHABLE = getEnv("VITE_SUPABASE_PUBLISHABLE_KEY"); // optional
const PROJECT_REF = getEnv("VITE_SUPABASE_PROJECT_ID");

const SUPABASE_KEY = ANON_KEY || FALLBACK_PUBLISHABLE;

/**
 * Validate URL shape and extract the project ref from the hostname.
 * Expected: https://<ref>.supabase.co
 */
function validateUrl(url?: string) {
  if (!url) {
    throw new Error(
      "Missing VITE_SUPABASE_URL. Expected: https://<project-ref>.supabase.co"
    );
  }
  try {
    const u = new URL(url);
    if (!u.hostname.endsWith(".supabase.co")) {
      throw new Error(`Host must end with .supabase.co (got: ${u.hostname})`);
    }
    const ref = u.hostname.split(".")[0];
    return ref;
  } catch (e: any) {
    throw new Error(`Invalid VITE_SUPABASE_URL "${url}": ${e.message}`);
  }
}

/**
 * Optional: warn if anon key belongs to a different project than the URL.
 * Supabase anon keys contain the project ref in the JWT payload under "ref".
 */
function verifyKeyProjectRef(key?: string, expectedRef?: string) {
  if (!key) {
    throw new Error(
      "Missing Supabase anon key. Set VITE_SUPABASE_ANON_KEY (or VITE_SUPABASE_PUBLISHABLE_KEY)."
    );
  }
  if (!expectedRef) return;

  const parts = key.split(".");
  if (parts.length < 3) {
    console.warn("Supabase key appears malformed (not a JWT).");
    return;
  }
  try {
    const payloadJson = JSON.parse(
      atob(parts[1].replace(/-/g, "+").replace(/_/g, "/"))
    );
    const refInKey = payloadJson?.ref;
    if (refInKey && refInKey !== expectedRef) {
      console.warn(
        `Supabase project ref mismatch: URL ref "${expectedRef}" vs key ref "${refInKey}". ` +
          "Use the anon key from the SAME project as VITE_SUPABASE_URL."
      );
    }
  } catch {
    console.warn("Could not decode Supabase key payload to validate project ref.");
  }
}

const refFromUrl = validateUrl(SUPABASE_URL);
if (PROJECT_REF && refFromUrl && PROJECT_REF !== refFromUrl) {
  console.warn(
    `VITE_SUPABASE_PROJECT_ID "${PROJECT_REF}" differs from URL ref "${refFromUrl}". ` +
      "Update .env so both match."
  );
}
verifyKeyProjectRef(SUPABASE_KEY, refFromUrl);

// Use browser storage when available
const storage =
  typeof window !== "undefined" && window?.localStorage
    ? window.localStorage
    : undefined;

export const supabase = createClient<Database>(SUPABASE_URL!, SUPABASE_KEY!, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    storage,
  },
  db: {
    schema: "public",
  },
});