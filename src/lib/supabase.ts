import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(url && key);

let client: SupabaseClient | null = null;

/** Nur im Browser aufrufen (Effekte, Event-Handler). */
export function getSupabase(): SupabaseClient {
  if (!url || !key) throw new Error("Supabase ist nicht konfiguriert");
  client ??= createClient(url, key, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
      storageKey: "dsb-auth",
    },
  });
  // Nur in der Entwicklung: fuer Abbruch-Tests im Browser (window.__dsb.realtime.disconnect()).
  if (process.env.NODE_ENV !== "production" && typeof window !== "undefined") {
    (window as unknown as { __dsb?: SupabaseClient }).__dsb = client;
  }
  return client;
}
