const { chromium } = require('/home/charmcast/.npm/_npx/420ff84f11983ee5/node_modules/playwright');
const fs = require('fs');
const http = require('http');
const path = require('path');

const CHROMIUM_PATH =
  process.env.CHROMIUM_PATH ||
  '/home/charmcast/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome';

function startDistServer(port = 4340) {
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

async function scanVisualIntegrity(page, contextLabel, allFindings) {
  const result = await page.evaluate((label) => {
    const errors = [];

    // 1. Check for ANY raw browser-default blue link rgb(0, 0, 238)
    const links = Array.from(document.querySelectorAll('a'));
    for (const a of links) {
      const rect = a.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;
      const cs = window.getComputedStyle(a);
      if (cs.display === 'none' || cs.visibility === 'hidden') continue;
      if (cs.color === 'rgb(0, 0, 238)') {
        errors.push(`[${label}] Unstyled browser-default blue link (#0000EE): "${(a.textContent || '').trim()}" href=${a.getAttribute('href')}`);
      }
    }

    // 2. Check for glued text concatenation patterns
    const bodyText = document.body.innerText || '';
    const gluedPatterns = [
      /HORARIO(Lunes|Martes|Miércoles|Jueves|Viernes|Sábado)/i,
      /ESPACIO ASIGNADO[A-Za-z0-9]/i,
      /DOCENTE TITULAR[A-Za-z]/i,
      /TEO\s*\d+[A-Z]\d{3}/,
      /LAB\s*\d+[A-Z]\d{3}/,
      /S\d{2}[A-Z]\d{3}/,
    ];
    for (const pat of gluedPatterns) {
      const m = bodyText.match(pat);
      if (m) {
        errors.push(`[${label}] Glued text without spacing/layout separator detected: "${m[0]}"`);
      }
    }

    // 3. Check for leftover AI sparkles ✨ anywhere visible
    if (bodyText.includes('✨')) {
      errors.push(`[${label}] Leftover AI sparkle (✨) found on page`);
    }

    // 4. Horizontal overflow of root document
    if (document.documentElement.scrollWidth > document.documentElement.clientWidth + 2) {
      errors.push(
        `[${label}] Document horizontal overflow: scrollW=${document.documentElement.scrollWidth} clientW=${document.documentElement.clientWidth}`
      );
    }

    // 5. Contrast check across visible direct text nodes + low-contrast links + active dialog
    const parseRgb = (str) => {
      const m = str.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
      if (!m) return null;
      return [Number(m[1]), Number(m[2]), Number(m[3]), m[4] !== undefined ? Number(m[4]) : 1];
    };
    const relLum = ([r, g, b]) => {
      const lin = (c) => {
        const s = c / 255;
        return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
      };
      return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
    };
    const getEffectiveBg = (el) => {
      let cur = el;
      while (cur) {
        const parsed = parseRgb(getComputedStyle(cur).backgroundColor);
        if (parsed && parsed[3] > 0.2) return [parsed[0], parsed[1], parsed[2]];
        cur = cur.parentElement;
      }
      return [244, 243, 239];
    };

    const lowContrast = [];
    const clippedTextEls = [];
    const dialog = document.querySelector('[role="dialog"]');
    const scopeRoot = dialog || document.querySelector('main') || document.body;

    for (const el of Array.from(scopeRoot.querySelectorAll('*'))) {
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) < 0.2) continue;

      // Check contrast on leaf text nodes
      const hasDirectText = Array.from(el.childNodes).some(
        (n) => n.nodeType === Node.TEXT_NODE && (n.textContent || '').trim().length > 1
      );
      if (hasDirectText) {
        const fg = parseRgb(cs.color);
        if (fg) {
          const bg = getEffectiveBg(el);
          const l1 = relLum([fg[0], fg[1], fg[2]]);
          const l2 = relLum(bg);
          const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
          if (ratio < 2.6) {
            lowContrast.push({
              tag: el.tagName.toLowerCase(),
              cls: (el.className || '').toString().slice(0, 45),
              txt: (el.textContent || '').trim().slice(0, 25),
              fg: cs.color,
              bg: `rgb(${bg.join(',')})`,
              ratio: Number(ratio.toFixed(2)),
            });
          }
        }
      }

      // Check vertical clipping inside timetable cards / badges / buttons
      if (
        el.classList.contains('course-session-card') ||
        el.classList.contains('prof-session-block') ||
        el.classList.contains('course-card-block-sec') ||
        el.classList.contains('course-card-mobile-sub')
      ) {
        if (el.scrollHeight > el.clientHeight + 3) {
          clippedTextEls.push(
            `VCLIP:${el.className} (${el.scrollHeight}>${el.clientHeight}) "${el.innerText.replace(/\n/g, ' ').slice(0, 30)}"`
          );
        }
        if (
          (el.classList.contains('course-card-block-sec') || el.classList.contains('course-card-mobile-sub')) &&
          el.scrollWidth > el.clientWidth
        ) {
          clippedTextEls.push(
            `HCLIP:${el.className} (${el.scrollWidth}>${el.clientWidth}) "${el.innerText}"`
          );
        }
      }
    }

    if (lowContrast.length > 0) {
      errors.push(`[${label}] Low contrast text (${lowContrast.length}): ${JSON.stringify(lowContrast.slice(0, 4))}`);
    }
    if (clippedTextEls.length > 0) {
      errors.push(`[${label}] Clipped elements (${clippedTextEls.length}): ${JSON.stringify(clippedTextEls.slice(0, 4))}`);
    }

    // 6. Check dialog rounded corners (> 2px non-circle) inside active dialog
    if (dialog) {
      const dialogInner = dialog.querySelector('[class*="modal"]:not([class*="overlay"]):not([class*="backdrop"])') || dialog;
      const dRect = dialogInner.getBoundingClientRect();
      if (dRect.right > window.innerWidth + 2 || dRect.left < -2) {
        errors.push(`[${label}] Modal horizontally outside viewport: left=${Math.round(dRect.left)}, right=${Math.round(dRect.right)}, vw=${window.innerWidth}`);
      }
      // Check non-zero borderRadius on dialog interactive controls / cards (allow 999px/50% for status dots)
      const roundOffenders = [];
      for (const el of Array.from(dialogInner.querySelectorAll('*'))) {
        const rect = el.getBoundingClientRect();
        if (rect.width <= 14 && rect.height <= 14) continue; // status dots
        const cs = getComputedStyle(el);
        const br = parseFloat(cs.borderTopLeftRadius || '0');
        if (br > 2 && rect.width < 9999) {
          // Ignore SVG/circle knobs or explicit 50% dots
          if (!cs.borderRadius.includes('50%') && !cs.borderRadius.includes('999')) {
            roundOffenders.push(`${el.tagName.toLowerCase()}.${(el.className || '').toString().slice(0, 35)} radius=${cs.borderRadius}`);
          }
        }
      }
      if (roundOffenders.length > 0) {
        errors.push(`[${label}] Rounded (>2px) elements in dialog (${roundOffenders.length}): ${JSON.stringify(roundOffenders.slice(0, 4))}`);
      }
    }

    return errors;
  }, contextLabel);

  for (const err of result) {
    allFindings.push(err);
  }
}

