/**
 * Playwright end-to-end test for treehouse
 */
import { chromium } from 'playwright';
import { mkdir } from 'fs/promises';

const BASE = 'http://127.0.0.1:3999';
const CHROME = '/root/.cache/ms-playwright/chromium-1194/chrome-linux/chrome';
const SCREENSHOTS_DIR = '/home/user/treehouse/screenshots';

let passed = 0;
let failed = 0;
const errors = [];

function ok(label) { console.log(`  ✓ ${label}`); passed++; }
function fail(label, err) { console.log(`  ✗ ${label}: ${err}`); failed++; errors.push({ label, err: String(err) }); }

async function assert(label, fn) {
  try { await fn(); ok(label); }
  catch (e) { fail(label, e.message ?? e); }
}

await mkdir(SCREENSHOTS_DIR, { recursive: true });

const browser = await chromium.launch({
  headless: true,
  executablePath: CHROME,
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
});
const page = await browser.newPage();
await page.setViewportSize({ width: 1400, height: 900 });

const pageErrors = [];
page.on('console', msg => { if (msg.type() === 'error') pageErrors.push(msg.text()); });
page.on('pageerror', err => pageErrors.push(err.message));

console.log('\n=== treehouse browser test ===\n');

// ── 1. Page loads ──────────────────────────────────────────────────────────
console.log('[ Page Load ]');
await page.goto(BASE, { waitUntil: 'networkidle' });

await assert('page title is "treehouse"', async () => {
  const title = await page.title();
  if (title !== 'treehouse') throw new Error(`got "${title}"`);
});
await assert('sidebar is visible', async () => {
  await page.waitForSelector('.sidebar', { timeout: 5000 });
});
await assert('file tree renders', async () => {
  await page.waitForSelector('.file-tree', { timeout: 5000 });
});
await assert('tree has entries', async () => {
  const items = await page.$$('.tree-item');
  if (items.length === 0) throw new Error('no tree items');
});
await assert('empty state shown in editor area', async () => {
  await page.waitForSelector('.editor-empty', { timeout: 3000 });
});

await page.screenshot({ path: `${SCREENSHOTS_DIR}/01-initial-load.png` });
console.log('  📸 screenshot: 01-initial-load.png');

// ── 2. File tree ────────────────────────────────────────────────────────────
console.log('\n[ File Tree ]');
await assert('can expand src directory', async () => {
  const srcItem = page.locator('.tree-item', { hasText: 'src' }).first();
  await srcItem.click();
  await page.waitForSelector('.tree-children', { timeout: 3000 });
});
await assert('src children visible', async () => {
  const items = await page.$$('.tree-item');
  if (items.length < 3) throw new Error(`only ${items.length} items`);
});

await page.screenshot({ path: `${SCREENSHOTS_DIR}/02-tree-expanded.png` });
console.log('  📸 screenshot: 02-tree-expanded.png');

// ── 3. File open ────────────────────────────────────────────────────────────
console.log('\n[ File Open ]');
await assert('can click package.json', async () => {
  const pkgItem = page.locator('.tree-item', { hasText: 'package.json' }).first();
  await pkgItem.click();
  await page.waitForSelector('.editor-header', { timeout: 8000 });
});
await assert('editor header shows path', async () => {
  const path = await page.textContent('.editor-path');
  if (!path.includes('package.json')) throw new Error(`shows "${path}"`);
});
await assert('monaco editor loads (up to 20s)', async () => {
  await page.waitForSelector('.monaco-editor', { timeout: 20000 });
});
await assert('editor content is visible', async () => {
  await page.waitForSelector('.view-lines', { timeout: 5000 });
});

await page.screenshot({ path: `${SCREENSHOTS_DIR}/03-file-open-monaco.png` });
console.log('  📸 screenshot: 03-file-open-monaco.png');

// ── 4. Create new file ──────────────────────────────────────────────────────
console.log('\n[ Create File ]');
const testFileName = `test-${Date.now()}.txt`;

await assert('can create file via toolbar +📄', async () => {
  const newFileBtn = page.locator('.toolbar-btn', { hasText: '+📄' }).first();
  page.once('dialog', async dialog => dialog.accept(testFileName));
  await newFileBtn.click();
  await page.waitForTimeout(1000);
});
await assert('new file appears in tree', async () => {
  await page.waitForSelector(`.tree-item:has-text("${testFileName}")`, { timeout: 5000 });
});

// ── 5. Edit and save ─────────────────────────────────────────────────────────
console.log('\n[ Edit & Save ]');
const testContent = 'hello from treehouse playwright test';

await assert('open new file and type', async () => {
  const fileItem = page.locator('.tree-item', { hasText: testFileName }).first();
  await fileItem.click();
  await page.waitForSelector('.monaco-editor', { timeout: 20000 });
  await page.waitForTimeout(500);
  const editorArea = page.locator('.monaco-editor').first();
  await editorArea.click();
  await page.keyboard.type(testContent);
});
await assert('dirty indicator appears', async () => {
  await page.waitForSelector('.editor-dirty', { timeout: 3000 });
});

await page.screenshot({ path: `${SCREENSHOTS_DIR}/04-editing-file.png` });
console.log('  📸 screenshot: 04-editing-file.png');

await assert('save with button', async () => {
  const saveBtn = page.locator('.editor-save-btn');
  await saveBtn.click();
  await page.waitForFunction(() => !document.querySelector('.editor-dirty'), { timeout: 3000 });
});
await assert('notification shown after save', async () => {
  await page.waitForSelector('.notification', { timeout: 3000 });
});
await assert('server has correct content', async () => {
  const res = await fetch(`${BASE}/api/fs/read?path=${encodeURIComponent(testFileName)}`);
  const data = await res.json();
  if (!data.content.includes(testContent)) throw new Error(`content: "${data.content}"`);
});

