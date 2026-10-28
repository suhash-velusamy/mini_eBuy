/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        campus: {
          50: '#f0f7ff',
          100: '#e0effe',
          200: '#bae0fd',
          300: '#7cc7fb',
          400: '#36a8f5',
          500: '#0c8de4',
          600: '#0270c2',
          700: '#03599e',
          800: '#074c82',
          900: '#0c406d',
        }
      }
    },
  },
  plugins: [],
}
