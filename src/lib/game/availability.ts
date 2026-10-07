import { isSupabaseConfigured } from "./supabase-store";

/**
 * Two-phone rooms need shared storage.
 * Supabase does that. A single `next dev` / `next start` process can also
 * keep an in-memory room. Vercel Hobby cannot: each request may be a new
 * instance, so a room created without Supabase disappears.
 */
export function multiplayerAvailable() {
  if (isSupabaseConfigured()) return true;
  return !process.env.VERCEL;
}
