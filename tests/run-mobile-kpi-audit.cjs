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
    server.listen(4334, '127.0.0.1', () => {
      resolve(server);
    });
  });
}

async function run() {
  const server = await startServer();
  console.log('Static test server running on http://127.0.0.1:4334');

  const screenshotsDir = path.join(__dirname, '../audit-screenshots');
  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
  }

  const browser = await pw.chromium.launch({
    headless: true,
    executablePath: '/home/charmcast/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome'
  });

  try {
    // ----------------------------------------------------------------
    // TEST 1: iPhone 17 Pro Max Viewport (430x932) on /aulas
    // ----------------------------------------------------------------
    console.log('\n--- TEST 1: iPhone 17 Pro Max Viewport (430x932) on /aulas ---');
    const page = await browser.newPage({ viewport: { width: 430, height: 932 } });
    await page.goto('http://127.0.0.1:4334/aulas');
    await page.waitForSelector('.grafton-mobile-kpi-band', { state: 'visible', timeout: 10000 });

    const kpiBand = page.locator('.grafton-mobile-kpi-band');
    const isVisible = await kpiBand.isVisible();
    console.log('  KPI Band is visible:', isVisible);
    if (!isVisible) throw new Error('FAIL: .grafton-mobile-kpi-band is NOT visible on /aulas!');

    // 1. Assert borderRadius === 0px
    const borderRadius = await kpiBand.evaluate(el => window.getComputedStyle(el).borderRadius);
    console.log('  Border radius:', borderRadius);
    if (borderRadius !== '0px') {
      throw new Error(`FAIL: Expected borderRadius === 0px, got ${borderRadius}`);
    }

    // 2. Assert display matches 3-column split grid
    const grid = kpiBand.locator('.grafton-kpi-grid');
    const gridDisplay = await grid.evaluate(el => window.getComputedStyle(el).display);
    console.log('  Grid display:', gridDisplay);
    if (gridDisplay !== 'grid') {
      throw new Error(`FAIL: Expected display === grid, got ${gridDisplay}`);
    }

    const compartments = kpiBand.locator('.grafton-kpi-compartment');
    const count = await compartments.count();
    console.log('  Compartments count:', count);
    if (count !== 3) {
      throw new Error(`FAIL: Expected 3 compartments, got ${count}`);
    }

    // 3. Assert text labels render EXACTLY only "AULAS LIBRES", "ESPACIOS", and "PISOS UTEC"
    const labels = await kpiBand.locator('.grafton-kpi-label').allTextContents();
    const cleanLabels = labels.map(l => l.trim());
    console.log('  Rendered labels:', cleanLabels);
    const expected = ['AULAS LIBRES', 'ESPACIOS', 'PISOS UTEC'];
    if (JSON.stringify(cleanLabels) !== JSON.stringify(expected)) {
      throw new Error(`FAIL: Labels mismatch! Expected ${JSON.stringify(expected)}, got ${JSON.stringify(cleanLabels)}`);
    }

    // Confirm no leftover technical variables
    for (const label of cleanLabels) {
      if (label.includes('[') || label.includes(']') || label.includes('px') || label.includes('#')) {
        throw new Error(`FAIL: Leaked technical variable inside label: "${label}"`);
      }
    }

    // 4. Confirm horizontal panel doesn't trigger parent horizontal overflow
    const bodyScrollWidth = await page.evaluate(() => document.body.scrollWidth);
    const bodyClientWidth = await page.evaluate(() => document.body.clientWidth);
    console.log(`  Page width check: bodyScrollWidth=${bodyScrollWidth}, bodyClientWidth=${bodyClientWidth}`);
    if (bodyScrollWidth > bodyClientWidth + 1) {
      throw new Error(`FAIL: Horizontal page overflow detected! scrollWidth=${bodyScrollWidth} > clientWidth=${bodyClientWidth}`);
    }

    // 5. Take snapshot audit-screenshots/mobile-reimagined-kpis.png
    const snapshotPath = path.join(screenshotsDir, 'mobile-reimagined-kpis.png');
    await page.screenshot({ path: snapshotPath });
    console.log(`  Saved snapshot to ${snapshotPath}`);

    // ----------------------------------------------------------------
    // TEST 2: Verify all other pages (/profesores, /cursos, /mentores)
    // ----------------------------------------------------------------
    console.log('\n--- TEST 2: High-Density Band across /profesores, /cursos, /mentores ---');

    // /profesores
    console.log('Checking /profesores...');
    await page.goto('http://127.0.0.1:4334/profesores');
    await page.waitForSelector('.grafton-mobile-kpi-band', { state: 'visible', timeout: 10000 });
    const profLabels = await page.locator('.grafton-mobile-kpi-band .grafton-kpi-label').allTextContents();
    console.log('  /profesores labels:', profLabels.map(l => l.trim()));
    if (!profLabels.some(l => l.includes('DOCENTES'))) {
      throw new Error('FAIL: /profesores missing DOCENTES label!');
    }

    // /cursos
    console.log('Checking /cursos...');
    await page.goto('http://127.0.0.1:4334/cursos');
    await page.waitForSelector('.grafton-mobile-kpi-band', { state: 'visible', timeout: 10000 });
    const cursoLabels = await page.locator('.grafton-mobile-kpi-band .grafton-kpi-label').allTextContents();
    console.log('  /cursos labels:', cursoLabels.map(l => l.trim()));
    if (!cursoLabels.some(l => l.includes('CURSOS'))) {
      throw new Error('FAIL: /cursos missing CURSOS label!');
    }

    // /mentores
    console.log('Checking /mentores...');
    await page.goto('http://127.0.0.1:4334/mentores');
    await page.waitForSelector('.grafton-mobile-kpi-band', { state: 'visible', timeout: 10000 });
    const mentorLabels = await page.locator('.grafton-mobile-kpi-band .grafton-kpi-label').allTextContents();
    console.log('  /mentores labels:', mentorLabels.map(l => l.trim()));
    if (!mentorLabels.some(l => l.includes('MENTORES'))) {
      throw new Error('FAIL: /mentores missing MENTORES label!');
    }

    console.log('\n===============================================================');
    console.log('ALL MOBILE HIGH-DENSITY KPI TESTS PASSED WITH 100% SUCCESS!');
    console.log('===============================================================\n');
  } finally {
    await browser.close();
    server.close();
  }
}

run().catch(err => {
  console.error('\nTest Execution Error:', err);
  process.exit(1);
});

