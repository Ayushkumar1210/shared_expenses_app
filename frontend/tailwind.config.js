/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f0f4ff',
          100: '#d9e2ff',
          200: '#b3c5ff',
          300: '#8ca9ff',
          400: '#668cff',
          500: '#3f6eff',
          600: '#1a51ff',
          700: '#0037eb',
          800: '#002bb3',
          900: '#001c80',
        }
      }
    },
  },
  plugins: [],
}
