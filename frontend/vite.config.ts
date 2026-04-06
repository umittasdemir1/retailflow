import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const rootDir = fileURLToPath(new URL('..', import.meta.url));
const resolveFromRoot = (...segments: string[]) => path.resolve(rootDir, ...segments);

export default defineConfig({
  plugins: [react()],
  resolve: {
    dedupe: ['react', 'react-dom', 'scheduler'],
    alias: {
      react: resolveFromRoot('node_modules/react'),
      'react/jsx-runtime': resolveFromRoot('node_modules/react/jsx-runtime.js'),
      'react/jsx-dev-runtime': resolveFromRoot('node_modules/react/jsx-dev-runtime.js'),
      'react-dom': resolveFromRoot('node_modules/react-dom'),
      'react-dom/client': resolveFromRoot('node_modules/react-dom/client.js'),
      scheduler: resolveFromRoot('node_modules/scheduler'),
    },
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8787',
        changeOrigin: true,
      },
    },
  },
});
