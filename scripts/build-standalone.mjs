import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { transformSync } from 'esbuild';
import { build } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const entryHtml = path.join(rootDir, 'app.html');
const tmpDir = path.join(rootDir, '.standalone-tmp');
const distDir = path.join(rootDir, 'dist');
const standaloneDir = path.join(rootDir, 'standalone');
const withDist = process.argv.includes('--with-dist');

const WEBVIEW_POLYFILL = `<script>
(function(){
  if(typeof AbortSignal!=='undefined'&&!AbortSignal.timeout){
    AbortSignal.timeout=function(ms){var c=new AbortController();setTimeout(function(){try{c.abort();}catch(e){}},ms);return c.signal;};
  }
  if(!Array.prototype.at){
    Object.defineProperty(Array.prototype,'at',{value:function(n){n=Math.trunc(n)||0;if(n<0)n+=this.length;if(n<0||n>=this.length)return undefined;return this[n];},configurable:true,writable:true});
  }
})();
</script>`;

function normalizeWebViewCss(css) {
  return css
    .replace(/@media\s*\(\s*width\s*>=\s*([^)]+)\)/gi, '@media (min-width: $1)')
    .replace(/@media\s*\(\s*width\s*<=\s*([^)]+)\)/gi, '@media (max-width: $1)')
    .replace(/<\/style>/gi, '<\\/style>');
}

async function buildDistProduction() {
  await build({
    root: rootDir,
    plugins: [react(), tailwindcss()],
    logLevel: 'warn',
    build: {
      outDir: distDir,
      emptyOutDir: true,
      rollupOptions: {
        input: entryHtml,
      },
    },
  });

  const builtAppHtml = path.join(distDir, 'app.html');
  const distIndexHtml = path.join(distDir, 'index.html');
  if (fs.existsSync(builtAppHtml)) {
    fs.renameSync(builtAppHtml, distIndexHtml);
  }
}

async function buildSingleFileHtml() {
  fs.rmSync(tmpDir, { recursive: true, force: true });

  await build({
    root: rootDir,
    base: './',
    plugins: [react(), tailwindcss()],
    logLevel: 'warn',
    build: {
      outDir: tmpDir,
      emptyOutDir: true,
      target: 'es2018',
      assetsInlineLimit: 100_000_000,
      cssCodeSplit: false,
      minify: 'esbuild',
      rollupOptions: {
        input: entryHtml,
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

  const builtHtmlPath = path.join(tmpDir, 'app.html');
  const builtJsPath = path.join(tmpDir, 'bundle.js');
  const builtCssPath = path.join(tmpDir, 'bundle.css');

  let html = fs.readFileSync(builtHtmlPath, 'utf-8');
  let jsCode = fs.existsSync(builtJsPath) ? fs.readFileSync(builtJsPath, 'utf-8') : '';
  if (jsCode) {
    jsCode = transformSync(jsCode, {
      loader: 'js',
      target: 'es2018',
      minify: true,
    }).code.replace(/<\/script>/gi, '<\\/script>');
  }

  const cssCode = fs.existsSync(builtCssPath)
    ? normalizeWebViewCss(fs.readFileSync(builtCssPath, 'utf-8'))
    : '';

  html = html.replace(/<link[^>]*href=["'][^"']*bundle\.css["'][^>]*>/gi, '');
  html = html.replace(/<script[^>]*src=["'][^"']*bundle\.js["'][^>]*><\/script>/gi, '');

  if (cssCode) {
    html = html.replace('</head>', () => `  <style>\n${cssCode}\n  </style>\n  </head>`);
  }
  if (jsCode) {
    html = html.replace(
      '</body>',
      () => `  ${WEBVIEW_POLYFILL}\n  <script>\n${jsCode}\n  </script>\n  </body>`
    );
  }

  fs.writeFileSync(path.join(rootDir, 'index.html'), html, 'utf-8');
  fs.mkdirSync(standaloneDir, { recursive: true });
  fs.writeFileSync(path.join(standaloneDir, 'index.html'), html, 'utf-8');
  fs.rmSync(tmpDir, { recursive: true, force: true });

  const sizeKb = (Buffer.byteLength(html, 'utf-8') / 1024).toFixed(1);
  console.log(`Built single-file HTML: index.html & standalone/index.html (${sizeKb} KB)`);
}

async function main() {
  if (withDist) {
    await buildDistProduction();
  }
  await buildSingleFileHtml();
}

main().catch((err) => {
  console.error('Build failed:', err);
  process.exit(1);
});
