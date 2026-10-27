import { defineConfig } from 'vite';

// Dev and preview servers listen on localhost only. To test from another device on a
// trusted network, opt in explicitly: `npm run dev -- --host`.
export default defineConfig({
  server: { host: 'localhost', proxy: { '/api': 'http://127.0.0.1:8080' } },
  preview: { host: 'localhost' },
  build: { target: 'es2022', chunkSizeWarningLimit: 700 },
});
