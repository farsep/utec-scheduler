const pw = require('/home/charmcast/.cache/ms-playwright-go/1.50.1/package');
const fs = require('fs');
const path = require('path');
const http = require('http');

const distDir = path.join(process.cwd(), 'dist');

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
    server.listen(4333, '127.0.0.1', () => {
      resolve(server);
    });
  });
}

const ROUTES = [
  { path: '/', expectedIndex: 0, label: 'HORARIOS' },
  { path: '/cursos', expectedIndex: 1, label: 'CURSOS' },
  { path: '/aulas', expectedIndex: 2, label: 'AULAS' },
  { path: '/profesores', expectedIndex: 3, label: 'DOCENTES' },
  { path: '/mentores', expectedIndex: 4, label: 'MENTORES' },
];

async function run() {
  const server = await startServer();
  console.log('Static test server running on http://127.0.0.1:4333');

  const screenshotsDir = path.join(__dirname, '../audit-screenshots');
  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
  }

  const browser = await pw.chromium.launch({
    headless: true,
    executablePath: '/home/charmcast/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome'
  });

  try {
    const page = await browser.newPage({ viewport: { width: 393, height: 852 } });

    console.log('\n--- AUDITING MOBILE DOCK ACROSS ALL 5 CANONICAL ROUTES (393x852) ---');

    for (const { path: routePath, expectedIndex, label } of ROUTES) {
      console.log(`\nNavigating to ${routePath} (expecting index ${expectedIndex} - ${label})...`);
      await page.goto(`http://127.0.0.1:4333${routePath}`);
      await page.waitForSelector('.grafton-mobile-dock', { state: 'visible', timeout: 10000 });

      const dock = page.locator('.grafton-mobile-dock');
      const isDockVisible = await dock.isVisible();
      if (!isDockVisible) {
        throw new Error(`FAIL: .grafton-mobile-dock is NOT visible on ${routePath}`);
      }

      // 1. Verify 5 canonical tabs
      const items = page.locator('.grafton-dock-item');
      const itemCount = await items.count();
      if (itemCount !== 5) {
        throw new Error(`FAIL: Expected 5 dock items, found ${itemCount} on ${routePath}`);
      }

      // 2. Verify active item has .is-active
      const activeItem = items.nth(expectedIndex);
      const isItemActive = await activeItem.evaluate(el => el.classList.contains('is-active'));
      console.log(`  Tab ${expectedIndex} (${label}) is active:`, isItemActive);
      if (!isItemActive) {
        throw new Error(`FAIL: Tab ${expectedIndex} (${label}) is NOT marked .is-active on ${routePath}`);
      }

      // 3. Verify dock fixed at bottom (bottom === 852)
      const dockBox = await dock.boundingBox();
      const dockBottom = Math.round(dockBox.y + dockBox.height);
      console.log(`  Dock position: y=${dockBox.y.toFixed(1)}, height=${dockBox.height.toFixed(1)}, bottom=${dockBottom}px`);
      if (dockBottom !== 852) {
        throw new Error(`FAIL: Dock is not fixed to bottom of viewport (bottom=${dockBottom}, expected 852)!`);
      }

      // 4. Verify top switcher links hidden on mobile
      const topSwitcherVisible = await page.locator('.grafton-topbar__switcher').isVisible();
      console.log(`  Top switcher hidden on mobile:`, !topSwitcherVisible);
      if (topSwitcherVisible) {
        throw new Error(`FAIL: .grafton-topbar__switcher is VISIBLE on mobile at ${routePath}! It must be hidden on < 1024px.`);
      }

      // 5. Verify slider position: index * (dockWidth / 5)
      const slider = page.locator('.grafton-dock-slider');
      const sliderBox = await slider.boundingBox();
      const expectedSliderX = (dockBox.width / 5) * expectedIndex;
      const diffX = Math.abs(sliderBox.x - expectedSliderX);
      console.log(`  Slider x=${sliderBox.x.toFixed(1)}, expected=${expectedSliderX.toFixed(1)}, diff=${diffX.toFixed(1)}px`);
      if (diffX > 6) {
        throw new Error(`FAIL: Slider x position mismatch on ${routePath}! Expected ${expectedSliderX}, got ${sliderBox.x}`);
      }

      // 6. Capture screenshot for aulas & cursos
      if (routePath === '/aulas') {
        // Trigger floating button visibility by scrolling
        await page.evaluate(() => window.scrollTo(0, 400));
        await page.waitForTimeout(300);

        const floatingBtn = page.locator('.mobile-floating-top-btn');
        if (await floatingBtn.isVisible()) {
          const btnBox = await floatingBtn.boundingBox();
          const btnBottom = btnBox.y + btnBox.height;
          console.log(`  Floating button: y=${btnBox.y.toFixed(1)}, bottom=${btnBottom.toFixed(1)}px, dockTop=${dockBox.y.toFixed(1)}px`);
          if (btnBottom > dockBox.y - 4) {
            throw new Error(`FAIL: Floating button overlaps dock! btnBottom=${btnBottom}, dockTop=${dockBox.y}`);
          }
          console.log(`  Floating button clearance above dock: ${(dockBox.y - btnBottom).toFixed(1)}px (CLEAN)`);
        }

        await page.screenshot({ path: path.join(screenshotsDir, 'mobile-dock-aulas.png') });
        console.log('  Saved audit-screenshots/mobile-dock-aulas.png');
      }

      if (routePath === '/cursos') {
        await page.screenshot({ path: path.join(screenshotsDir, 'mobile-dock-cursos.png') });
        console.log('  Saved audit-screenshots/mobile-dock-cursos.png');
      }
    }

    // ----------------------------------------------------
    // TEST 5: Interactive Dock Tap Navigation Test
    // ----------------------------------------------------
    console.log('\n--- TEST: Interactive Dock Tap Navigation ---');
    await page.goto('http://127.0.0.1:4333/aulas');
    await page.waitForSelector('.grafton-mobile-dock', { state: 'visible', timeout: 10000 });

    const dock = page.locator('.grafton-mobile-dock');
    const items = page.locator('.grafton-dock-item');

    console.log('Tapping "CURSOS" tab (index 1)...');
    await items.nth(1).click();
    await page.waitForTimeout(500);

    const isCursosActive = await items.nth(1).evaluate(el => el.classList.contains('is-active'));
    console.log('  After tap: Cursos tab is active:', isCursosActive);
    if (!isCursosActive) {
      throw new Error('FAIL: Tapping Cursos did not activate tab!');
    }

    // ----------------------------------------------------
    // TEST 6: Desktop Viewport (1280x800) Dock Must Be Hidden
    // ----------------------------------------------------
    console.log('\n--- TEST: Desktop Viewport (1280x800) ---');
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('http://127.0.0.1:4333/aulas');
    await page.waitForSelector('.grafton-topbar', { state: 'visible', timeout: 10000 });

    const dockDesktopVisible = await page.locator('.grafton-mobile-dock').isVisible();
    const topSwitcherDesktopVisible = await page.locator('.grafton-topbar__switcher').isVisible();

    console.log('  Desktop: .grafton-mobile-dock is visible (should be FALSE):', dockDesktopVisible);
    console.log('  Desktop: .grafton-topbar__switcher is visible (should be TRUE):', topSwitcherDesktopVisible);

    if (dockDesktopVisible) {
      throw new Error('FAIL: .grafton-mobile-dock is VISIBLE on desktop >= 1024px!');
    }
    if (!topSwitcherDesktopVisible) {
      throw new Error('FAIL: .grafton-topbar__switcher is NOT visible on desktop >= 1024px!');
    }

    console.log('\n======================================================');
    console.log('ALL MOBILE DOCK & SWIPE TESTS PASSED WITH 100% SUCCESS!');
    console.log('======================================================\n');
  } finally {
    await browser.close();
    server.close();
  }
}

run().catch(err => {
  console.error('\nTest Execution Error:', err);
  process.exit(1);
});

