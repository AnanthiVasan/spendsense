import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: {
          950: "#0b1220",
          900: "#111827",
          800: "#1f2937",
        },
      },
    },
  },
  plugins: [],
};

export default config;
