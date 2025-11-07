/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./App.{js,jsx,ts,tsx}",
    "./src/**/*.{js,jsx,ts,tsx}"
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        // Warm food colors
        'food-orange': '#FF7E42',
        'food-yellow': '#FFB25A',
        'food-cream': '#FFE4C3',
      },
    },
  },
  plugins: [],
}

