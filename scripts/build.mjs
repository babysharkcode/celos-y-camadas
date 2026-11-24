// Compila la app a www/: empaqueta el JS con esbuild e inyecta la versión de package.json.
import { build } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync, rmSync, cpSync } from 'node:fs';

const { version } = JSON.parse(readFileSync('package.json', 'utf8'));
rmSync('www', { recursive: true, force: true });
mkdirSync('www', { recursive: true });

await build({
  entryPoints: ['src/app.js'],
  bundle: true,
  minify: true,
  format: 'iife',
  target: ['es2020', 'safari15', 'chrome90'],
  outfile: 'www/app.js',
  define: { __APP_VERSION__: JSON.stringify(version) },
});

cpSync('public', 'www', { recursive: true });
writeFileSync('www/index.html', readFileSync('src/index.html', 'utf8'));
writeFileSync('www/sw.js', readFileSync('public/sw.js', 'utf8').replace('__APP_VERSION__', version));
console.log(`www/ lista · v${version}`);
