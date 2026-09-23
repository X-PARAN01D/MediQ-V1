/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eef6fd',
          100: '#d8ebfa',
          200: '#b0d5f4',
          300: '#7dbcec',
          400: '#489de2',
          500: '#227fd1',
          600: '#0b64b4',
          700: '#0a5091',
          800: '#0d4577',
          900: '#103a61',
        },
        ink: {
          900: '#0f2440',
          700: '#2c425f',
          500: '#5b7189',
          400: '#7d93ab',
        },
        band: {
          nor: '#15803d',
          mod: '#b45309',
          emr: '#b91c1c',
        },
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', '"Noto Sans"', 'Arial', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(15,36,64,.06), 0 1px 3px rgba(15,36,64,.08)',
        pop: '0 8px 24px rgba(15,36,64,.12)',
      },
      borderRadius: {
        xl2: '1rem',
      },
    },
  },
  plugins: [],
}
