import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-inter)", "Inter", "-apple-system", "Segoe UI", "sans-serif"],
      },
      colors: {
        canvas: "var(--color-canvas)",
        surface: "var(--color-surface)",
        "surface-muted": "var(--color-surface-muted)",
        border: {
          DEFAULT: "var(--color-border)",
          strong: "var(--color-border-strong)",
        },
        ink: {
          900: "var(--color-ink-900)",
          700: "var(--color-ink-700)",
          500: "var(--color-ink-500)",
          400: "var(--color-ink-400)",
          300: "var(--color-ink-300)",
        },
        brand: {
          DEFAULT: "var(--color-brand)",
          50: "var(--color-brand-50)",
          100: "var(--color-brand-100)",
          600: "var(--color-brand)",
          700: "var(--color-brand-700)",
        },
        cyan: { DEFAULT: "var(--color-cyan)", 50: "var(--color-cyan-50)" },
        amber: { DEFAULT: "var(--color-amber)", 50: "var(--color-amber-50)" },
        violet: { DEFAULT: "var(--color-violet)", 50: "var(--color-violet-50)" },
        emerald: { DEFAULT: "var(--color-emerald)", 50: "var(--color-emerald-50)" },
        rose: { DEFAULT: "var(--color-rose)", 50: "var(--color-rose-50)" },
      },
      borderRadius: {
        xl2: "18px",
        card: "16px",
        pill: "999px",
      },
      boxShadow: {
        soft: "var(--shadow-soft)",
        float: "var(--shadow-float)",
      },
    },
  },
  plugins: [],
};

export default config;
