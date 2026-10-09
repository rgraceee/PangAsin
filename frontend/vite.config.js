import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  root: '.',
  publicDir: 'public',
  base: '/',
  build: {
    outDir: '../app/static/react',
    emptyOutDir: true,
    assetsDir: 'assets',
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:5000',
        changeOrigin: true,
      },
      /* WHAT: I-proxy ang brand assets sa Flask sa dev.
         WHY: para gumana ang totoong logo (/static/brand) sa dev server, katulad ng Login. */
      '/static/brand': {
        target: 'http://127.0.0.1:5000',
        changeOrigin: true,
      },
    },
  },
});