await page.screenshot({ path: `${SCREENSHOTS_DIR}/05-saved.png` });
console.log('  📸 screenshot: 05-saved.png');

// ── 6. Context menu ──────────────────────────────────────────────────────────
console.log('\n[ Context Menu ]');
await assert('right-click shows context menu', async () => {
  const fileItem = page.locator('.tree-item', { hasText: testFileName }).first();
  await fileItem.click({ button: 'right' });
  await page.waitForSelector('.context-menu', { timeout: 3000 });
});
await assert('context menu has Delete', async () => {
  const btn = page.locator('.context-menu button.danger');
  const text = await btn.textContent();
  if (!text.includes('Delete')) throw new Error(`got "${text}"`);
});

await page.screenshot({ path: `${SCREENSHOTS_DIR}/06-context-menu.png` });
console.log('  📸 screenshot: 06-context-menu.png');

await page.locator('.context-overlay').click();
await page.waitForTimeout(300);

// ── 7. Delete ───────────────────────────────────────────────────────────────
console.log('\n[ Delete ]');
await assert('delete file via context menu', async () => {
  const fileItem = page.locator('.tree-item', { hasText: testFileName }).first();
  await fileItem.click({ button: 'right' });
  await page.waitForSelector('.context-menu', { timeout: 3000 });
  page.once('dialog', async dialog => dialog.accept());
  await page.locator('.context-menu button.danger').click();
  await page.waitForTimeout(1000);
});
await assert('file gone from tree', async () => {
  const items = await page.$$('.tree-item');
  const texts = await Promise.all(items.map(i => i.textContent()));
  if (texts.some(t => t.includes(testFileName))) throw new Error('still visible');
});
await assert('API returns 404', async () => {
  const res = await fetch(`${BASE}/api/fs/read?path=${encodeURIComponent(testFileName)}`);
  if (res.status !== 404) throw new Error(`got ${res.status}`);
});

// ── 8. Search ───────────────────────────────────────────────────────────────
console.log('\n[ Search ]');
await assert('search button opens input', async () => {
  await page.locator('.toolbar-btn', { hasText: '🔍' }).click();
  await page.waitForSelector('.toolbar-search input', { timeout: 3000 });
});
await assert('typing "cli" shows results', async () => {
  await page.fill('.toolbar-search input', 'cli');
  await page.waitForSelector('.search-result', { timeout: 3000 });
  const results = await page.$$('.search-result');
  if (results.length === 0) throw new Error('no results');
});
await assert('cli.ts result visible', async () => {
  await page.waitForSelector('.search-result:has-text("cli.ts")', { timeout: 3000 });
});

await page.screenshot({ path: `${SCREENSHOTS_DIR}/07-search.png` });
console.log('  📸 screenshot: 07-search.png');

// ── 9. Security ─────────────────────────────────────────────────────────────
console.log('\n[ Security ]');
await assert('path traversal blocked (403)', async () => {
  const res = await fetch(`${BASE}/api/fs/read?path=${encodeURIComponent('../../etc/passwd')}`);
  const data = await res.json();
  if (res.status !== 403 || !data.error.includes('traversal')) {
    throw new Error(`got ${res.status}: ${JSON.stringify(data)}`);
  }
});
await assert('write outside root blocked (403)', async () => {
  const res = await fetch(`${BASE}/api/fs/write`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path: '../../tmp/evil.txt', content: 'pwned' }),
  });
  if (res.status !== 403) throw new Error(`got ${res.status}`);
});

// ── 10. WebSocket ───────────────────────────────────────────────────────────
console.log('\n[ WebSocket ]');
await assert('WebSocket receives file events', async () => {
  const wsEvent = await page.evaluate(() => new Promise((resolve, reject) => {
    const ws = new WebSocket('ws://127.0.0.1:3999/ws');
    const t = setTimeout(() => reject(new Error('timeout')), 5000);
    ws.onopen = () => {
      fetch('/api/fs/write', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: '__ws_test__.txt', content: 'ws' }),
      });
    };
    ws.onmessage = e => { clearTimeout(t); ws.close(); resolve(JSON.parse(e.data)); };
    ws.onerror = () => reject(new Error('WS error'));
  }));
  if (!wsEvent.type || !wsEvent.path) throw new Error(`bad event: ${JSON.stringify(wsEvent)}`);
  await fetch(`${BASE}/api/fs/delete`, {
    method: 'DELETE', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path: '__ws_test__.txt' }),
  });
});

// ── 11. Console errors ──────────────────────────────────────────────────────
console.log('\n[ Page Health ]');
await assert('no critical console errors', async () => {
  const critical = pageErrors.filter(e => !e.includes('ResizeObserver') && !e.includes('favicon'));
  if (critical.length > 0) throw new Error(`errors:\n  ${critical.slice(0,3).join('\n  ')}`);
});

// Final screenshot
await page.fill('.toolbar-search input', '').catch(() => {});
await page.screenshot({ path: `${SCREENSHOTS_DIR}/08-final-state.png` });
console.log('  📸 screenshot: 08-final-state.png');

await browser.close();

console.log(`\n${'─'.repeat(40)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.log('\nFailed:');
  errors.forEach(({ label, err }) => console.log(`  ✗ ${label}\n    ${err}`));
  process.exit(1);
} else {
  console.log('\nAll tests passed! ✓');
}
