import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const buildVersion = Date.now().toString();

function versionPlugin(): Plugin {
  return {
    name: 'version-plugin',
    buildStart() {
      try {
        const publicDir = fileURLToPath(new URL('./public', import.meta.url));
        if (fs.existsSync(publicDir)) {
          fs.writeFileSync(
            fileURLToPath(new URL('./public/version.json', import.meta.url)),
            JSON.stringify({ version: buildVersion, buildTime: new Date().toISOString() }, null, 2)
          );
        }
      } catch (err) {
        console.error('Failed to write public/version.json:', err);
      }
    },
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'version.json',
        source: JSON.stringify({ version: buildVersion, buildTime: new Date().toISOString() }, null, 2),
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), versionPlugin()],
  define: {
    __APP_BUILD_VERSION__: JSON.stringify(buildVersion),
  },
  build: {
    rollupOptions: {
      output: {
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
});
