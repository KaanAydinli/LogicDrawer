import { defineConfig } from 'vite';
import { defineConfig as defineVitestConfig } from 'vitest/config'; // Vitest config tipini import et

// Basitleştirilmiş config
export default defineConfig({
  server: {
    hmr: {
      overlay: true
    },
    watch: {
      usePolling: true
    },

  },
  build: {
    sourcemap: false,
    outDir: 'dist'
  },
  // Vitest yapılandırmasını buraya ekleyin
  test: {
    root: '.', // Proje kök dizinini belirtir (genellikle '.' yeterlidir)
    include: ['tests/**/*.{test,spec}.?(c|m)[jt]s?(x)'], // Test dosyalarının aranacağı yer
    globals: true, // describe, it, expect gibi global değişkenleri etkinleştirir
    environment: 'node', // Veya 'jsdom' (DOM gerekiyorsa)
  }
});