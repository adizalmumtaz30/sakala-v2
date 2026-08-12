// Data Access layer — Supabase client untuk browser/Client Component.
// Pakai publishable key (bukan secret key). Aman ter-expose ke browser
// selama RLS aktif di semua tabel (lihat database/schema.sql).

import { createBrowserClient } from "@supabase/ssr";
import { env } from "@/lib/config/env";

export function createClient() {
  return createBrowserClient(env.supabase.url, env.supabase.publishableKey);
}
