import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Helvetica", "Helvetica Neue", "Prompt", "sans-serif"],
        heading: ["Helvetica", "Helvetica Neue", "Prompt", "sans-serif"],
      },
      colors: {
        // Fresh palette
        lime: {
          50:  "#f7fee7",
          100: "#ecfccb",
          200: "#d9f99d",
          300: "#bef264",
          400: "#a3e635",
          500: "#84cc16",
          600: "#65a30d",
          700: "#4d7c0f",
          800: "#3f6212",
          900: "#365314",
        },
        orange: {
          50:  "#fff7ed",
          100: "#ffedd5",
          200: "#fed7aa",
          300: "#fdba74",
          400: "#fb923c",
          500: "#f97316",
          600: "#ea580c",
          700: "#c2410c",
          800: "#9a3412",
        },
        mint: {
          50:  "#ecfdf5",
          100: "#d1fae5",
          200: "#a7f3d0",
          300: "#6ee7b7",
          400: "#34d399",
          500: "#10b981",
          600: "#059669",
        },
        yellow: {
          300: "#fde047",
          400: "#facc15",
          500: "#eab308",
        },
        ink: {
          DEFAULT: "#0F1923",
          soft:    "#1E293B",
          muted:   "#475569",
        },
        // Semantic (kept for API/badge compatibility)
        success: { DEFAULT: "#84cc16", dark: "#65a30d", lighter: "#ecfccb" },
        warning: { DEFAULT: "#f97316", dark: "#ea580c", lighter: "#ffedd5" },
        error:   { DEFAULT: "#ef4444", dark: "#dc2626", lighter: "#fee2e2" },
        info:    { DEFAULT: "#06b6d4", dark: "#0891b2", lighter: "#cffafe" },
      },
      borderRadius: {
        sm:    "6px",
        DEFAULT: "12px",
        md:    "16px",
        lg:    "20px",
        xl:    "24px",
        "2xl": "32px",
        full:  "9999px",
      },
      boxShadow: {
        card:      "0 2px 16px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)",
        "card-lg": "0 8px 40px rgba(0,0,0,0.10), 0 2px 8px rgba(0,0,0,0.06)",
        lime:      "0 8px 24px rgba(132,204,22,0.30)",
        orange:    "0 8px 24px rgba(249,115,22,0.30)",
        glow:      "0 0 0 3px rgba(132,204,22,0.25)",
      },
      backgroundImage: {
        "gradient-fresh":
          "linear-gradient(135deg, #d1fae5 0%, #f0fdf4 35%, #f7fee7 65%, #fefce8 100%)",
        "gradient-dark":
          "linear-gradient(135deg, #0d1117 0%, #111827 100%)",
        "gradient-lime":
          "linear-gradient(135deg, #a3e635 0%, #84cc16 100%)",
        "gradient-orange":
          "linear-gradient(135deg, #fb923c 0%, #f97316 100%)",
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.3s ease-out",
      },
    },
  },
  plugins: [],
};
export default config;
