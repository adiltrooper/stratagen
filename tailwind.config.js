/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      screens: {
        // Phones with little height (e.g. iPhone SE), so the controls stay on screen
        short: { raw: "(max-width: 639px) and (max-height: 700px)" },
      },
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

