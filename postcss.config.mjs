// Tailwind v4 runs as a PostCSS plugin. app/globals.css loads only its theme and utilities (no reset layer).
const config = {
  plugins: { "@tailwindcss/postcss": {} },
};

export default config;
