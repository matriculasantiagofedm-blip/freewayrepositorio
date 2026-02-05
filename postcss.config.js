/** @type {import('postcss-load-config').Config} */
const config = {
  plugins: {
    'tailwindcss/nesting': {}, // Permite anidar CSS como en SASS
    tailwindcss: {},
    autoprefixer: {}, // Fundamental para compatibilidad entre navegadores
  },
};

export default config;