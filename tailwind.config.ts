import type { Config } from "tailwindcss";

/**
 * Design tokens mirror the Comp AI CRM dark theme:
 *  background #0f0f0f, card #171717, secondary/muted #1f1f1f, accent #292929,
 *  border #2a2a2a, muted-foreground #a0a0a0, primary #006b4f, ring #40be96,
 *  5px base radius, Geist type.
 *
 * The `zinc` scale is remapped to those neutrals so every existing zinc-*
 * utility in the app picks up the new palette without touching each file.
 */
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
        sans: ["var(--font-geist-sans)", "Geist", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["var(--font-geist-mono)", "Geist Mono", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      colors: {
        black: "#0f0f0f",
        background: "#0f0f0f",
        foreground: "#f5f5f5",
        card: { DEFAULT: "#171717", foreground: "#f5f5f5" },
        popover: { DEFAULT: "#171717", foreground: "#f5f5f5" },
        primary: { DEFAULT: "#006b4f", foreground: "#ffffff", hover: "#00805e" },
        secondary: { DEFAULT: "#1f1f1f", foreground: "#f5f5f5" },
        muted: { DEFAULT: "#1f1f1f", foreground: "#a0a0a0" },
        accent: { DEFAULT: "#292929", foreground: "#f5f5f5" },
        destructive: { DEFAULT: "#ae2e24", foreground: "#ffffff" },
        border: "#2a2a2a",
        input: "#2a2a2a",
        ring: "#40be96",
        sidebar: {
          DEFAULT: "#171717",
          foreground: "#f5f5f5",
          accent: "#292929",
          border: "#2a2a2a",
        },
        zinc: {
          50: "#fafafa",
          100: "#f5f5f5",
          200: "#e3e3e3",
          300: "#c9c9c9",
          400: "#a0a0a0",
          500: "#7a7a7a",
          600: "#5a5a5a",
          700: "#3a3a3a",
          800: "#2a2a2a",
          900: "#1f1f1f",
          950: "#171717",
        },
      },
      borderRadius: {
        sm: "4px",
        DEFAULT: "5px",
        md: "5px",
        lg: "6px",
        xl: "8px",
        "2xl": "12px",
      },
      boxShadow: {
        // Reference theme uses hairline shadows, not glows.
        glow: "0 1px 2px 0 rgba(0, 0, 0, 0.06)",
        "glow-lg": "0 4px 8px -2px rgba(0, 0, 0, 0.08)",
        card: "0 1px 2px 0 rgba(0, 0, 0, 0.06)",
      },
    },
  },
  plugins: [],
};

export default config;
