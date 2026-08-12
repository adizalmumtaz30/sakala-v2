// Config layer terpusat — SATU-SATUNYA tempat membaca process.env di seluruh aplikasi.
// Kontrak Bagian 4.3: jangan hardcode API URL, database URL, timeout, feature flag, dst
// di file lain. Import dari sini.

function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(
      `[config] Environment variable "${name}" wajib diisi. Cek file .env.local kamu (lihat .env.example).`
    );
  }
  return value;
}

export const env = {
  environment: (process.env.NEXT_PUBLIC_APP_ENV ?? "development") as
    | "development"
    | "test"
    | "staging"
    | "production",

  supabase: {
    url: required("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL),
    publishableKey: required(
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    ),
    // Hanya dipakai di server (route handler / server action), TIDAK PERNAH di-expose ke client.
    secretKey: process.env.SUPABASE_SECRET_KEY,
  },

  app: {
    name: "SAKALA V2 Enterprise",
    // batas upload import (Bagian 37) — terpusat, jangan hardcode di komponen import
    importMaxRows: Number(process.env.NEXT_PUBLIC_IMPORT_MAX_ROWS ?? 2000),
  },
} as const;

export const isProduction = env.environment === "production";
