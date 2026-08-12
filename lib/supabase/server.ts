// Data Access layer — Supabase client untuk Server Component / Route Handler / Server Action.
// Menggunakan cookies() Next.js supaya session ikut ter-refresh otomatis.

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { env } from "@/lib/config/env";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(env.supabase.url, env.supabase.publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // setAll dipanggil dari Server Component — boleh diabaikan
          // jika ada middleware yang me-refresh session.
        }
      },
    },
  });
}
