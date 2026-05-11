/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/renderer/**/*.{html,tsx,ts,jsx,js}'],
  theme: {
    extend: {
      colors: {
        sidebar: '#1e293b',
        'sidebar-text': '#cbd5e1',
        accent: '#3b82f6'
      }
    }
  },
  plugins: []
}
