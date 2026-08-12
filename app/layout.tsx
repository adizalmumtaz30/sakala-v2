import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Sidebar from "@/components/layout/Sidebar";
import Header from "@/components/layout/Header";
import CommandPalette from "@/components/layout/CommandPalette";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", weight: ["400", "500", "600", "700"] });

export const metadata: Metadata = {
  title: "SAKALA V2 Enterprise",
  description: "Platform manajemen jadwal sekolah",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body className={`${inter.variable} font-sans antialiased text-ink-900`}>
        <div className="flex min-h-screen">
          <Sidebar />
          <div className="flex-1 flex flex-col" style={{ marginLeft: "var(--shell-sidebar-w)" }}>
            <Header />
            <main className="flex-1 px-8 pb-16 pt-6">{children}</main>
          </div>
        </div>
        <CommandPalette />
      </body>
    </html>
  );
}
