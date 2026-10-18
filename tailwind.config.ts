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
        // Every colour is defined once, in app/globals.css :root, as bare "R G B" channels; these
        // wrap them as rgb(var(--x) / <alpha-value>) so opacity modifiers (bg-paper/50,
        // border-accent/20, ...) work. Prefer the role names (accent, ink, border, ...) in
        // components; reach for the raw brand/neutral scales only for artwork and one-off tints.
        paper: "rgb(var(--paper-ch) / <alpha-value>)",
        "paper-deep": "rgb(var(--paper-deep-ch) / <alpha-value>)",
        surface: "rgb(var(--surface-ch) / <alpha-value>)",
        ink: {
          DEFAULT: "rgb(var(--ink-ch) / <alpha-value>)",
          secondary: "rgb(var(--ink-secondary-ch) / <alpha-value>)",
          muted: "rgb(var(--ink-muted-ch) / <alpha-value>)",
        },
        accent: {
          DEFAULT: "rgb(var(--accent-ch) / <alpha-value>)",
          hover: "rgb(var(--accent-hover-ch) / <alpha-value>)",
          soft: "rgb(var(--accent-soft-ch) / <alpha-value>)",
        },
        "on-accent": "rgb(var(--on-accent-ch) / <alpha-value>)",
        // Status colours: score/status badges only, never buttons or links.
        success: {
          DEFAULT: "rgb(var(--success-ch) / <alpha-value>)",
          soft: "rgb(var(--success-soft-ch) / <alpha-value>)",
        },
        attention: {
          DEFAULT: "rgb(var(--attention-ch) / <alpha-value>)",
          soft: "rgb(var(--attention-soft-ch) / <alpha-value>)",
        },
        critical: {
          DEFAULT: "rgb(var(--critical-ch) / <alpha-value>)",
          soft: "rgb(var(--critical-soft-ch) / <alpha-value>)",
        },
        info: {
          DEFAULT: "rgb(var(--info-ch) / <alpha-value>)",
          soft: "rgb(var(--info-soft-ch) / <alpha-value>)",
        },
        border: {
          DEFAULT: "rgb(var(--border-ch) / <alpha-value>)",
          strong: "rgb(var(--border-strong-ch) / <alpha-value>)",
        },
        ring: "var(--ring)",
        // Brand scale, the logo's hue throughout. 500 is the exact logo orange (logo, icons, small
        // accents); 700 is the darkest-still-orange shade white text passes 4.5:1 on.
        brand: {
          50: "rgb(var(--brand-50) / <alpha-value>)",
          100: "rgb(var(--brand-100) / <alpha-value>)",
          200: "rgb(var(--brand-200) / <alpha-value>)",
          300: "rgb(var(--brand-300) / <alpha-value>)",
          400: "rgb(var(--brand-400) / <alpha-value>)",
          500: "rgb(var(--brand-500) / <alpha-value>)",
          600: "rgb(var(--brand-600) / <alpha-value>)",
          700: "rgb(var(--brand-700) / <alpha-value>)",
          800: "rgb(var(--brand-800) / <alpha-value>)",
          900: "rgb(var(--brand-900) / <alpha-value>)",
        },
        // Warm neutral scale (overrides Tailwind's grey "neutral"; 950 pinned so none of it survives).
        neutral: {
          0: "rgb(var(--neutral-0) / <alpha-value>)",
          50: "rgb(var(--neutral-50) / <alpha-value>)",
          100: "rgb(var(--neutral-100) / <alpha-value>)",
          200: "rgb(var(--neutral-200) / <alpha-value>)",
          300: "rgb(var(--neutral-300) / <alpha-value>)",
          400: "rgb(var(--neutral-400) / <alpha-value>)",
          500: "rgb(var(--neutral-500) / <alpha-value>)",
          600: "rgb(var(--neutral-600) / <alpha-value>)",
          700: "rgb(var(--neutral-700) / <alpha-value>)",
          800: "rgb(var(--neutral-800) / <alpha-value>)",
          900: "rgb(var(--neutral-900) / <alpha-value>)",
          950: "rgb(var(--neutral-900) / <alpha-value>)",
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
