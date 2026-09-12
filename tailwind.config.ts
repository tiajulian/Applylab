import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // oklch(var(--x-ch) / <alpha-value>), not var(--x) directly: Tailwind can only generate
        // an opacity-modifier utility (bg-paper/50, border-accent/20, ...) for a color written
        // with the <alpha-value> placeholder, which isn't possible for a var() that already
        // resolves to a complete oklch(...) color. --x-ch (globals.css) holds just the bare
        // channel numbers so the placeholder has somewhere to go.
        paper: "oklch(var(--paper-ch) / <alpha-value>)",
        "paper-deep": "oklch(var(--paper-deep-ch) / <alpha-value>)",
        surface: "oklch(var(--surface-ch) / <alpha-value>)",
        ink: {
          DEFAULT: "oklch(var(--ink-ch) / <alpha-value>)",
          secondary: "oklch(var(--ink-secondary-ch) / <alpha-value>)",
          muted: "oklch(var(--ink-muted-ch) / <alpha-value>)",
        },
        accent: {
          DEFAULT: "oklch(var(--accent-ch) / <alpha-value>)",
          hover: "oklch(var(--accent-hover-ch) / <alpha-value>)",
          soft: "oklch(var(--accent-soft-ch) / <alpha-value>)",
        },
        "on-accent": "oklch(var(--on-accent-ch) / <alpha-value>)",
        success: {
          DEFAULT: "oklch(var(--success-ch) / <alpha-value>)",
          soft: "oklch(var(--success-soft-ch) / <alpha-value>)",
        },
        attention: {
          DEFAULT: "oklch(var(--attention-ch) / <alpha-value>)",
          soft: "oklch(var(--attention-soft-ch) / <alpha-value>)",
        },
        critical: {
          DEFAULT: "oklch(var(--critical-ch) / <alpha-value>)",
          soft: "oklch(var(--critical-soft-ch) / <alpha-value>)",
        },
        border: {
          DEFAULT: "oklch(var(--border-ch) / <alpha-value>)",
          strong: "oklch(var(--border-strong-ch) / <alpha-value>)",
        },
        ring: "var(--ring)",
        // Legacy brand scale kept in the warm-editorial accent family so any
        // remaining bg-brand-* usages stay on-palette rather than off-brand.
        brand: {
          50: "oklch(0.94 0.03 45)",
          100: "oklch(0.88 0.05 45)",
          500: "oklch(0.62 0.14 45)",
          600: "oklch(0.56 0.14 45)",
          700: "oklch(0.46 0.13 45)",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "Georgia", "serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
      borderRadius: {
        sm: "var(--radius-sm)",
        DEFAULT: "var(--radius)",
        lg: "var(--radius-lg)",
        pill: "var(--radius-pill)",
      },
      boxShadow: {
        sm: "var(--shadow-sm)",
        pop: "var(--shadow-pop)",
        lg: "var(--shadow-lg)",
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
