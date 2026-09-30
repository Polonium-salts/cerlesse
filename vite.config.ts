import legacy from '@vitejs/plugin-legacy';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';
import { edgeOneDevPlugin } from './server/edgeDevMiddleware.js';

export default defineConfig(() => {
  return {
    plugins: [
      react(),
      legacy({
        targets: [
          'chrome >= 80',
          'firefox >= 78',
          'safari >= 13',
          'ios_saf >= 13',
          'edge >= 80',
        ],
      }),
      edgeOneDevPlugin(),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      outDir: 'dist',
      emptyOutDir: true,
      sourcemap: false
    },
    server: {
      host: '0.0.0.0',
      port: 3000,
      hmr: false,
      watch: null,
    },
  };
});
