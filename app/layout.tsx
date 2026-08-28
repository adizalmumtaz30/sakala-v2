import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import "./theme.css";
import "./new-sakala-v2.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", weight: ["400", "500", "600", "700"] });

export const metadata: Metadata = {
  title: "SAKALA V2 Enterprise",
  description: "Platform manajemen jadwal sekolah",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(()=>{try{const t=localStorage.getItem('sakala-theme');const d=t==='dark'||(!t&&window.matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.toggle('dark',d)}catch(e){}})()`,
          }}
        />
      </head>
      <body className={`${inter.variable} font-sans antialiased text-ink-900`}>
        <a className="skip-link" href="#main-content">Lewati ke konten utama</a>
        <div id="main-content">{children}</div>
      </body>
    </html>
  );
}
