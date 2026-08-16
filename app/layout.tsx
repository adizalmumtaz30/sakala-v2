import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", weight: ["400", "500", "600", "700"] });

export const metadata: Metadata = {
  title: "SAKALA V2 Enterprise",
  description: "Platform manajemen jadwal sekolah",
};

// Root layout MINIMAL — cuma html/body/font. Shell (Sidebar/Header/
// CommandPalette) ada di app/(shell)/layout.tsx supaya /login bisa tampil
// tanpa shell (route group tidak mempengaruhi URL, /guru tetap /guru).
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body className={`${inter.variable} font-sans antialiased text-ink-900`}>{children}</body>
    </html>
  );
}
