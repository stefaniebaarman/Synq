/** @type {import('tailwindcss').Config} */
module.exports = {
  mode: 'jit',
  content: ["./App.{js,jsx,ts,tsx}", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        'synq-accent': {
          light: "#7DFFA6",
          dark: "#7DFFA6"
        },
        'synq-background': {
          light: "#FDFDFD",
          dark: "#050606",
        },
        'synq-text': {
          light: "#000",
          dark: "#fff",
        }
      }
    }
  },
  plugins: [],
}
