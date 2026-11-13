const pw = require('/home/charmcast/.npm/_npx/e41f203b7505f1fb/node_modules/playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const distDir = path.join(process.cwd(), 'dist');
const server = http.createServer((req, res) => {
  let reqPath = req.url.split('?')[0];
  if (reqPath.endsWith('/')) reqPath += 'index.html';
  else if (!path.extname(reqPath)) reqPath += '/index.html';
  const filePath = path.join(distDir, reqPath);
  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath);
    const mime =
      ext === '.html' ? 'text/html' :
      ext === '.js' ? 'application/javascript' :
      ext === '.css' ? 'text/css' :
      ext === '.svg' ? 'image/svg+xml' :
      ext === '.json' ? 'application/json' : 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': mime });
    fs.createReadStream(filePath).pipe(res);
  } else {
    res.writeHead(404);
    res.end('Not Found');
  }
});

(async () => {
  await new Promise(r => server.listen(4341, '127.0.0.1', r));
  const browser = await pw.chromium.launch({
    headless: true,
    executablePath: '/home/charmcast/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome'
  });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  try {
    await page.goto('http://127.0.0.1:4341/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(800);

    // Open Export Modal
    await page.locator('button.grafton-export-btn, button:has-text("Exportar")').first().click();
    await page.waitForTimeout(500);

    // Click Conectar to open Level-2 "Conectar a Google Calendar" Modal
    await page.locator('button:has-text("Conectar")').first().click();
    await page.waitForTimeout(1200);

    const gcalModal = page.locator('.grafton-gcal-modal');
    assert.strictEqual(await gcalModal.isVisible(), true, 'Google Calendar modal should be visible');

    // Capture screenshot
    const auditDir = path.resolve(process.cwd(), 'audit-screenshots');
    if (!fs.existsSync(auditDir)) fs.mkdirSync(auditDir, { recursive: true });
    const outPng = path.join(auditDir, 'modal-google-calendar-connect.png');
    await gcalModal.screenshot({ path: outPng });
    fs.copyFileSync(outPng, '/home/charmcast/.gemini/antigravity/brain/24f434e2-bf0f-4361-abbc-96cc52a1d046/modal-google-calendar-connect.png');

    // Also test expanding manual web intents & advanced OAuth Client ID to verify those states
    await page.locator('button:has-text("¿Prefieres agregar clases individualmente")').click();
    await page.waitForTimeout(400);
    await page.locator('button:has-text("Configuración avanzada")').click();
    await page.waitForTimeout(400);
    const expandedPng = '/home/charmcast/.gemini/antigravity/brain/24f434e2-bf0f-4361-abbc-96cc52a1d046/modal-google-calendar-expanded.png';
    await gcalModal.screenshot({ path: expandedPng });

    // Run programmatic Grafton Swiss assertions
    const auditResult = await gcalModal.evaluate((modal) => {
      const allElements = [modal, ...Array.from(modal.querySelectorAll('*'))];
      const nonZeroRadius = [];
      const gradientElements = [];
      const greenTexts = [];

      for (const el of allElements) {
        const style = window.getComputedStyle(el);
        if (style.borderRadius && style.borderRadius !== '0px') {
          nonZeroRadius.push(`${el.tagName}.${el.className}: ${style.borderRadius}`);
        }
        if (style.backgroundImage && style.backgroundImage.includes('linear-gradient')) {
          gradientElements.push(`${el.tagName}.${el.className}: ${style.backgroundImage}`);
        }
        if (
          style.color === 'rgb(16, 185, 129)' ||
          style.color === 'rgb(5, 150, 105)'
        ) {
          greenTexts.push(`${el.tagName}: ${style.color}`);
        }
      }

      const innerText = modal.innerText || '';
      const forbiddenEmojis = ['🎨', '🌈', '🔔', '⚙️', '🚫', '💡'];
      const foundEmojis = forbiddenEmojis.filter((emoji) => innerText.includes(emoji));

      return { nonZeroRadius, gradientElements, greenTexts, foundEmojis };
    });

    console.log('Audit Result:', JSON.stringify(auditResult, null, 2));
    assert.deepStrictEqual(auditResult.nonZeroRadius, [], 'Expected 0 elements with non-zero borderRadius');
    assert.deepStrictEqual(auditResult.gradientElements, [], 'Expected 0 elements with linear-gradient');
    assert.deepStrictEqual(auditResult.foundEmojis, [], 'Expected 0 forbidden emojis in innerText');
    assert.deepStrictEqual(auditResult.greenTexts, [], 'Expected 0 green helper texts');

    console.log('ALL GRAFTON SWISS GOOGLE CALENDAR MODAL ASSERTIONS PASSED!');
  } finally {
    await browser.close();
    server.close();
  }
})();

