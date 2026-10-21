/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#2563EB",
          soft: "#EFF6FF",
          dark: "#1E3A8A",
        },
        surface: {
          DEFAULT: "#FFFFFF",
          muted: "#F3F4F6",
          strong: "#111827",
        },
        accent: {
          DEFAULT: "#14B8A6",
          soft: "#ECFEFF",
          dark: "#0F766E",
        },
        danger: {
          DEFAULT: "#EF4444",
          soft: "#FEF2F2",
          dark: "#991B1B",
        },
      },
      fontFamily: {
        sans: ["system-ui", "sf-pro-text", "Segoe UI", "Roboto", "sans-serif"],
      },
      borderRadius: {
        sm: "0.375rem",
        md: "0.5rem",
        lg: "0.75rem",
        xl: "1rem",
        full: "9999px",
      },
      boxShadow: {
        soft: "0 12px 30px rgba(15, 23, 42, 0.12)",
      },
    },
  },
  plugins: [],
};