async function watchLayoutStability(page, contextLabel, durationMs, allFindings) {
  const snapshots = [];
  const step = 150;
  const iterations = Math.ceil(durationMs / step);
  for (let i = 0; i < iterations; i++) {
    const snap = await page.evaluate(() => {
      const headerRow = document.querySelector('.prof-timetable-days-header-row');
      const jumpBar = document.querySelector('.course-day-jump-bar');
      const cols = Array.from(document.querySelectorAll('.prof-timetable-day-col-header')).map((c) => {
        const r = c.getBoundingClientRect();
        return `${c.textContent?.trim()}:${Math.round(r.width)}`;
      });
      const container = document.querySelector('.prof-timetable-container');
      const cRect = container ? container.getBoundingClientRect() : null;
      return {
        colCount: cols.length,
        hasJumpBar: Boolean(jumpBar && getComputedStyle(jumpBar).display !== 'none'),
        colsSig: cols.join('|'),
        gridW: cRect ? Math.round(cRect.width) : 0,
        gridH: cRect ? Math.round(cRect.height) : 0,
        headerTemplate: headerRow ? getComputedStyle(headerRow).gridTemplateColumns : '',
      };
    });
    snapshots.push(snap);
    await page.waitForTimeout(step);
  }

  const first = snapshots[0];
  for (let i = 1; i < snapshots.length; i++) {
    const cur = snapshots[i];
    if (
      cur.colCount !== first.colCount ||
      cur.hasJumpBar !== first.hasJumpBar ||
      Math.abs(cur.gridW - first.gridW) > 2 ||
      Math.abs(cur.gridH - first.gridH) > 2
    ) {
      allFindings.push(
        `[${contextLabel}] LAYOUT FLICKERING DETECTED at tick ${i * step}ms: baseline=${JSON.stringify(first)} vs tick=${JSON.stringify(cur)}`
      );
      break;
    }
  }
}

