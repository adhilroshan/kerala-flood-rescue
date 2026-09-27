import { defineConfig } from 'vite';

export default defineConfig({
  test: {
    environment: 'node',
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('/node_modules/three/')) return 'three';
        },
      },
    },
  },
});
