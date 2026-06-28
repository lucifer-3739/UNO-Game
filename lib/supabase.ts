import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

// Graceful check to avoid crashing if env variables are not set yet, are placeholder strings, or use a secret key
const isSecretKey = supabaseAnonKey.includes("secret") || supabaseAnonKey.includes("service_role");

if (isSecretKey && typeof window !== "undefined") {
  console.warn(
    "⚠️ UNO Warning: NEXT_PUBLIC_SUPABASE_ANON_KEY appears to be a secret key (service_role). " +
    "Please use the public 'anon' 'public' key in your .env configuration instead to avoid browser security restrictions. " +
    "Falling back to local simulation mode."
  );
}

export const hasSupabase = Boolean(
  supabaseUrl &&
  supabaseAnonKey &&
  !isSecretKey &&
  (supabaseUrl.startsWith("http://") || supabaseUrl.startsWith("https://"))
);

export const supabase = hasSupabase
  ? createClient(supabaseUrl, supabaseAnonKey)
  : (null as any);

/**
 * Ensures the user has an active session (anonymous sign-in).
 * Returns the user's ID and auth token/details.
 */
export async function getOrCreateSession(): Promise<{ userId: string; username: string | null } | null> {
  if (!hasSupabase) {
    // Generate a temporary local session if Supabase is not connected
    if (typeof window !== "undefined") {
      let localId = localStorage.getItem("uno_local_user_id");
      let localUsername = localStorage.getItem("uno_local_username");
      if (!localId) {
        localId = `local-${crypto.randomUUID()}`;
        localStorage.setItem("uno_local_user_id", localId);
      }
      return { userId: localId, username: localUsername };
    }
    return null;
  }

  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      return {
        userId: session.user.id,
        username: session.user.user_metadata?.username || localStorage.getItem("uno_local_username") || null,
      };
    }

    // Sign in anonymously
    const { data, error } = await supabase.auth.signInAnonymously();
    if (error) {
      console.warn("Supabase anonymous sign-in is disabled or failed. Using local storage session:", error.message);
    } else if (data.user) {
      return {
        userId: data.user.id,
        username: data.user.user_metadata?.username || null,
      };
    }
  } catch (err: any) {
    console.warn("Failed to authenticate with Supabase anonymously, using local session fallback:", err?.message || err);
  }

  // Fallback to local storage
  if (typeof window !== "undefined") {
    let localId = localStorage.getItem("uno_local_user_id");
    let localUsername = localStorage.getItem("uno_local_username");
    if (!localId) {
      localId = `local-${crypto.randomUUID()}`;
      localStorage.setItem("uno_local_user_id", localId);
    }
    return { userId: localId, username: localUsername };
  }

  return null;
}
