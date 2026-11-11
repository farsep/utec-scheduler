const pw = require('/home/charmcast/.cache/ms-playwright-go/1.50.1/package');
const fs = require('fs');
const path = require('path');
const http = require('http');

const distDir = path.join(process.cwd(), 'dist');

// Start temporary static server on port 4331
function startServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      let reqPath = req.url.split('?')[0];
      if (reqPath.endsWith('/')) reqPath += 'index.html';
      else if (!path.extname(reqPath)) reqPath += '/index.html';
      const filePath = path.join(distDir, reqPath);
      if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        const ext = path.extname(filePath);
        const mime = ext === '.html' ? 'text/html' : ext === '.js' ? 'application/javascript' : ext === '.css' ? 'text/css' : 'application/octet-stream';
        res.writeHead(200, { 'Content-Type': mime });
        fs.createReadStream(filePath).pipe(res);
      } else {
        res.writeHead(404);
        res.end('Not Found');
      }
    });
    server.listen(4331, '127.0.0.1', () => {
      resolve(server);
    });
  });
}

async function run() {
  const server = await startServer();
  console.log('Static test server running on http://127.0.0.1:4331');

  const screenshotsDir = path.join(__dirname, '../audit-screenshots');
  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
  }

  const browser = await pw.chromium.launch({
    headless: true,
    executablePath: '/home/charmcast/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome'
  });

  try {
    // ----------------------------------------------------
    // TEST 1: Desktop (1280x800) View Switcher Audit
    // ----------------------------------------------------
    console.log('\n--- TEST 1: Desktop View Switcher Audit (1280x800) ---');
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    await page.goto('http://127.0.0.1:4331/aulas');
    await page.waitForSelector('.classroom-submode-bar', { timeout: 10000 });

    const dirBtn = page.locator('.classroom-submode-btn').first();
    const floorBtn = page.locator('.classroom-submode-btn').last();

    // 1. Verify default view is Directory (NOT floors)
    const isDirActive = await dirBtn.evaluate(el => el.classList.contains('is-active'));
    const isFloorActive = await floorBtn.evaluate(el => el.classList.contains('is-active'));
    console.log('Default: Directory tab active:', isDirActive);
    console.log('Default: Floors tab active:', isFloorActive);
    if (!isDirActive || isFloorActive) {
      throw new Error('Default view is NOT directory!');
    }

    const floorExplorerVisibleDefault = await page.locator('.campus-floor-explorer').isVisible();
    const cardsGridVisibleDefault = await page.locator('.classroom-cards-grid').first().isVisible();
    console.log('Default: campus-floor-explorer is visible:', floorExplorerVisibleDefault);
    console.log('Default: classroom-cards-grid is visible:', cardsGridVisibleDefault);

    if (floorExplorerVisibleDefault) {
      throw new Error('FAIL: campus-floor-explorer is visible by default! User requested floors should NOT be default.');
    }
    if (!cardsGridVisibleDefault) {
      throw new Error('FAIL: classroom-cards-grid is not visible by default in directory view!');
    }

    await page.screenshot({ path: path.join(screenshotsDir, 'submode-directory-desktop.png') });
    console.log('Saved submode-directory-desktop.png');

    // 2. Click "Campus Vertical" tab
    console.log('\nClicking "Campus Vertical Grafton Architects (Pisos y Niveles)"...');
    await floorBtn.click();
    await page.waitForSelector('.campus-floor-explorer', { state: 'visible', timeout: 5000 });

    const isDirActiveAfter = await dirBtn.evaluate(el => el.classList.contains('is-active'));
    const isFloorActiveAfter = await floorBtn.evaluate(el => el.classList.contains('is-active'));
    console.log('After switch: Directory tab active:', isDirActiveAfter);
    console.log('After switch: Floors tab active:', isFloorActiveAfter);
    if (isDirActiveAfter || !isFloorActiveAfter) {
      throw new Error('Floors tab is NOT active after clicking!');
    }

    const floorExplorerVisible = await page.locator('.campus-floor-explorer').isVisible();
    const cardsGridVisible = await page.locator('.classroom-cards-grid').isVisible();
    console.log('Floors view: campus-floor-explorer visible:', floorExplorerVisible);
    console.log('Floors view: classroom-cards-grid visible:', cardsGridVisible);

    if (!floorExplorerVisible) {
      throw new Error('FAIL: campus-floor-explorer is not visible after switching to floors view!');
    }
    if (cardsGridVisible) {
      throw new Error('FAIL: classroom-cards-grid is still visible in floors view!');
    }

    // Verify room chip click opens ClassroomDetailModal
    const firstRoomChip = page.locator('.campus-floor-explorer .campus-room-chip').first();
    await firstRoomChip.click();
    await page.waitForSelector('.classroom-modal', { state: 'visible', timeout: 5000 });
    console.log('Room modal opened successfully from floor chip!');
    await page.keyboard.press('Escape');
    await page.waitForSelector('.classroom-modal', { state: 'hidden', timeout: 5000 });
    console.log('Room modal closed.');

    await page.screenshot({ path: path.join(screenshotsDir, 'submode-floors-desktop.png') });
    console.log('Saved submode-floors-desktop.png');

    // 3. Switch back to Directory
    console.log('\nSwitching back to Directory view...');
    await dirBtn.click();
    await page.waitForSelector('.classroom-cards-grid', { state: 'visible', timeout: 5000 });
    console.log('Successfully switched back to directory view.');

    await page.close();

    // ----------------------------------------------------
    // TEST 2: Mobile (iPhone 17: 393x852)
    // ----------------------------------------------------
    console.log('\n--- TEST 2: Mobile View Switcher Audit (393x852) ---');
    const mobilePage = await browser.newPage({ viewport: { width: 393, height: 852 } });
    await mobilePage.goto('http://127.0.0.1:4331/aulas');
    await mobilePage.waitForSelector('.classroom-submode-bar', { timeout: 10000 });

    const mDirBtn = mobilePage.locator('.classroom-submode-btn').first();
    const mFloorBtn = mobilePage.locator('.classroom-submode-btn').last();

    // Verify default view is Directory
    const mDirActive = await mDirBtn.evaluate(el => el.classList.contains('is-active'));
    const mFloorExplorerVis = await mobilePage.locator('.campus-floor-explorer').isVisible();
    const mCardsGridVis = await mobilePage.locator('.classroom-cards-grid').first().isVisible();

    console.log('[Mobile] Default: Directory tab active:', mDirActive);
    console.log('[Mobile] Default: campus-floor-explorer visible:', mFloorExplorerVis);
    console.log('[Mobile] Default: cards grid visible:', mCardsGridVis);

    if (!mDirActive || mFloorExplorerVis || !mCardsGridVis) {
      throw new Error('[Mobile] Default view verification failed!');
    }

    await mobilePage.screenshot({ path: path.join(screenshotsDir, 'submode-directory-mobile.png') });
    console.log('Saved submode-directory-mobile.png');

    // Switch to Floors on Mobile
    console.log('[Mobile] Switching to Campus Vertical view...');
    await mFloorBtn.click();
    await mobilePage.waitForSelector('.campus-floor-explorer', { state: 'visible', timeout: 5000 });

    const mFloorExplorerVisAfter = await mobilePage.locator('.campus-floor-explorer').isVisible();
    console.log('[Mobile] campus-floor-explorer visible after switch:', mFloorExplorerVisAfter);
    if (!mFloorExplorerVisAfter) {
      throw new Error('[Mobile] campus-floor-explorer not visible after click!');
    }

    await mobilePage.screenshot({ path: path.join(screenshotsDir, 'submode-floors-mobile.png') });
    console.log('Saved submode-floors-mobile.png');

    await mobilePage.close();

    console.log('\n ALL SUBMODE VIEW SWITCHER TESTS PASSED WITH 100% SUCCESS!');
  } finally {
    await browser.close();
    server.close();
  }
}

run().catch((err) => {
  console.error('\n AUDIT FAILED:', err);
  process.exit(1);
});

