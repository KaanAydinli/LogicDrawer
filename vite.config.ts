import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    hmr: {
      overlay: true
    },
    watch: {
      usePolling: true
    }
  },
  build: {
    sourcemap: true
  }
}); 