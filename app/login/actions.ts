"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export interface LoginState {
  error?: string;
}

// Bagian 40: login/session/logout. Validasi minimal di sini (email/password
// wajib diisi) — validasi kredensial sesungguhnya dilakukan Supabase Auth.
// Pesan error SENGAJA digeneralisasi (bukan "email tidak ditemukan" vs
// "password salah" terpisah) — Bagian 95 "sanitized errors", supaya tidak
// bocorkan email mana yang terdaftar (user enumeration).
export async function login(_prevState: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "/");

  if (!email || !password) {
    return { error: "Email dan password wajib diisi." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: "Email atau password salah." };
  }

  redirect(next.startsWith("/") ? next : "/");
}

export async function logout(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
