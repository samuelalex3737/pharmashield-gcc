import type { Config } from "tailwindcss";

// Semantic colour tokens come from CSS variables (app/globals.css) so light and dark themes share one class set.
const token = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

const config: Config = {
  darkMode: "class",
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: token("bg"),
        surface: token("surface"),
        raised: token("raised"),
        line: token("line"),
        ink: token("ink"),
        muted: token("muted"),
        faint: token("faint"),
        accent: token("accent"),
        "accent-ink": token("accent-ink"),
        "accent-soft": token("accent-soft"),
        brand: token("brand"),
        risk: token("risk"),
        "risk-soft": token("risk-soft"),
        warn: token("warn"),
        "warn-soft": token("warn-soft"),
        good: token("good"),
        "good-soft": token("good-soft"),
      },
      fontFamily: { sans: ["var(--font-inter)", "system-ui", "sans-serif"] },
      fontSize: { display: ["2.5rem", { lineHeight: "1.1", letterSpacing: "-0.02em", fontWeight: "700" }] },
    },
  },
  plugins: [],
};
export default config;
