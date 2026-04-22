/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        kolt: '#185FA5',
        michaelann: '#993556',
        emma: '#534AB7',
        preston: '#0F6E56',
      },
    },
  },
  plugins: [],
};
