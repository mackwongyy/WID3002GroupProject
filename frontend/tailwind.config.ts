import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      boxShadow: {
        soft: "0 20px 50px -24px rgb(15 23 42 / 0.35)"
      }
    }
  },
  plugins: []
};

export default config;
