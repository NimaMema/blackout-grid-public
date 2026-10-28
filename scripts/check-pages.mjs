// Verifies a `npm run build:pages` output: every local URL in dist/index.html resolves to a
// built file under the Pages base path, and the hosted bundle carries the static-demo notice.
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const base = '/blackout-grid-public/';
const html = readFileSync('dist/index.html', 'utf8');
const failures = [];
for (const [, url] of html.matchAll(/(?:src|href)="([^"#]+)"/g)) {
  if (/^https?:/.test(url) || url === './') continue;
  const local = url.startsWith('/') ? url : base + url;
  if (!local.startsWith(base)) { failures.push(url + ' is outside ' + base); continue; }
  if (!existsSync(join('dist', local.slice(base.length)))) failures.push(url + ' is missing from dist/');
}
const bundles = readdirSync('dist/assets').filter(f => f.endsWith('.js'));
if (!bundles.some(f => readFileSync(join('dist/assets', f), 'utf8').includes('Hosted demo'))) {
  failures.push('the hosted-demo notice is missing: was the build run with --mode pages?');
}
if (failures.length) { console.error('Pages build check failed:\n- ' + failures.join('\n- ')); process.exit(1); }
console.log('Pages build check passed: ' + html.match(/(?:src|href)="/g).length + ' references verified.');
