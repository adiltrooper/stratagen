/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        "background-secondary": "var(--background-secondary)",
        // Same orange as the route lines
        strava: "#FC5200",
      },
      borderRadius: {
        "4xl": "2rem",
      },
    },
  },
  plugins: [],
}

