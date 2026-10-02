import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': new URL('./src', import.meta.url).pathname } },
  optimizeDeps: { include: ['@student-task-manager/shared'] },
  server: { port: 5173, proxy: { '/api': 'http://localhost:3001' } },
  build: {
    sourcemap: true,
    commonjsOptions: { include: [/packages\/shared/, /node_modules/] },
  },
});
