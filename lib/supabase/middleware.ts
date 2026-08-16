// Data Access layer — helper session refresh untuk middleware.ts.
// Pola resmi @supabase/ssr: middleware WAJIB pakai getClaims()/getUser() (bukan
// getSession()) supaya token divalidasi ulang ke server Supabase, bukan cuma
// dibaca dari cookie mentah (cookie bisa dipalsukan di request).

import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/lib/config/env";

const PUBLIC_PATHS = ["/login"];

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(env.supabase.url, env.supabase.publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  // WAJIB dipanggil — ini yang men-trigger refresh token kalau sudah expired.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isPublicPath = PUBLIC_PATHS.some((p) => request.nextUrl.pathname.startsWith(p));

  // AUTH DINONAKTIFKAN SEMENTARA (permintaan eksplisit user) — gate redirect
  // ke /login di-skip supaya semua route bisa diakses tanpa login. Untuk
  // mengaktifkan lagi Bagian 40 (Authentication), un-comment blok di bawah.
  //
  // if (!user && !isPublicPath) {
  //   const url = request.nextUrl.clone();
  //   url.pathname = "/login";
  //   url.searchParams.set("next", request.nextUrl.pathname);
  //   return NextResponse.redirect(url);
  // }

  if (user && request.nextUrl.pathname === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}
