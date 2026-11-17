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
const tmpDir = path.join(rootDir, '.standalone-tmp');
const tmpBuildOutDir = path.join(rootDir, '.standalone-out');
const distDir = path.join(rootDir, 'dist');
const legacyAppHtml = path.join(rootDir, 'app.html');
const legacyStandaloneDir = path.join(rootDir, 'standalone');
const withDist = process.argv.includes('--with-dist');

function createEntryHtmlTemplate() {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <title>ALEXYN — Learn · Explore · Excel</title>
    <meta name="description" content="Understand more. Memorise less. Think smarter. Your personal AI learning space with ChatGPT-style Explore, customizable Smart Notes, exam-focused Subjects & Languages, Practice Area, and community sharing." />
    <meta property="og:title" content="ALEXYN — Learn · Explore · Excel" />
    <meta property="og:description" content="Understand more. Memorise less. Think smarter. Your personal AI learning space." />
    <meta property="og:type" content="website" />
    <meta name="twitter:card" content="summary_large_image" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
  </head>
  <body class="bg-[#040A1A] text-[#F4F7FF] antialiased selection:bg-[#2E8BFF]/30 selection:text-white">
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
`;
}

const WEBVIEW_POLYFILL = `<script>
(function(){
  if(typeof AbortSignal!=='undefined'&&!AbortSignal.timeout){
    AbortSignal.timeout=function(ms){var c=new AbortController();setTimeout(function(){try{c.abort();}catch(e){}},ms);return c.signal;};
  }
  if(!Array.prototype.at){
    Object.defineProperty(Array.prototype,'at',{value:function(n){n=Math.trunc(n)||0;if(n<0)n+=this.length;if(n<0||n>=this.length)return undefined;return this[n];},configurable:true,writable:true});
  }
  if(typeof Object.hasOwn!=='function'){
    Object.hasOwn=function(obj,prop){return Object.prototype.hasOwnProperty.call(obj,prop);};
  }
})();
</script>`;

function normalizeWebViewCss(css) {
  return css
    .replace(/@media\s*\(\s*width\s*>=\s*([^)]+)\)/gi, '@media (min-width: $1)')
    .replace(/@media\s*\(\s*width\s*<=\s*([^)]+)\)/gi, '@media (max-width: $1)')
    .replace(/@media\s*\(\s*width\s*>\s*([^)]+)\)/gi, '@media (min-width: $1)')
    .replace(/@media\s*\(\s*width\s*<\s*([^)]+)\)/gi, '@media (max-width: $1)')
    .replace(/<\/style>/gi, '<\\/style>');
}

function prepareTmpEntryHtml() {
  fs.mkdirSync(tmpDir, { recursive: true });
  const tmpEntry = path.join(tmpDir, 'index.html');
  const html = createEntryHtmlTemplate().replace(
    'src="/src/main.tsx"',
    `src="${path.join(rootDir, 'src', 'main.tsx').replace(/\\/g, '/')}"`
  );
  fs.writeFileSync(tmpEntry, html, 'utf-8');
  return tmpEntry;
}

async function buildDistProduction(tmpEntry) {
  await build({
    root: rootDir,
    plugins: [react(), tailwindcss()],
    logLevel: 'warn',
    build: {
      outDir: distDir,
      emptyOutDir: true,
      rollupOptions: {
        input: tmpEntry,
      },
    },
  });

  // Vite places nested input under dist/.standalone-tmp/index.html; hoist cleanly to dist/index.html
  const nestedHtml = path.join(distDir, '.standalone-tmp', 'index.html');
  const distIndexHtml = path.join(distDir, 'index.html');
  if (fs.existsSync(nestedHtml)) {
    fs.renameSync(nestedHtml, distIndexHtml);
    fs.rmSync(path.join(distDir, '.standalone-tmp'), { recursive: true, force: true });
  }
}

async function buildSingleFileHtml(tmpEntry) {
  fs.rmSync(tmpBuildOutDir, { recursive: true, force: true });

  await build({
    root: rootDir,
    base: './',
    plugins: [react(), tailwindcss()],
    logLevel: 'warn',
    build: {
      outDir: tmpBuildOutDir,
      emptyOutDir: true,
      target: 'es2018',
      assetsInlineLimit: 100_000_000,
      cssCodeSplit: false,
      minify: 'esbuild',
      rollupOptions: {
        input: tmpEntry,
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

  const builtHtmlPath = fs.existsSync(path.join(tmpBuildOutDir, '.standalone-tmp', 'index.html'))
    ? path.join(tmpBuildOutDir, '.standalone-tmp', 'index.html')
    : path.join(tmpBuildOutDir, 'index.html');
  const builtJsPath = path.join(tmpBuildOutDir, 'bundle.js');
  const builtCssPath = path.join(tmpBuildOutDir, 'bundle.css');

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
  fs.rmSync(tmpBuildOutDir, { recursive: true, force: true });

  const sizeKb = (Buffer.byteLength(html, 'utf-8') / 1024).toFixed(1);
  console.log(`Built single-file frontend HTML: index.html (${sizeKb} KB)`);
}

async function main() {
  const tmpEntry = prepareTmpEntryHtml();
  try {
    if (withDist) {
      await buildDistProduction(tmpEntry);
    }
    await buildSingleFileHtml(tmpEntry);
    // Clean up obsolete duplicate frontend HTML files if any exist
    if (fs.existsSync(legacyAppHtml)) {
      fs.rmSync(legacyAppHtml, { force: true });
    }
    if (fs.existsSync(legacyStandaloneDir)) {
      fs.rmSync(legacyStandaloneDir, { recursive: true, force: true });
    }
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    fs.rmSync(tmpBuildOutDir, { recursive: true, force: true });
  }
}

main().catch((err) => {
  console.error('Build failed:', err);
  process.exit(1);
});