async function safeClick(locator, label, allFindings, timeout = 3000) {
  try {
    await locator.click({ timeout });
    return true;
  } catch (err) {
    allFindings.push(`[${label}] Click intercepted/failed: ${err.message.split('\n')[0]} | ${err.message.split('\n').find(l => l.includes('intercepts pointer')) || ''}`.trim());
    return false;
  }
}

async function run() {
  const server = await startDistServer(4340);
  const BASE_URL = 'http://127.0.0.1:4340';
  const browser = await chromium.launch({
    headless: true,
    executablePath: CHROMIUM_PATH,
  });

  const allFindings = [];
  const consoleErrors = [];
  const pageErrors = [];

  const viewports = [
    { name: 'mobile-375', width: 375, height: 812 },
    { name: 'mobile-412', width: 412, height: 915 },
    { name: 'tablet-800', width: 800, height: 1280 },
    { name: 'desktop-1440', width: 1440, height: 900 },
  ];

  try {
    for (const vp of viewports) {
      console.log(`\n=== Crawling viewport ${vp.name} (${vp.width}x${vp.height}) ===`);
      const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
      const page = await context.newPage();

      page.on('pageerror', (err) => pageErrors.push(`[${vp.name}] pageerror: ${err.message}`));
      page.on('console', (msg) => {
        if (msg.type() === 'error') {
          consoleErrors.push(`[${vp.name}] console.error: ${msg.text()}`);
        }
      });

      // ---------------- VIEW 1: / (Armador de Horarios) ----------------
      try {
        await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle' });
        await page.waitForTimeout(450);
        await scanVisualIntegrity(page, `${vp.name}:/ (initial)`, allFindings);

        // Open Export Modal
        const exportBtn = page.locator('button', { hasText: /Exportar/i }).first();
        if (await exportBtn.isVisible().catch(() => false)) {
          if (await safeClick(exportBtn, `${vp.name}:/ ExportBtn`, allFindings)) {
            await page.waitForTimeout(300);
            await scanVisualIntegrity(page, `${vp.name}:/ (ExportModal)`, allFindings);
            const gcalTab = page.locator('[role="dialog"] button', { hasText: /Google Calendar/i }).first();
            if (await gcalTab.isVisible().catch(() => false)) {
              if (await safeClick(gcalTab, `${vp.name}:/ GoogleCalendarBtn`, allFindings)) {
                await page.waitForTimeout(250);
                await scanVisualIntegrity(page, `${vp.name}:/ (GoogleCalendarModal)`, allFindings);
              }
            }
            await page.keyboard.press('Escape');
            await page.waitForTimeout(250);
          }
        }

        // Open Archivos Modal
        const uploadBtn = page.locator('button', { hasText: /Archivos|Subir|Datos/i }).first();
        if (await uploadBtn.isVisible().catch(() => false)) {
          if (await safeClick(uploadBtn, `${vp.name}:/ UploadBtn`, allFindings)) {
            await page.waitForTimeout(250);
            await scanVisualIntegrity(page, `${vp.name}:/ (FileUploadModal)`, allFindings);
            await page.keyboard.press('Escape');
            await page.waitForTimeout(250);
          }
        }

        // Open Generador / Quantum Optimizer Modal
        const optBtn = page.locator('button', { hasText: /Generador|Optimizar/i }).first();
        if (await optBtn.isVisible().catch(() => false)) {
          if (await safeClick(optBtn, `${vp.name}:/ OptimizerBtn`, allFindings)) {
            await page.waitForTimeout(300);
            await scanVisualIntegrity(page, `${vp.name}:/ (ScheduleOptimizerModal)`, allFindings);
            await page.keyboard.press('Escape');
            await page.waitForTimeout(250);
          }
        }
      } catch (e) {
        allFindings.push(`[${vp.name}:/] View crawl error: ${e.message.split('\n')[0]}`);
      }

      // ---------------- VIEW 2: /cursos ----------------
      try {
        await page.goto(`${BASE_URL}/cursos`, { waitUntil: 'networkidle' });
        await page.waitForSelector('.course-finder-root .course-card', { timeout: 15000 });
        await scanVisualIntegrity(page, `${vp.name}:/cursos (grid)`, allFindings);

        for (const courseCode of ['AD2011', 'HH2101']) {
          const searchIn = page.locator('.course-finder-root .course-filter-bar input.prof-search-input').first();
          await searchIn.fill(courseCode);
          await page.waitForTimeout(200);
          const card = page.locator('.course-finder-root .course-card', { hasText: courseCode }).first();
          if (await card.isVisible().catch(() => false)) {
            await safeClick(card.locator('.course-view-detail-btn'), `${vp.name}:/cursos/${courseCode} open`, allFindings);
            await page.waitForSelector('.course-modal-dialog', { timeout: 10000 });
            await page.waitForTimeout(250);
            await scanVisualIntegrity(page, `${vp.name}:/cursos/${courseCode} (Tab Secciones)`, allFindings);

            if (courseCode === 'HH2101') {
              const permBtn = page.locator('.course-permission-btn').first();
              if (await permBtn.isVisible().catch(() => false)) {
                if (await safeClick(permBtn, `${vp.name}:/cursos/${courseCode} PermBtn`, allFindings)) {
                  await page.waitForTimeout(250);
                  await scanVisualIntegrity(page, `${vp.name}:/cursos/${courseCode} (VisitorEmailModal)`, allFindings);
                  const backBtn = page.locator('button', { hasText: /Volver/i }).first();
                  if (await backBtn.isVisible().catch(() => false)) await safeClick(backBtn, `${vp.name}:/cursos/${courseCode} BackBtn`, allFindings);
                  await page.waitForTimeout(250);
                }
              }
            }

            await safeClick(page.locator('.course-modal-tab-btn', { hasText: 'Malla Horaria' }), `${vp.name}:/cursos/${courseCode} MallaTab`, allFindings);
            await page.waitForSelector('.course-session-card', { timeout: 10000 });
            await page.waitForTimeout(250);
            await scanVisualIntegrity(page, `${vp.name}:/cursos/${courseCode} (Malla Horaria Matriz)`, allFindings);

            await watchLayoutStability(page, `${vp.name}:/cursos/${courseCode} (Malla Horaria flicker check)`, 1200, allFindings);

            const firstBlock = page.locator('.course-session-card').first();
            if (await safeClick(firstBlock, `${vp.name}:/cursos/${courseCode} firstBlock`, allFindings)) {
              await page.waitForTimeout(250);
              await scanVisualIntegrity(page, `${vp.name}:/cursos/${courseCode} (Malla Inspector Open)`, allFindings);
            }

            const closeInsp = page.locator('.course-swiss-inspector .inspector-close-btn').first();
            if (await closeInsp.isVisible().catch(() => false)) {
              await safeClick(closeInsp, `${vp.name}:/cursos/${courseCode} closeInsp`, allFindings);
              await page.waitForTimeout(150);
            }

            const zoomToggle = page.locator('.course-days-filter-pill').first();
            if (await zoomToggle.isVisible().catch(() => false)) {
              if (await safeClick(zoomToggle, `${vp.name}:/cursos/${courseCode} zoomToggle`, allFindings)) {
                await page.waitForTimeout(250);
                await scanVisualIntegrity(page, `${vp.name}:/cursos/${courseCode} (Malla Zoom Mode)`, allFindings);
                await safeClick(zoomToggle, `${vp.name}:/cursos/${courseCode} zoomToggleOff`, allFindings);
                await page.waitForTimeout(150);
              }
            }

            const agendaBtn = page.locator('.course-timetable-toolbar button', { hasText: 'Agenda' }).first();
            if (await agendaBtn.isVisible().catch(() => false)) {
              if (await safeClick(agendaBtn, `${vp.name}:/cursos/${courseCode} agendaBtn`, allFindings)) {
                await page.waitForTimeout(250);
                await scanVisualIntegrity(page, `${vp.name}:/cursos/${courseCode} (Malla Agenda)`, allFindings);
              }
            }

            await safeClick(page.locator('.course-modal-close-btn'), `${vp.name}:/cursos/${courseCode} closeCourseModal`, allFindings);
            await page.waitForTimeout(260);
          }
        }
      } catch (e) {
        allFindings.push(`[${vp.name}:/cursos] View crawl error: ${e.message.split('\n')[0]}`);
      }

      // ---------------- VIEW 3: /aulas ----------------
      try {
        await page.goto(`${BASE_URL}/aulas`, { waitUntil: 'networkidle' });
        await page.waitForSelector('.classroom-finder-root .classroom-card', { timeout: 15000 });
        await scanVisualIntegrity(page, `${vp.name}:/aulas (directory)`, allFindings);

        const futsalCount = await page.evaluate(() => {
          const root = document.querySelector('.classroom-finder-root');
          const text = root ? root.innerText || '' : '';
          const card = document.querySelector('#room-card-FUTSAL');
          return { hasFutsalText: /\bfutsal\b/i.test(text), hasFutsalCard: Boolean(card) };
        });
        if (futsalCount.hasFutsalText || futsalCount.hasFutsalCard) {
          allFindings.push(`[${vp.name}:/aulas] FUTSAL still present in UTEC spaces: ${JSON.stringify(futsalCount)}`);
        }

        const floorsBtn = page.locator('.classroom-finder-root button', { hasText: /Por Pisos|Campus/i }).first();
        if (await floorsBtn.isVisible().catch(() => false)) {
          if (await safeClick(floorsBtn, `${vp.name}:/aulas floorsBtn`, allFindings)) {
            await page.waitForTimeout(300);
            await scanVisualIntegrity(page, `${vp.name}:/aulas (Por Pisos)`, allFindings);
            const dirBtn = page.locator('.classroom-finder-root button', { hasText: /Directorio|Lista|Buscador/i }).first();
            if (await dirBtn.isVisible().catch(() => false)) {
              await safeClick(dirBtn, `${vp.name}:/aulas dirBtn`, allFindings);
              await page.waitForTimeout(250);
            }
          }
        }

        const firstRoomCard = page.locator('.classroom-finder-root .classroom-card').first();
        if (await firstRoomCard.isVisible().catch(() => false)) {
          await safeClick(firstRoomCard, `${vp.name}:/aulas firstRoomCard`, allFindings);
          await page.waitForSelector('.classroom-modal', { timeout: 10000 });
          await page.waitForTimeout(300);
          await scanVisualIntegrity(page, `${vp.name}:/aulas (Modal day 1)`, allFindings);

          const modalDayTabs = page.locator('.classroom-modal .modal-day-tab');
          const tabCount = await modalDayTabs.count();
          for (let t = 0; t < Math.min(tabCount, 4); t++) {
            await safeClick(modalDayTabs.nth(t), `${vp.name}:/aulas modalDayTab${t}`, allFindings);
            await page.waitForTimeout(150);
            const occItem = page.locator('.classroom-modal .agenda-item--occupied').first();
            if (await occItem.isVisible().catch(() => false)) {
              await safeClick(occItem, `${vp.name}:/aulas modalOccItem`, allFindings);
              await page.waitForTimeout(200);
              await scanVisualIntegrity(page, `${vp.name}:/aulas (Modal occupied inspector)`, allFindings);
              break;
            }
          }
          await safeClick(page.locator('.classroom-modal .modal-close-btn'), `${vp.name}:/aulas closeRoomModal`, allFindings);
          await page.waitForTimeout(260);
        }
      } catch (e) {
        allFindings.push(`[${vp.name}:/aulas] View crawl error: ${e.message.split('\n')[0]}`);
      }

      // ---------------- VIEW 4: /profesores ----------------
      try {
        await page.goto(`${BASE_URL}/profesores`, { waitUntil: 'networkidle' });
        await page.waitForSelector('.professor-finder-root .professor-card, .prof-directory-root .professor-card', { timeout: 15000 });
        await scanVisualIntegrity(page, `${vp.name}:/profesores (directory)`, allFindings);

        const firstProfCard = page.locator('.professor-finder-root .professor-card, .prof-directory-root .professor-card').first();
        if (await firstProfCard.isVisible().catch(() => false)) {
          await safeClick(firstProfCard, `${vp.name}:/profesores firstProfCard`, allFindings);
          await page.waitForSelector('.prof-modal', { timeout: 10000 });
          await page.waitForTimeout(300);
          await scanVisualIntegrity(page, `${vp.name}:/profesores (Modal Horario)`, allFindings);
          await watchLayoutStability(page, `${vp.name}:/profesores (Timetable stability)`, 1000, allFindings);

          const profBlock = page.locator('.prof-modal .prof-session-block').first();
          if (await profBlock.isVisible().catch(() => false)) {
            await safeClick(profBlock, `${vp.name}:/profesores profBlock`, allFindings);
            await page.waitForTimeout(200);
            await scanVisualIntegrity(page, `${vp.name}:/profesores (Modal Block Inspector)`, allFindings);
          }

          const profAgendaBtn = page.locator('.prof-modal button', { hasText: /Por Día/i }).first();
          if (await profAgendaBtn.isVisible().catch(() => false)) {
            await safeClick(profAgendaBtn, `${vp.name}:/profesores profAgendaBtn`, allFindings);
            await page.waitForTimeout(200);
            await scanVisualIntegrity(page, `${vp.name}:/profesores (Modal Por Dia)`, allFindings);
          }

          const profCoursesTab = page.locator('.prof-modal .prof-modal-tab-btn', { hasText: /Cursos/i }).first();
          if (await profCoursesTab.isVisible().catch(() => false)) {
            await safeClick(profCoursesTab, `${vp.name}:/profesores profCoursesTab`, allFindings);
            await page.waitForTimeout(250);
            await scanVisualIntegrity(page, `${vp.name}:/profesores (Modal Tab Cursos)`, allFindings);
          }
          const profRoomsTab = page.locator('.prof-modal .prof-modal-tab-btn', { hasText: /Aulas/i }).first();
          if (await profRoomsTab.isVisible().catch(() => false)) {
            await safeClick(profRoomsTab, `${vp.name}:/profesores profRoomsTab`, allFindings);
            await page.waitForTimeout(250);
            await scanVisualIntegrity(page, `${vp.name}:/profesores (Modal Tab Aulas)`, allFindings);
          }
          await safeClick(page.locator('.prof-modal .modal-close-btn'), `${vp.name}:/profesores closeProfModal`, allFindings);
          await page.waitForTimeout(260);
        }
      } catch (e) {
        allFindings.push(`[${vp.name}:/profesores] View crawl error: ${e.message.split('\n')[0]}`);
      }

      // ---------------- VIEW 5: /mentores ----------------
      try {
        await page.goto(`${BASE_URL}/mentores`, { waitUntil: 'networkidle' });
        await page.waitForSelector('.mentor-finder-root .mentor-card, .mentor-directory-root .mentor-card', { timeout: 15000 });
        await scanVisualIntegrity(page, `${vp.name}:/mentores (directory)`, allFindings);

        const firstMentorCard = page.locator('.mentor-finder-root .mentor-card, .mentor-directory-root .mentor-card').first();
        if (await firstMentorCard.isVisible().catch(() => false)) {
          await safeClick(firstMentorCard, `${vp.name}:/mentores firstMentorCard`, allFindings);
          await page.waitForSelector('.prof-modal', { timeout: 10000 });
          await page.waitForTimeout(250);
          await scanVisualIntegrity(page, `${vp.name}:/mentores (Modal Horario)`, allFindings);

          const mentorTabs = page.locator('.prof-modal .prof-modal-tab-btn');
          const mTabCount = await mentorTabs.count();
          for (let t = 1; t < mTabCount; t++) {
            await safeClick(mentorTabs.nth(t), `${vp.name}:/mentores mentorTab${t}`, allFindings);
            await page.waitForTimeout(250);
            await scanVisualIntegrity(page, `${vp.name}:/mentores (Modal tab ${t})`, allFindings);
          }
          await safeClick(page.locator('.prof-modal .modal-close-btn'), `${vp.name}:/mentores closeMentorModal`, allFindings);
          await page.waitForTimeout(260);
        }
      } catch (e) {
        allFindings.push(`[${vp.name}:/mentores] View crawl error: ${e.message.split('\n')[0]}`);
      }

      // ---------------- VIEW 6: /malla ----------------
      try {
        await page.goto(`${BASE_URL}/malla`, { waitUntil: 'networkidle' });
        await page.waitForSelector('.curricular-dag-root', { timeout: 15000 });
        await page.waitForTimeout(300);
        await scanVisualIntegrity(page, `${vp.name}:/malla (DAG view)`, allFindings);

        const dagNode = page.locator('.dag-course-node, .dag-node-card').first();
        if (await dagNode.isVisible().catch(() => false)) {
          await safeClick(dagNode, `${vp.name}:/malla dagNode`, allFindings);
          await page.waitForTimeout(250);
          await scanVisualIntegrity(page, `${vp.name}:/malla (Selected node)`, allFindings);
        }
      } catch (e) {
        allFindings.push(`[${vp.name}:/malla] View crawl error: ${e.message.split('\n')[0]}`);
      }

      await context.close();
    }

    console.log('\n================ FORENSIC CRAWL SUMMARY ================');
    console.log(`Total visual/DOM findings: ${allFindings.length}`);
    console.log(`Total console errors: ${consoleErrors.length}`);
    console.log(`Total page errors: ${pageErrors.length}`);
    if (allFindings.length > 0) {
      console.log('\nFINDINGS:');
      allFindings.forEach((f, idx) => console.log(`${idx + 1}. ${f}`));
    }
    if (consoleErrors.length > 0) {
      console.log('\nCONSOLE ERRORS:');
      consoleErrors.forEach((e, idx) => console.log(`${idx + 1}. ${e}`));
    }
    if (pageErrors.length > 0) {
      console.log('\nPAGE ERRORS:');
      pageErrors.forEach((e, idx) => console.log(`${idx + 1}. ${e}`));
    }
    if (allFindings.length > 0 || pageErrors.length > 0) {
      process.exitCode = 1;
    } else {
      console.log('DEEP_FORENSIC_CRAWL_CLEAN');
    }
  } finally {
    await browser.close();
    server.close();
  }
}

run().catch((err) => {
  console.error('CRAWLER_CRASH:', err);
  process.exit(1);
});
