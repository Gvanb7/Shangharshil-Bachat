/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: {
          50:  "#ECFDF5",
          100: "#D1FAE5",
          200: "#A7F3D0",
          300: "#6EE7B7",
          400: "#34D399",
          500: "#047857", // main
          600: "#065F46", // sidebar
          700: "#064E3B",
          800: "#022C22",
          900: "#021C15",
        },
        cooperative: {
          green: '#166534', 
          greenLight: '#dcfce7',
          gold:       '#854d0e',
          goldLight:  '#fef9c3', 
    }
  },
  fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}

