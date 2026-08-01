import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        paper: "var(--paper)",
        "paper-deep": "var(--paper-deep)",
        surface: "var(--surface)",
        ink: {
          DEFAULT: "var(--ink)",
          secondary: "var(--ink-secondary)",
          muted: "var(--ink-muted)",
        },
        accent: {
          DEFAULT: "var(--accent)",
          hover: "var(--accent-hover)",
          soft: "var(--accent-soft)",
        },
        "on-accent": "var(--on-accent)",
        success: {
          DEFAULT: "var(--success)",
          soft: "var(--success-soft)",
        },
        attention: {
          DEFAULT: "var(--attention)",
          soft: "var(--attention-soft)",
        },
        critical: {
          DEFAULT: "var(--critical)",
          soft: "var(--critical-soft)",
        },
        border: {
          DEFAULT: "var(--border)",
          strong: "var(--border-strong)",
        },
        ring: "var(--ring)",
        // Legacy brand scale kept in the warm-editorial accent family so any
        // remaining bg-brand-* usages stay on-palette rather than blue.
        brand: {
          50: "#E7EFE9",
          100: "#D3E3DA",
          500: "#2E5D4E",
          600: "#24493D",
          700: "#1B372D",
        },
      },
      fontFamily: {
        sans: ["var(--font-hanken-grotesk)", "system-ui", "sans-serif"],
        display: ["var(--font-fraunces)", "Georgia", "serif"],
        mono: ["var(--font-jetbrains-mono)", "monospace"],
      },
      borderRadius: {
        sm: "var(--radius-sm)",
        DEFAULT: "var(--radius)",
        pill: "var(--radius-pill)",
      },
      boxShadow: {
        sm: "var(--shadow-sm)",
        pop: "var(--shadow-pop)",
      },
      transitionTimingFunction: {
        DEFAULT: "var(--ease)",
        editorial: "var(--ease)",
      },
      transitionDuration: {
        DEFAULT: "200ms",
        fast: "140ms",
        slow: "320ms",
      },
      fontSize: {
        display: [
          "44px",
          { lineHeight: "1.05", letterSpacing: "-0.01em", fontWeight: "560" },
        ],
        h2: ["30px", { lineHeight: "1.15", fontWeight: "520" }],
        h3: ["20px", { lineHeight: "1.3", fontWeight: "600" }],
        "body-lg": ["18px", { lineHeight: "1.6" }],
        body: ["16px", { lineHeight: "1.6" }],
        meta: ["13px", { lineHeight: "1.5" }],
      },
      keyframes: {
        "fade-in-up": {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "fade-in-up": "fade-in-up var(--dur-slow) var(--ease) both",
      },
    },
  },
  plugins: [],
};

export default config;
