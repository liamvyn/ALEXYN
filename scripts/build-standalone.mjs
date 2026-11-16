import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { build } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const tmpDir = path.join(rootDir, '.standalone-tmp');
const outDir = path.join(rootDir, 'standalone');
const outFile = path.join(outDir, 'index.html');

async function buildStandalone() {
  fs.rmSync(tmpDir, { recursive: true, force: true });

  await build({
    root: rootDir,
    base: './',
    plugins: [react(), tailwindcss()],
    logLevel: 'warn',
    build: {
      outDir: tmpDir,
      emptyOutDir: true,
      assetsInlineLimit: 100_000_000,
      cssCodeSplit: false,
      minify: 'esbuild',
      rollupOptions: {
        output: {
          format: 'iife',
          name: 'AlexynApp',
          inlineDynamicImports: true,
          entryFileNames: 'bundle.js',
          assetFileNames: 'bundle.[ext]',
        },
      },
    },
  });

  const builtHtmlPath = path.join(tmpDir, 'index.html');
  const builtJsPath = path.join(tmpDir, 'bundle.js');
  const builtCssPath = path.join(tmpDir, 'bundle.css');

  let html = fs.readFileSync(builtHtmlPath, 'utf-8');
  const jsCode = fs.existsSync(builtJsPath)
    ? fs.readFileSync(builtJsPath, 'utf-8').replace(/<\/script>/gi, '<\\/script>')
    : '';
  const cssCode = fs.existsSync(builtCssPath)
    ? fs.readFileSync(builtCssPath, 'utf-8').replace(/<\/style>/gi, '<\\/style>')
    : '';

  // Remove external bundle links/scripts emitted by Vite and inline CSS + classic IIFE JS
  html = html.replace(/<link[^>]*href=["'][^"']*bundle\.css["'][^>]*>/gi, '');
  html = html.replace(/<script[^>]*src=["'][^"']*bundle\.js["'][^>]*><\/script>/gi, '');

  if (cssCode) {
    html = html.replace('</head>', () => `  <style>\n${cssCode}\n  </style>\n  </head>`);
  }
  if (jsCode) {
    html = html.replace('</body>', () => `  <script>\n${jsCode}\n  </script>\n  </body>`);
  }

  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(outFile, html, 'utf-8');
  fs.rmSync(tmpDir, { recursive: true, force: true });

  const sizeKb = (Buffer.byteLength(html, 'utf-8') / 1024).toFixed(1);
  console.log(`Built standalone single-file HTML: standalone/index.html (${sizeKb} KB)`);
}

buildStandalone().catch((err) => {
  console.error('Standalone build failed:', err);
  process.exit(1);
});
