import type { Config } from "tailwindcss";

const config: Config = {
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
        canvas: "#F6F7FA",
        surface: "#FFFFFF",
        "surface-muted": "#FAFBFC",
        border: {
          DEFAULT: "#E8EAEF",
          strong: "#DBDEE6",
        },
        ink: {
          900: "#12141A",
          700: "#3A3D46",
          500: "#6B7080",
          400: "#8B909E",
          300: "#AEB3C0",
        },
        brand: {
          DEFAULT: "#2F6FED",
          50: "#EEF3FF",
          100: "#DDE9FF",
          600: "#2F6FED",
          700: "#1E56D6",
        },
        cyan: { DEFAULT: "#31B7F6", 50: "#EAF9FF" },
        amber: { DEFAULT: "#F6A623", 50: "#FFF6E8" },
        violet: { DEFAULT: "#7C6FF0", 50: "#F1EFFF" },
        emerald: { DEFAULT: "#22B07D", 50: "#E9FBF3" },
        rose: { DEFAULT: "#F0483E", 50: "#FFEFEE" },
      },
      borderRadius: {
        xl2: "18px",
        card: "16px",
        pill: "999px",
      },
      boxShadow: {
        soft: "0 1px 2px rgba(18,20,26,0.04), 0 8px 24px -12px rgba(18,20,26,0.08)",
        float: "0 12px 32px -8px rgba(18,20,26,0.16)",
      },
    },
  },
  plugins: [],
};

export default config;
