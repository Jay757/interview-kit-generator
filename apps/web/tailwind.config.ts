import type { Config } from "tailwindcss";
import tailwindAnimate from "tailwindcss-animate";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        canvas: {
          base: "#08090d",
          surface: "#10131d",
          card: "#151824",
          subtle: "#1c2030",
          muted: "#24293d",
          border: "#2b3147",
          hover: "#222738",
        },
        light: {
          base: "#f8fafc",
          surface: "#ffffff",
          card: "#ffffff",
          subtle: "#f1f5f9",
          muted: "#e2e8f0",
          border: "#cbd5e1",
          hover: "#f1f5f9",
        },
        accent: {
          amber: "#f59e0b",
          amberMuted: "rgba(245, 158, 11, 0.12)",
          indigo: "#6366f1",
          indigoMuted: "rgba(99, 102, 241, 0.12)",
          emerald: "#10b981",
          emeraldMuted: "rgba(16, 185, 129, 0.12)",
          rose: "#f43f5e",
          roseMuted: "rgba(244, 63, 94, 0.12)",
          cyan: "#06b6d4",
          cyanMuted: "rgba(6, 182, 212, 0.12)",
          purple: "#a855f7",
          purpleMuted: "rgba(168, 85, 247, 0.12)",
        },
      },
      fontFamily: {
        mono: [
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "Monaco",
          "Consolas",
          "Liberation Mono",
          "Courier New",
          "monospace",
        ],
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Roboto",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
      },
      boxShadow: {
        hairline: "0 0 0 1px rgba(255, 255, 255, 0.08)",
        card: "0 8px 32px -4px rgba(0, 0, 0, 0.45)",
        glow: "0 0 35px -5px rgba(99, 102, 241, 0.25)",
        glowAmber: "0 0 35px -5px rgba(245, 158, 11, 0.25)",
        lightCard: "0 4px 20px -2px rgba(0, 0, 0, 0.05), 0 2px 6px -1px rgba(0, 0, 0, 0.02)",
      },
      animation: {
        "pulse-slow": "pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "shimmer": "shimmer 2.5s linear infinite",
      },
      keyframes: {
        shimmer: {
          "0%": { backgroundPosition: "200% 0" },
          "100%": { backgroundPosition: "-200% 0" },
        },
      },
    },
  },
  plugins: [tailwindAnimate],
};

export default config;

