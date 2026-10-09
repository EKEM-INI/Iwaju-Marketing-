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
      colors: {
        background: "#000000",
        surface: {
          50: "#18181b",
          100: "#121215",
          200: "#0d0d10",
          300: "#09090b",
          400: "#050507",
        },
        border: "#27272a",
        muted: "#71717a",
      },
      boxShadow: {
        glow: "0 0 20px -5px rgba(255, 255, 255, 0.08)",
        "glow-lg": "0 0 35px -8px rgba(255, 255, 255, 0.12)",
        card: "0 10px 30px -10px rgba(0, 0, 0, 0.8)",
      },
    },
  },
  plugins: [],
};

export default config;
