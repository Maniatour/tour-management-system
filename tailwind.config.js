/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      keyframes: {
        'schedule-health-cell-blink': {
          '0%, 49%': { backgroundColor: '#dc2626', color: '#fde047' },
          '50%, 100%': { backgroundColor: '#991b1b', color: '#fef9c3' },
        },
      },
      animation: {
        'schedule-health-cell-blink': 'schedule-health-cell-blink 1s step-end infinite',
      },
    },
  },
  plugins: [],
}

