import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      // Spacing scale: use Tailwind's default 4px-based scale only —
      // 1 (4px) / 2 (8px) / 3 (12px) / 4 (16px) / 6 (24px) / 8 (32px).
      // Avoid off-scale values (p-2.5, gap-3.5, ...) in new code, and reuse
      // components/ui/PageHeader and components/ui/Card's `density` prop
      // for page/card rhythm instead of hand-tuning spacing per page.
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
        info: {
          DEFAULT: "oklch(var(--info-ch) / <alpha-value>)",
          soft: "oklch(var(--info-soft-ch) / <alpha-value>)",
        },
        border: {
          DEFAULT: "oklch(var(--border-ch) / <alpha-value>)",
          strong: "oklch(var(--border-strong-ch) / <alpha-value>)",
        },
        ring: "var(--ring)",
        // Home dashboard + sidebar palette, copied value-for-value from the dashboard reference
        // design (applylab-dashboard-reference.html :root). Hex on purpose: these must match it exactly.
        dash: {
          bg: "#FBF8F5",
          border: "#EDE7E1",
          divider: "#F3EEE9",
          text: "#1C1917",
          "text-2": "#57534E",
          nav: "#3F3A36",
          muted: "#78716C",
          faint: "#A8A29E",
          orange: "#EA580C",
          "orange-ink": "#C2410C",
          "orange-deep": "#9A3412",
          "orange-tint": "#FFE9DC",
          banner: "#FFF3EB",
          "banner-border": "#FBDCC8",
          input: "#D6CFC8",
        },
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
        dash: ["var(--font-geist-sans)", "ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "sans-serif"],
        "dash-display": ["var(--font-fraunces)", "Georgia", "serif"],
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
          "36px",
          { lineHeight: "1.05", letterSpacing: "-0.01em", fontWeight: "560" },
        ],
        h2: ["24px", { lineHeight: "1.2", fontWeight: "520" }],
        h3: ["17px", { lineHeight: "1.35", fontWeight: "600" }],
        "body-lg": ["18px", { lineHeight: "1.6" }],
        body: ["16px", { lineHeight: "1.6" }],
        meta: ["13px", { lineHeight: "1.5" }],
      },
      keyframes: {
        "fade-in-up": {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "none" },
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
