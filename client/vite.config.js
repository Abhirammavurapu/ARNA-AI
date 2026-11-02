import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const apiTarget = process.env.VITE_DEV_API_TARGET || 'http://localhost:5000';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    host: true, // reachable from your phone on the same Wi-Fi
    proxy: { '/api': { target: apiTarget, changeOrigin: true } },
  },
  build: {
    chunkSizeWarningLimit: 900,
    rolldownOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (/node_modules\/(three|@react-three)\//.test(id)) return 'three';
          if (/node_modules\/(react|react-dom|scheduler)\//.test(id)) return 'vendor';
          if (/node_modules\/(react-markdown|remark|rehype|unified|micromark|mdast|hast|unist|highlight\.js|lowlight|vfile)/.test(id)) return 'markdown';
          return undefined;
        },
      },
    },
  },
});
