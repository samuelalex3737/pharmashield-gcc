import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        navy: { 50: "#eef3f9", 100: "#d6e2f0", 600: "#2b5a8a", 700: "#1f4e79", 800: "#173b5c", 900: "#0f2840" },
        risk: { low: "#2f7d4f", mid: "#b7791f", high: "#b42318" },
      },
    },
  },
  plugins: [],
};
export default config;
