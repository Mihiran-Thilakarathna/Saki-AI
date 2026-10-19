import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath, URL } from 'node:url';

// In development the Vite server proxies /api and /ws to the Spring Boot backend,
// so the browser talks to a single origin and no CORS round-trips are needed.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const backend = env.SAKI_BACKEND_URL || 'http://localhost:8080';

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
    },
    server: {
      port: 5173,
      proxy: {
        '/api': { target: backend, changeOrigin: false },
        '/ws': { target: backend.replace(/^http/, 'ws'), ws: true, changeOrigin: false },
      },
    },
    build: {
      chunkSizeWarningLimit: 4000,
      rollupOptions: {
        output: {
          manualChunks: {
            monaco: ['monaco-editor'],
            react: ['react', 'react-dom'],
          },
        },
      },
    },
    worker: {
      format: 'es',
    },
  };
});
