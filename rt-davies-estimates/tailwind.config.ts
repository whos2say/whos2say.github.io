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
        brand: {
          50: "#f0f7f2",
          100: "#dceee1",
          500: "#2d6a4f",
          600: "#1b4332",
          700: "#14352a",
        },
      },
    },
  },
  plugins: [],
};

export default config;
