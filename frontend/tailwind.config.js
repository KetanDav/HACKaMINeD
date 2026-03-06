/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['Syne', 'sans-serif'],
        body: ['DM Sans', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace']
      },
      colors: {
        carbon: {
          950: '#080B0F',
          900: '#0D1117',
          800: '#161B22',
          700: '#21262D',
          600: '#30363D',
        },
        acid: {
          DEFAULT: '#B5FF3A',
          dim: '#8FCC2E',
        },
        danger: '#FF4545',
        warning: '#FFB347',
        caution: '#FFE066',
        safe: '#3AFF8C',
      },
      animation: {
        'scan-line': 'scanLine 2s linear infinite',
        'pulse-acid': 'pulseAcid 2s ease-in-out infinite',
        'fade-up': 'fadeUp 0.5s ease forwards',
      },
      keyframes: {
        scanLine: {
          '0%': { transform: 'translateY(0%)' },
          '100%': { transform: 'translateY(100%)' },
        },
        pulseAcid: {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(181,255,58,0.4)' },
          '50%': { boxShadow: '0 0 0 12px rgba(181,255,58,0)' },
        },
        fadeUp: {
          '0%': { opacity: 0, transform: 'translateY(16px)' },
          '100%': { opacity: 1, transform: 'translateY(0)' },
        }
      }
    }
  },
  plugins: []
}
