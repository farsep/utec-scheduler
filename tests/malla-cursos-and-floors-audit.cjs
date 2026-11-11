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
    server.listen(4332, '127.0.0.1', () => {
      resolve(server);
    });
  });
}

async function run() {
  const server = await startServer();
  console.log('Static test server running on http://127.0.0.1:4332');

  const screenshotsDir = path.join(__dirname, '../audit-screenshots');
  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
  }

  const browser = await pw.chromium.launch({
    headless: true,
    executablePath: '/home/charmcast/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome'
  });

  try {
    // ====================================================
    // TEST 1: /malla - Dedicated Malla Curricular & DAG Page
    // ====================================================
    console.log('\n--- TEST 1: /malla - Malla Curricular & 16 Carreras ---');
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    await page.goto('http://127.0.0.1:4332/malla');
    await page.waitForSelector('.curricular-dag-root', { timeout: 10000 });

    const isDagVisible = await page.locator('.curricular-dag-root').isVisible();
    const isCareersPanelVisible = await page.locator('.dag-careers-panel').isVisible();
    const isColumnsGridVisible = await page.locator('.dag-columns-grid').isVisible();
    const cycleColumnsCount = await page.locator('.dag-cycle-column').count();
    console.log('  DAG Root visible:', isDagVisible);
    console.log('  Careers Panel visible:', isCareersPanelVisible);
    console.log('  Columns Grid visible:', isColumnsGridVisible);
    console.log('  Cycle columns count:', cycleColumnsCount);

    if (!isDagVisible || !isCareersPanelVisible || !isColumnsGridVisible || cycleColumnsCount !== 10) {
      throw new Error(`FAIL: /malla did not render DAG components properly (cycles: ${cycleColumnsCount})!`);
    }

    // Check top bar active tab
    const mallaTopNavActive = await page.locator('.grafton-nav-btn.is-active').textContent();
    console.log('  Active TopBar Tab on /malla:', mallaTopNavActive?.trim());
    if (!mallaTopNavActive?.includes('Malla')) {
      throw new Error('FAIL: TopBar does not have Malla as active tab on /malla!');
    }

    await page.screenshot({ path: path.join(screenshotsDir, 'malla-desktop.png') });
    console.log('  Saved malla-desktop.png');

    // Mobile check for /malla
    await page.setViewportSize({ width: 393, height: 852 });
    await page.screenshot({ path: path.join(screenshotsDir, 'malla-mobile.png') });
    console.log('  Saved malla-mobile.png');

    // ====================================================
    // TEST 2: /cursos - Dedicated Course Catalog Page (ONLY Cursos)
    // ====================================================
    console.log('\n--- TEST 2: /cursos - Dedicated Offered Courses Catalog ---');
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('http://127.0.0.1:4332/cursos');
    await page.waitForSelector('.course-finder-root', { timeout: 10000 });

    const isCourseFinderVisible = await page.locator('.course-finder-root').isVisible();
    const isDagInCourses = await page.locator('.curricular-dag-root').isVisible();
    console.log('  Course Finder Root visible:', isCourseFinderVisible);
    console.log('  DAG Root visible in /cursos (should be FALSE):', isDagInCourses);

    if (!isCourseFinderVisible) {
      throw new Error('FAIL: /cursos did not render course finder catalog!');
    }
    if (isDagInCourses) {
      throw new Error('FAIL: /cursos renders DAG Root! It should be strictly for courses.');
    }

    const cursosTopNavActive = await page.locator('.grafton-nav-btn.is-active').textContent();
    console.log('  Active TopBar Tab on /cursos:', cursosTopNavActive?.trim());
    if (!cursosTopNavActive?.includes('Cursos')) {
      throw new Error('FAIL: TopBar does not have Cursos as active tab on /cursos!');
    }

    await page.screenshot({ path: path.join(screenshotsDir, 'cursos-desktop.png') });
    console.log('  Saved cursos-desktop.png');

    await page.setViewportSize({ width: 393, height: 852 });
    await page.screenshot({ path: path.join(screenshotsDir, 'cursos-mobile.png') });
    console.log('  Saved cursos-mobile.png');

    // ====================================================
    // TEST 3: /aulas - Campus Vertical (Piso por Piso, sin agrupar)
    // ====================================================
    console.log('\n--- TEST 3: /aulas - Campus Vertical Floor-by-Floor (No Grouping) ---');
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('http://127.0.0.1:4332/aulas?vista=pisos');
    await page.waitForSelector('.campus-floor-explorer', { timeout: 10000 });

    const floorBands = page.locator('.campus-floor-band');
    const floorBandCount = await floorBands.count();
    console.log(`  Found ${floorBandCount} architectural floor bands (expected: 10)`);

    if (floorBandCount !== 10) {
      throw new Error(`FAIL: Expected 10 single-floor bands, found ${floorBandCount}!`);
    }

    const titles = [];
    for (let i = 0; i < floorBandCount; i++) {
      const title = await floorBands.nth(i).locator('.campus-floor-band__title').textContent();
      titles.push(title?.trim());
    }
    console.log('  Floor Band Titles:');
    titles.forEach(t => console.log('   -', t));

    // Verify all 10 individual floors are present
    for (let f = 10; f >= 1; f--) {
      const expectedPrefix = `Piso ${f}`;
      const found = titles.some(t => t.startsWith(expectedPrefix));
      if (!found) {
        throw new Error(`FAIL: Missing single floor band for Piso ${f}!`);
      }
    }

    // Verify no multi-floor grouped titles exist
    const badTitles = ['Piso 8 & 9', 'Piso 6 & 7', 'Piso 4 & 5', 'Piso 1 al 3'];
    for (const bad of badTitles) {
      const foundBad = titles.some(t => t.includes(bad));
      if (foundBad) {
        throw new Error(`FAIL: Found grouped multi-floor title "${bad}"! User requested strictly piso por piso.`);
      }
    }
    console.log('  SUCCESS: Strictly piso por piso, 0 grouped multi-floor bands detected!');

    await page.locator('.campus-floor-explorer').scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(screenshotsDir, 'aulas-vertical-floors-desktop.png') });
    console.log('  Saved aulas-vertical-floors-desktop.png');

    await page.setViewportSize({ width: 393, height: 852 });
    await page.locator('.campus-floor-explorer').scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(screenshotsDir, 'aulas-vertical-floors-mobile.png') });
    console.log('  Saved aulas-vertical-floors-mobile.png');

    console.log('\n=============================================');
    console.log('ALL TESTS PASSED SUCCESSFULLY! 100% VERIFIED');
    console.log('=============================================\n');
  } finally {
    await browser.close();
    server.close();
  }
}

run().catch(err => {
  console.error('\nTest Execution Error:', err);
  process.exit(1);
});
