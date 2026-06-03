/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,ts,tsx}"],
  presets: [require("nativewind/preset")],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        primary: "#0295f7",
        "primary-container": "#0295f7",
        "on-primary-container": "#002d47",
        "on-primary": "#003351",
        
        secondary: "#0295f7",
        "secondary-container": "#0295f7",
        
        background: "#f9f9f9",
        "dark-background": "#121212",
        "on-background": "#e5e2e1",
        
        accentbg: "#0295f7",
        accenttxt: "#0295f7",
        text: "#333",

        // Stitch Semantic Dark Mode Colors
        "surface": "#121212",
        "surface-dim": "#121212",
        "surface-bright": "#393939",
        "surface-container-lowest": "#0e0e0e",
        "surface-container-low": "#1c1b1b",
        "surface-container": "#201f1f",
        "surface-container-high": "#2a2a2a",
        "surface-container-highest": "#353534",
        "on-surface": "#e5e2e1",
        "on-surface-variant": "#bfc7d2",
        "outline": "#89929b",
        "outline-variant": "#3f4850",
        "surface-variant": "#353534"
      },
      spacing: {
        "base": "4px",
        "xs": "4px",
        "sm": "8px",
        "md": "16px",
        "lg": "24px",
        "xl": "32px",
        "gutter": "16px",
        "margin": "20px"
      }
    },
  },
  plugins: [],
}

