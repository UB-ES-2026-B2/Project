import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://localhost:8000',
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: './test-setup.js',
    coverage: {
      reporter: ['text', 'json-summary'],
      // Todo el código de la app, .js/.jsx y .ts/.tsx, dentro y fuera de src/.
      include: ['src/**/*.{js,jsx,ts,tsx}', 'components/**/*.{js,jsx,ts,tsx}'],
      exclude: ['src/main.jsx', '**/*.test.{js,jsx,ts,tsx}'],
      // Mínimo acordado (CONTRIBUTING.md, apartado 9): por debajo, `npm test` falla.
      thresholds: { lines: 60 },
    },
  },
});