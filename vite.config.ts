import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [
      react(),
      tailwindcss(),
      // Copies src/assets into dist/ so root-relative URLs like
      // "/src/assets/images/..." (e.g. generate_image output) still resolve
      // in production builds, while excluding private/temporary aistudio/ folders.
      {
        name: 'copy-unbundled-src-assets',
        apply: 'build',
        closeBundle(error?: Error): void {
          if (error) {
            return;
          }
          const distDir = path.resolve(import.meta.dirname, 'dist');
          const srcAssets = path.resolve(import.meta.dirname, 'src/assets');
          const distAssets = path.resolve(distDir, 'src/assets');
          if (fs.existsSync(distDir) && fs.existsSync(srcAssets)) {
            fs.cpSync(srcAssets, distAssets, {
              recursive: true,
              force: true,
              filter: (src) => !src.split(path.sep).includes('aistudio'),
            });
          }
          // Strip any aistudio/ folders copied from public/ into dist/
          const pruneAistudioDirs = (dir: string) => {
            if (!fs.existsSync(dir)) return;
            for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
              if (!entry.isDirectory()) continue;
              const fullPath = path.join(dir, entry.name);
              if (entry.name === 'aistudio') {
                fs.rmSync(fullPath, {recursive: true, force: true});
              } else {
                pruneAistudioDirs(fullPath);
              }
            }
          };
          pruneAistudioDirs(distDir);
        },
      },
    ],
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, '.'),
      },
    },
    build: {
      rolldownOptions: {
        output: {
          codeSplitting: {
            groups: [
              {
                name: 'vendor-react',
                test: /node_modules\/(react|react-dom|scheduler)\//,
                priority: 30,
              },
              {
                name: 'vendor-charts',
                test: /node_modules\/(recharts|recharts-scale|victory-vendor|d3-[^/]+|internmap|decimal\.js-light)\//,
                priority: 25,
              },
              {
                name: 'vendor-motion',
                test: /node_modules\/(motion|framer-motion|motion-dom|motion-utils)\//,
                priority: 20,
              },
              {
                name: 'vendor-icons',
                test: /node_modules\/lucide-react\//,
                priority: 15,
              },
            ],
          },
        },
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
