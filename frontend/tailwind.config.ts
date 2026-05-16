import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        arc: {
          bg: "var(--arc-bg)",
          panel: "var(--arc-panel)",
          accent: "var(--arc-accent)",
          accent2: "var(--arc-accent2)",
          muted: "var(--arc-muted)",
        },
      },
      fontFamily: {
        mono: ["JetBrains Mono", "ui-monospace", "SFMono-Regular", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
