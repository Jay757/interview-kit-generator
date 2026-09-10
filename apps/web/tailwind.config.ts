import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        canvas: {
          base: "#090a0f",
          surface: "#0f1117",
          subtle: "#161922",
          muted: "#1f2330",
          border: "#272c3d",
          hover: "#222738",
        },
        accent: {
          amber: "#f59e0b",
          amberMuted: "rgba(245, 158, 11, 0.12)",
          emerald: "#10b981",
          emeraldMuted: "rgba(16, 185, 129, 0.12)",
          rose: "#f43f5e",
          roseMuted: "rgba(244, 63, 94, 0.12)",
          cyan: "#06b6d4",
          cyanMuted: "rgba(6, 182, 212, 0.12)",
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
      },
    },
  },
  plugins: [],
};

export default config;
