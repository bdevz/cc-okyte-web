import type { Config } from "tailwindcss";
import typography from "@tailwindcss/typography";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    container: {
      center: true,
      padding: "1rem",
      screens: { "2xl": "1280px" },
    },
    extend: {
      colors: {
        background: "hsl(0 0% 100%)",
        foreground: "hsl(222 47% 11%)",
        muted: "hsl(210 40% 96%)",
        "muted-foreground": "hsl(215 16% 47%)",
        border: "hsl(214 32% 91%)",
        primary: "hsl(222 47% 11%)",
        "primary-foreground": "hsl(210 40% 98%)",
        accent: "hsl(210 40% 96%)",
        "accent-foreground": "hsl(222 47% 11%)",
        destructive: "hsl(0 84% 60%)",
        "destructive-foreground": "hsl(0 0% 98%)",
        success: "hsl(142 71% 45%)",
        warning: "hsl(38 92% 50%)",
      },
      borderRadius: {
        lg: "0.5rem",
        md: "0.375rem",
        sm: "0.25rem",
      },
    },
  },
  plugins: [typography],
};

export default config;
