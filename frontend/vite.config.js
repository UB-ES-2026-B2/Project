
import { defineConfig, configDefaults } from 'vitest/config';
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

    // Vitest no debe ejecutar las pruebas E2E de Playwright.
    exclude: [
      ...configDefaults.exclude,
      '**/end2end/**',
    ],

    coverage: {
      reporter: ['text', 'json-summary'],
      include: ['**/*.{jsx,tsx}'],
      exclude: ['**/main.jsx'],
      thresholds: {
        'src/pages/auth/RegisterForm.tsx': {
          lines: 60,
          functions: 60,
          branches: 60,
          statements: 60,
        },
        // US 4.2.2: persistencia de la sesión y logout.
        'src/context/AuthContext.tsx': {
          lines: 60,
          functions: 60,
          branches: 60,
          statements: 60,
        },
        'src/pages/auth/LoginForm.tsx': {
          lines: 60,
          functions: 60,
          branches: 60,
          statements: 60,
        },
      },
    },
  },
});
