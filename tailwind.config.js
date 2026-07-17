/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        navy: '#1C2B39',
        slate: '#445064',
        paper: '#F7F4EE',
        ink: '#23262B',
        gold: '#B8863B',
        leaf: '#3F7D58',
        rust: '#B5493B',
        line: '#DAD3C4',
      },
      fontFamily: {
        display: ['"Source Serif 4"', 'serif'],
        body: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'monospace'],
      },
    },
  },
  plugins: [],
}
