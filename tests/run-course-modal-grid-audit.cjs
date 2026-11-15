const { chromium } = require('/home/charmcast/.npm/_npx/420ff84f11983ee5/node_modules/playwright');
const assert = require('assert');
const fs = require('fs');
const http = require('http');
const path = require('path');

const CHROMIUM_PATH = process.env.CHROMIUM_PATH || '/home/charmcast/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome';

function startDistServer(port = 4338) {
  const distDir = path.join(process.cwd(), 'dist');
  const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.wasm': 'application/wasm',
    '.woff2': 'font/woff2',
  };
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      let reqPath = (req.url || '/').split('?')[0];
      if (reqPath.endsWith('/')) reqPath += 'index.html';
      else if (!path.extname(reqPath)) reqPath += '/index.html';
      const filePath = path.join(distDir, reqPath);
      if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        const ext = path.extname(filePath).toLowerCase();
        res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
        fs.createReadStream(filePath).pipe(res);
      } else {
        res.writeHead(404);
        res.end('Not Found');
      }
    });
    server.listen(port, '127.0.0.1', () => resolve(server));
  });
}

async function run() {
  fs.mkdirSync(path.join(process.cwd(), 'audit-screenshots'), { recursive: true });
  const server = process.env.BASE_URL ? null : await startDistServer(4338);
  const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:4338';
  const browser = await chromium.launch({
    headless: true,
    executablePath: CHROMIUM_PATH,
  });

  try {
    // ================= 1. DESKTOP (1440x900) AUDIT =================
    const desktopCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await desktopCtx.newPage();

    const errors = [];
    page.on('pageerror', e => errors.push(e.message));

    await page.goto(`${BASE_URL}/cursos`, { waitUntil: 'networkidle' });

    const searchInput = page.locator('.course-filter-bar input.prof-search-input').first();
    await searchInput.waitFor({ state: 'visible', timeout: 15000 });
    await searchInput.fill('HH2101');

    const hhCard = page.locator('.course-finder-root .course-card', { hasText: 'HH2101' }).first();
    await hhCard.waitFor({ state: 'visible', timeout: 10000 });
    await hhCard.locator('.course-view-detail-btn').click();

    await page.waitForSelector('.course-modal-dialog', { state: 'visible', timeout: 10000 });
    await page.locator('.course-modal-tab-btn', { hasText: 'Malla Horaria' }).click();

    await page.waitForSelector('.course-timetable-container .prof-timetable-days-header-row', { state: 'visible', timeout: 10000 });
    await page.waitForSelector('.course-session-card', { state: 'visible', timeout: 10000 });

    // Capture full 10-section grid initial view before selecting a session
    await page.screenshot({ path: 'audit-screenshots/hh2101-malla-semanal-initial.png' });

    // Check section filter strip
    const filterStrip = page.locator('.course-sec-pills-strip');
    assert.strictEqual(await filterStrip.isVisible(), true, 'Section filter strip must be visible');
    assert.strictEqual(await filterStrip.locator('.course-sec-filter-pill', { hasText: 'TODAS' }).isVisible(), true);
    const s2Pill = filterStrip.locator('.course-sec-filter-pill', { hasText: /^S2$/ });
    assert.strictEqual(await s2Pill.isVisible(), true, 'S2 filter pill must be visible');

    // Click Sec. 2 (Lun 18:00 - 19:00, A701)
    const sec2LunBlock = page.locator('.course-session-card', { hasText: 'S02 · TEO 2' }).first();
    await sec2LunBlock.click();

    const inspector = page.locator('.course-swiss-inspector');
    await inspector.waitFor({ state: 'visible', timeout: 5000 });
    await page.waitForTimeout(400);

    // Assert sticky Day Header Row stays visible inside modal scroll viewport
    const stickyMetrics = await page.evaluate(() => {
      const body = document.querySelector('.course-modal-body--timetable');
      const header = document.querySelector('.course-timetable-container .prof-timetable-days-header-row');
      if (!body || !header) return null;
      const bRect = body.getBoundingClientRect();
      const hRect = header.getBoundingClientRect();
      const style = window.getComputedStyle(header);
      return {
        position: style.position,
        height: hRect.height,
        topDiffFromBody: hRect.top - bRect.top,
        bottomWithinBody: hRect.bottom <= bRect.bottom,
        headerText: header.innerText.trim(),
      };
    });
    assert(stickyMetrics, 'Sticky day header metrics must exist');
    assert.strictEqual(stickyMetrics.position, 'sticky', `Expected position:sticky, got ${stickyMetrics.position}`);
    assert(stickyMetrics.height > 28, `Header height too small: ${stickyMetrics.height}`);
    assert(stickyMetrics.topDiffFromBody >= -2, `Header clipped above body top: ${stickyMetrics.topDiffFromBody}`);
    assert(stickyMetrics.bottomWithinBody, 'Header must fit inside body');

    // Assert selected inspector SEC 02 badge is dark #18181A, #F2F0EC text, 0px radius (NO mint green!)
    const secBadge = inspector.locator('.inspector-sec-badge');
    assert.strictEqual((await secBadge.innerText()).trim(), 'SEC 02');
    const secBadgeStyles = await secBadge.evaluate(el => {
      const cs = window.getComputedStyle(el);
      return {
        bg: cs.backgroundColor,
        color: cs.color,
        radius: cs.borderRadius,
        borderLeftColor: cs.borderLeftColor,
      };
    });
    assert.strictEqual(secBadgeStyles.bg, 'rgb(24, 24, 26)', `Expected dark #18181A badge bg, got ${secBadgeStyles.bg}`);
    assert.strictEqual(secBadgeStyles.color, 'rgb(242, 240, 236)', `Expected #F2F0EC badge ink, got ${secBadgeStyles.color}`);
    assert.strictEqual(secBadgeStyles.radius, '0px', `Expected 0px radius, got ${secBadgeStyles.radius}`);
    assert.notStrictEqual(secBadgeStyles.borderLeftColor, 'rgb(24, 24, 26)', `Expected faculty polychrome left border accent, got ${secBadgeStyles.borderLeftColor}`);

    // Type compartment must be "TEORÍA 2" with NO "(Teoría)" parenthetical repeat
    const typeText = (await inspector.locator('.course-inspector-type-badge').innerText()).trim();
    assert.strictEqual(typeText, 'TEORÍA 2');
    assert(!typeText.includes('('), `Redundant parenthetical found in type: ${typeText}`);

    // Links must be high-contrast dark charcoal ink (no green/purple pastel text)
    const linkColors = await inspector.evaluate(() => {
      const room = document.querySelector('.course-inspector-room-link');
      const prof = document.querySelector('.course-inspector-prof-link');
      return {
        roomColor: room ? window.getComputedStyle(room).color : null,
        profColor: prof ? window.getComputedStyle(prof).color : null,
      };
    });
    assert.strictEqual(linkColors.roomColor, 'rgb(20, 20, 22)', `Room link color mismatch: ${linkColors.roomColor}`);
    assert.strictEqual(linkColors.profColor, 'rgb(20, 20, 22)', `Prof link color mismatch: ${linkColors.profColor}`);

    // Assert NO vertical overflow, NO horizontal truncation of section code, and NO "13:00 - 1..." truncation in ANY block
    const blockChecks = await page.evaluate(() => {
      const blocks = Array.from(document.querySelectorAll('.course-session-card'));
      const verticalOverflows = blocks
        .filter(el => el.scrollHeight > el.clientHeight + 2)
        .map(el => ({ text: el.innerText.replace(/\n/g, ' '), scrollH: el.scrollHeight, clientH: el.clientHeight }));
      const clippedSecCodes = Array.from(document.querySelectorAll('.course-session-card .course-card-block-sec'))
        .filter(el => el.scrollWidth > el.clientWidth + 2)
        .map(el => ({ text: el.innerText, scrollW: el.scrollWidth, clientW: el.clientWidth }));
      const truncatedTimeTexts = blocks
        .map(el => el.innerText)
        .filter(t => /13:00\s*-\s*1\b|-\s*1\.\.\./.test(t));
      return { total: blocks.length, verticalOverflows, clippedSecCodes, truncatedTimeTexts };
    });
    assert(blockChecks.total > 5, `Expected > 5 blocks, got ${blockChecks.total}`);
    assert.deepStrictEqual(blockChecks.verticalOverflows, [], `Found block vertical overflows: ${JSON.stringify(blockChecks.verticalOverflows)}`);
    assert.deepStrictEqual(blockChecks.clippedSecCodes, [], `Found clipped section codes: ${JSON.stringify(blockChecks.clippedSecCodes)}`);
    assert.deepStrictEqual(blockChecks.truncatedTimeTexts, [], `Found truncated time text: ${JSON.stringify(blockChecks.truncatedTimeTexts)}`);

    await page.screenshot({ path: 'audit-screenshots/hh2101-malla-semanal-fixed.png' });

    // Click [ S2 ] pill to test isolation
    await s2Pill.click();
    await page.waitForTimeout(250);
    const pillActiveBg = await s2Pill.evaluate(el => window.getComputedStyle(el).backgroundColor);
    assert.strictEqual(pillActiveBg, 'rgb(24, 24, 26)', `Expected #18181A active pill bg, got ${pillActiveBg}`);
    const visibleBlockCountAfterS2 = await page.locator('.course-session-card').count();
    assert.strictEqual(visibleBlockCountAfterS2, 2, `Expected 2 isolated blocks for Sec 2, got ${visibleBlockCountAfterS2}`);
    await page.screenshot({ path: 'audit-screenshots/hh2101-sec2-isolated.png' });

    assert.deepStrictEqual(errors, [], `Console/page errors: ${errors.join('; ')}`);
    await desktopCtx.close();

    // ================= 2. MOBILE (393x852) AUDIT =================
    const mobileCtx = await browser.newContext({ viewport: { width: 393, height: 852 } });
    const mPage = await mobileCtx.newPage();

    await mPage.goto(`${BASE_URL}/cursos`, { waitUntil: 'networkidle' });
    const mSearch = mPage.locator('.course-filter-bar input.prof-search-input').first();
    await mSearch.waitFor({ state: 'visible', timeout: 15000 });
    await mSearch.fill('HH2101');

    const mHhCard = mPage.locator('.course-finder-root .course-card', { hasText: 'HH2101' }).first();
    await mHhCard.waitFor({ state: 'visible', timeout: 10000 });
    await mHhCard.locator('.course-view-detail-btn').click();

    await mPage.waitForSelector('.course-modal-dialog', { state: 'visible', timeout: 10000 });
    await mPage.locator('.course-modal-tab-btn', { hasText: 'Malla Horaria' }).click();
    await mPage.waitForSelector('.course-session-card', { state: 'visible', timeout: 10000 });

    await mPage.locator('.course-session-card', { hasText: 'S02' }).first().click();
    await mPage.locator('.course-swiss-inspector').waitFor({ state: 'visible', timeout: 5000 });
    await mPage.waitForTimeout(350);

    const mobileChecks = await mPage.evaluate(() => {
      const blocks = Array.from(document.querySelectorAll('.course-session-card'));
      const verticalOverflows = blocks
        .filter(el => el.scrollHeight > el.clientHeight + 2)
        .map(el => ({ text: el.innerText.replace(/\n/g, ' '), scrollH: el.scrollHeight, clientH: el.clientHeight }));
      const clippedLabels = Array.from(
        document.querySelectorAll('.course-session-card .course-card-block-sec, .course-session-card .course-card-mobile-sub')
      )
        .filter(el => el.scrollWidth > el.clientWidth)
        .map(el => ({ cls: el.className, text: el.innerText, scrollW: el.scrollWidth, clientW: el.clientWidth }));
      const visibleNowPills = Array.from(document.querySelectorAll('.course-timetable-container .prof-now-line-pill'))
        .filter(el => window.getComputedStyle(el).display !== 'none')
        .length;
      const gridContainer = document.querySelector('.course-timetable-container');
      const gridOverflowX = gridContainer ? gridContainer.scrollWidth > gridContainer.clientWidth + 2 : false;
      const strip = document.querySelector('.course-inspector-meta-strip');
      const cols = strip ? window.getComputedStyle(strip).gridTemplateColumns.split(/\s+/).length : 0;
      const horizOverflow = document.documentElement.scrollWidth > document.documentElement.clientWidth + 1;
      return { verticalOverflows, clippedLabels, visibleNowPills, gridOverflowX, cols, horizOverflow };
    });
    assert.deepStrictEqual(mobileChecks.verticalOverflows, [], `Mobile block vertical overflows: ${JSON.stringify(mobileChecks.verticalOverflows)}`);
    assert.deepStrictEqual(mobileChecks.clippedLabels, [], `Mobile clipped card labels: ${JSON.stringify(mobileChecks.clippedLabels)}`);
    assert.strictEqual(mobileChecks.visibleNowPills, 0, `Expected AHORA pill hidden on 393px mobile, saw ${mobileChecks.visibleNowPills}`);
    assert.strictEqual(mobileChecks.gridOverflowX, false, 'Mobile timetable grid overflows horizontally');
    assert.strictEqual(mobileChecks.cols, 1, `Expected 1 col on mobile meta strip, got ${mobileChecks.cols}`);
    assert.strictEqual(mobileChecks.horizOverflow, false, 'Mobile horizontal overflow detected');

    await mPage.screenshot({ path: 'audit-screenshots/hh2101-malla-mobile-393.png' });
    await mobileCtx.close();

    console.log('ALL_CHECKS_PASSED', JSON.stringify({
      desktopBlocks: blockChecks.total,
      stickyPos: stickyMetrics.position,
      stickyTopDiff: stickyMetrics.topDiffFromBody,
      secBadgeStyles,
      typeText,
      linkColors,
      visibleBlockCountAfterS2,
      mobileCols: mobileChecks.cols,
    }, null, 2));
  } finally {
    await browser.close();
    if (server) server.close();
  }
}

run().catch(err => {
  console.error('AUDIT_FAILED:', err);
  process.exit(1);
});
