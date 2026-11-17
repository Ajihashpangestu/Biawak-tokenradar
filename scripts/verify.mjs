// Development verification only; the submitted program uses Node's standard library.
// Browser checks require playwright-core, supplied via PLAYWRIGHT_MODULE if not installed locally.
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { buildDossier } from '../vendor/makefun-board.ts';
const output = resolve(process.argv[2] || 'out');
const board = JSON.parse(readFileSync(join(output, 'board.json'))).rows;
const snapshot = JSON.parse(readFileSync(process.argv[3] || '/workspace/token-radar-01-kit/input/snapshot.json'));
assert(board.length >= 100 && board.length <= 4000);
assert.equal(new Set(board.map(r => r.slug)).size, board.length);
const known = new Set(snapshot.protocols.map(p => p.slug));
for (const slug of snapshot.watchlist) assert(board.some(r => r.slug === slug));
for (const [i, r] of board.entries()) {
  assert(known.has(r.slug)); assert.equal(r.rank, i + 1);
  assert(Number.isSafeInteger(r.implied_value_usd) && r.implied_value_usd > 0 && r.implied_value_usd <= 1e14);
  if (i) assert(board[i - 1].implied_value_usd >= r.implied_value_usd);
  assert(r.farm_steps.length >= 3 && r.farm_steps.length <= 12);
  for (const s of r.farm_steps) assert(s.trim().length >= 20 && s.trim().length <= 600);
}
assert.equal(readFileSync(join(output, 'dossier.json'), 'utf8'), buildDossier(output, {text_max_bytes: 65536}));
assert(statSync(join(output, 'dossier.json')).size <= 1572864);
assert.equal(readFileSync('vendor/makefun-board.ts', 'utf8'), readFileSync('/workspace/token-radar-01-kit/starter/vendor/makefun-board.ts', 'utf8'));
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright-core');
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/opt/hermes-browser/chromium-1208/chrome-linux64/chrome', headless: true, args: ['--no-sandbox'] });
try {
  const page = await browser.newPage({ viewport: {width: 1440, height: 1000}, deviceScaleFactor: 1 });
  const errors = [], remote = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('request', r => { if (/^https?:/.test(r.url())) remote.push(r.url()); });
  await page.goto(pathToFileURL(join(output, 'dashboard/index.html')).href);
  assert.equal(await page.locator('tbody tr').count(), board.length);
  assert.equal(await page.locator('tbody tr').first().locator('td').first().innerText(), '1');
  if (process.env.CAPTURE) await page.screenshot({path: 'screenshots/1-board.png'});
  await page.locator('tbody tr').first().click();
  assert(await page.locator('dialog').isVisible());
  assert.equal(await page.locator('.steps li').count(), board[0].farm_steps.length);
  assert((await page.locator('dialog').innerText()).includes(board[0].name));
  if (process.env.CAPTURE) await page.screenshot({path: 'screenshots/2-detail.png'});
  await page.keyboard.press('Escape');
  await page.locator('#q').pressSequentially('Solana');
  assert.equal(await page.locator('#q').inputValue(), 'Solana');
  assert(await page.locator('#q').evaluate(e => e === document.activeElement));
  assert(await page.locator('tbody tr').count() > 0);
  assert(await page.locator('tbody tr').count() < board.length);
  if (process.env.CAPTURE) await page.screenshot({path: 'screenshots/3-filtered.png'});
  await page.locator('#q').fill('no-such-protocol-xyz');
  assert(await page.getByText('No protocol matches that filter').isVisible());
  await page.getByRole('button', {name:'Clear filters'}).click();
  await page.getByRole('button', {name:'TVL', exact:true}).click();
  const tvls = await page.locator('tbody tr').evaluateAll(rows => rows.slice(0, 3).map(r => r.cells[2].textContent));
  assert(tvls.length === 3);
  await page.getByRole('button', {name:'Live token', exact:true}).click();
  assert.equal(await page.locator('tbody tr').count(), 24);
  await page.setViewportSize({width: 390, height: 844});
  assert(await page.locator('#q').isVisible());
  assert.deepEqual(errors, []); assert.deepEqual(remote, []);
  for (const file of readdirSync('screenshots')) assert(statSync(join('screenshots', file)).size <= 524288);
  console.log(`Verified ${board.length} rows, ${snapshot.watchlist.length} watchlist slugs, dossier identity, offline browser, search, filters, sorting controls, details, live view and mobile layout.`);
} finally { await browser.close(); }
