import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // NeiroAI monochrome system (spec PART 1 — COLOR SYSTEM)
        primary: "#000000",
        secondary: "#1A1A1A",
        tertiary: "#2A2A2A",
        "text-primary": "#FFFFFF",
        "text-secondary": "#BFBFBF",
        "text-muted": "#7A7A7A",
        border: "#333333",
        hover: "#3A3A3A",
      },
      fontFamily: {
        sans: ["Inter", "Geist", "SF Pro", "Segoe UI", "system-ui", "sans-serif"],
        mono: ["Geist Mono", "JetBrains Mono", "SF Mono", "Menlo", "monospace"],
      },
      maxWidth: {
        chat: "52rem",
      },
      keyframes: {
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        "slide-up": {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        "pulse-dot": {
          "0%, 100%": { opacity: "0.3", transform: "scale(0.8)" },
          "50%": { opacity: "1", transform: "scale(1)" },
        },
      },
      animation: {
        "fade-in": "fade-in 0.3s ease both",
        "slide-up": "slide-up 0.25s ease both",
        shimmer: "shimmer 1.6s linear infinite",
        "pulse-dot": "pulse-dot 1.2s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
