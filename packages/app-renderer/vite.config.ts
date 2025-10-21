import { defineConfig } from 'vite';
import path from 'node:path';

export default defineConfig({
  root: 'packages/app-renderer',
  server: { port: 5173, strictPort: true },
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
  build: { outDir: 'dist' }
});
