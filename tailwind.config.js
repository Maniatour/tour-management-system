/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ['class'],
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        border: 'var(--border)',
        input: 'var(--input)',
        ring: 'var(--ring)',
        background: 'var(--background)',
        foreground: 'var(--foreground)',
        primary: {
          DEFAULT: 'var(--primary)',
          foreground: 'var(--primary-foreground)',
        },
        secondary: {
          DEFAULT: 'var(--secondary)',
          foreground: 'var(--secondary-foreground)',
        },
        destructive: {
          DEFAULT: 'var(--destructive)',
          foreground: 'var(--destructive-foreground)',
        },
        muted: {
          DEFAULT: 'var(--muted)',
          foreground: 'var(--muted-foreground)',
        },
        accent: {
          DEFAULT: 'var(--accent)',
          foreground: 'var(--accent-foreground)',
        },
        booking: {
          DEFAULT: 'var(--booking)',
          foreground: 'var(--booking-foreground)',
          hover: 'var(--booking-hover)',
        },
        success: {
          DEFAULT: 'var(--success)',
          foreground: 'var(--success-foreground)',
        },
        warning: {
          DEFAULT: 'var(--warning)',
          foreground: 'var(--warning-foreground)',
        },
        danger: {
          DEFAULT: 'var(--danger)',
          foreground: 'var(--danger-foreground)',
        },
        popover: {
          DEFAULT: 'var(--popover)',
          foreground: 'var(--popover-foreground)',
        },
        card: {
          DEFAULT: 'var(--card)',
          foreground: 'var(--card-foreground)',
        },
        sidebar: {
          DEFAULT: 'var(--sidebar)',
          foreground: 'var(--sidebar-foreground)',
          primary: 'var(--sidebar-primary)',
          'primary-foreground': 'var(--sidebar-primary-foreground)',
          accent: 'var(--sidebar-accent)',
          'accent-foreground': 'var(--sidebar-accent-foreground)',
          border: 'var(--sidebar-border)',
          ring: 'var(--sidebar-ring)',
        },
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'var(--font-sans)', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
        btn: 'var(--radius-btn)',
        input: 'var(--radius-input)',
        card: 'var(--radius-card)',
        feature: 'var(--radius-feature)',
      },
      boxShadow: {
        xs: 'var(--shadow-xs)',
        card: 'var(--shadow-card)',
        'card-hover': 'var(--shadow-card-hover)',
        elevated: 'var(--shadow-md)',
      },
      spacing: {
        'section': 'var(--section-py)',
        'section-md': 'var(--section-py-md)',
        'section-lg': 'var(--section-py-lg)',
        'section-compact': 'var(--section-py-compact)',
        'section-compact-md': 'var(--section-py-compact-md)',
      },
      screens: {
        /** 입장권 부킹 테이블 — 1920 뷰포트에서 보조 열 표시 */
        '3xl': '1920px',
      },
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
