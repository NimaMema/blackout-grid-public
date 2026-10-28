// Regenerates docs/screenshots/*.png. Optional tooling, not part of `npm test`.
// Needs Playwright with Chromium (`npm i --no-save playwright && npx playwright install chromium`) and:
//   LIVE   a Vite dev server proxying a running Java stack   (default http://localhost:5173)
//   HOSTED the Pages build served under /blackout-grid-public/ (default http://localhost:4173)
// Every "live" screenshot is taken in Live Java mode, so its numbers come from the real API.
import { resolve } from 'node:path';
import { chromium } from 'playwright';

const LIVE = process.env.LIVE || 'http://localhost:5173';
const HOSTED = process.env.HOSTED || 'http://localhost:4173/blackout-grid-public/';
const out = name => 'docs/screenshots/' + name + '.png';
const control = async (page, body) => page.evaluate(b => fetch('/api/control', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) }).then(r => r.json()), body);
const normal = { rate: 6, paused: false, delayMs: 260, workers: 4, gatewayDown: false };

const browser = await chromium.launch();
const desktop = await browser.newPage({ viewport: { width: 1440, height: 1290 } });

await desktop.goto(LIVE + '/?live=1');
await control(desktop, normal);
await desktop.waitForFunction(() => document.getElementById('mode-label').textContent === 'LIVE JAVA BACKEND');
await desktop.waitForTimeout(12000);
await desktop.screenshot({ path: out('01-live-city') });

await desktop.click('#nav-architecture');
await desktop.waitForTimeout(800);
await desktop.screenshot({ path: out('04-architecture') });
await desktop.click('#close-dialog');

await desktop.click('#all-events');
await desktop.waitForTimeout(1500);
await desktop.screenshot({ path: out('03-request-inspector') });
await desktop.click('#close-dialog');

await desktop.click('[data-district="queue"]');
await desktop.click('#worker-outage');
await desktop.click('#traffic-surge');
await desktop.waitForTimeout(9000);
await desktop.evaluate(() => window.scrollTo(0, 0));
await desktop.screenshot({ path: out('02-worker-blackout') });
await desktop.click('#recover-button');

const hosted = await browser.newPage({ viewport: { width: 1440, height: 1290 } });
await hosted.goto(HOSTED);
await hosted.waitForTimeout(8000);
await hosted.screenshot({ path: out('05-hosted-demo') });
await hosted.click('#mode-button');
await hosted.waitForTimeout(600);
await hosted.screenshot({ path: out('06-hosted-environment') });

const phone = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
await phone.goto(HOSTED);
await phone.waitForTimeout(6000);
await phone.screenshot({ path: out('07-mobile') });

await control(desktop, { ...normal, rate: 3 });

// Social preview and LinkedIn thumbnail: docs/portfolio/card.html framing the outage screenshot.
const card = 'file://' + resolve('docs/portfolio/card.html');
for (const [name, width, height, hash] of [['social-preview', 1280, 640, ''], ['linkedin-thumbnail', 1200, 627, '#linkedin']]) {
  const page = await browser.newPage({ viewport: { width, height } });
  await page.goto(card + hash);
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: 'docs/portfolio/' + name + '.png' });
}
await browser.close();
console.log('Screenshots written to docs/screenshots/ and docs/portfolio/.');
