/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'Vazirmatn', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      colors: {
        primary: {
          500: '#0B4FD8',
          600: '#0B4FD8',
          700: '#083FAA',
        },
        teal: {
          500: '#00B8A9',
          600: '#089A90',
        },
      },
      boxShadow: {
        soft: '0 18px 45px rgba(15, 23, 42, 0.08)',
        card: '0 24px 70px rgba(15, 23, 42, 0.12)',
        glow: '0 18px 35px rgba(11, 79, 216, 0.22)',
        hero: '0 30px 90px rgba(15, 23, 42, 0.16)',
      },
    },
  },
  plugins: [],
};
