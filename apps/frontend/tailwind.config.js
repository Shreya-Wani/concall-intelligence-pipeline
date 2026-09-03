/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f0f7ff',
          100: '#e0effe',
          200: '#bae0fd',
          300: '#7cc7fb',
          400: '#36a9f7',
          500: '#0078d4', // Primary blue matching uploaded arrow icon
          600: '#0063b1',
          700: '#004e8c',
          800: '#004275',
          900: '#003862',
          950: '#002442',
        },
      },
    },
  },
  plugins: [],
}

