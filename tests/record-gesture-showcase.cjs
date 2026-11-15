const pw = require('/home/charmcast/.npm/_npx/e41f203b7505f1fb/node_modules/playwright');
const fs = require('fs');
const path = require('path');
const http = require('http');
const { execSync } = require('child_process');

const PORT = 4342;
const BASE_URL = `http://127.0.0.1:${PORT}`;
const OUT_DIR = path.resolve(process.cwd(), 'tour-videos');
const RAW_VIDEO_DIR = '/tmp/gesture_showcase_raw';
const DIST_DIR = path.resolve(process.cwd(), 'dist');
const CHROMIUM_EXECUTABLE = '/home/charmcast/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome';

function ensureDirs() {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
  if (!fs.existsSync(RAW_VIDEO_DIR)) fs.mkdirSync(RAW_VIDEO_DIR, { recursive: true });
}

function startStaticServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      let reqPath = decodeURIComponent((req.url || '/').split('?')[0]);
      if (reqPath.endsWith('/')) reqPath += 'index.html';
      else if (!path.extname(reqPath)) reqPath += '/index.html';
      const filePath = path.join(DIST_DIR, reqPath);
      if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        const ext = path.extname(filePath).toLowerCase();
        const mime =
          ext === '.html'
            ? 'text/html; charset=utf-8'
            : ext === '.js' || ext === '.mjs'
            ? 'application/javascript; charset=utf-8'
            : ext === '.css'
            ? 'text/css; charset=utf-8'
            : ext === '.svg'
            ? 'image/svg+xml'
            : ext === '.png'
            ? 'image/png'
            : ext === '.jpg' || ext === '.jpeg'
            ? 'image/jpeg'
            : ext === '.ico'
            ? 'image/x-icon'
            : ext === '.woff2'
            ? 'font/woff2'
            : ext === '.wasm'
            ? 'application/wasm'
            : ext === '.json'
            ? 'application/json; charset=utf-8'
            : 'application/octet-stream';
        res.writeHead(200, { 'Content-Type': mime });
        fs.createReadStream(filePath).pipe(res);
      } else {
        res.writeHead(404);
        res.end('Not Found');
      }
    });
    server.listen(PORT, '127.0.0.1', () => resolve(server));
  });
}

async function showGestureHUD(page, title, subtitle) {
  await page.evaluate(
    ({ title, subtitle }) => {
      let hud = document.getElementById('__gesture-hud');
      if (!hud) {
        hud = document.createElement('div');
        hud.id = '__gesture-hud';
        Object.assign(hud.style, {
          position: 'fixed',
          top: '12px',
          left: '50%',
          transform: 'translateX(-50%)',
          background: '#18181A',
          color: '#F4F2ED',
          border: '1.5px solid #18181A',
          borderLeft: '4px solid #00779E',
          fontFamily: "'JetBrains Mono', monospace",
          padding: '7px 14px',
          boxShadow: '4px 4px 0px rgba(24,24,26,0.32)',
          zIndex: '2147483646',
          maxWidth: '92vw',
          pointerEvents: 'none',
          transition: 'opacity 160ms ease',
        });
        document.body.appendChild(hud);
      }
      hud.innerHTML = `
        <div style="font-size:11px;font-weight:700;letter-spacing:0.04em;color:#38BDF8;text-transform:uppercase;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
          ${title}
        </div>
        ${
          subtitle
            ? `<div style="font-size:10px;color:#DCD9D2;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${subtitle}</div>`
            : ''
        }
      `;
    },
    { title, subtitle }
  );
}

/**
 * Draws pulsing 44px touch ring (#00779E) + dashed red vector trajectory arrow (#B8332A)
 * and dispatches genuine multi-step TouchEvents along cubic ease-out while animating!
 */
async function simulateVisualSwipe(page, x1, y1, x2, y2, durationMs = 560, opts = {}) {
  const mode = opts.mode || 'touch';
  const keepTrailMs = opts.keepTrailMs ?? 320;

  if (mode === 'mouse') {
    await page.evaluate(
      ({ x1, y1, x2, y2 }) => {
        const old = document.getElementById('__gesture-overlay');
        if (old) old.remove();
        const wrap = document.createElement('div');
        wrap.id = '__gesture-overlay';
        Object.assign(wrap.style, {
          position: 'fixed',
          inset: '0',
          pointerEvents: 'none',
          zIndex: '2147483645',
        });
        wrap.innerHTML = `
          <svg style="position:absolute;inset:0;width:100%;height:100%;overflow:visible;">
            <defs>
              <marker id="__gesture-arrow" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
                <polygon points="0 0, 8 4, 0 8" fill="#B8332A" />
              </marker>
            </defs>
            <line id="__gesture-line" x1="${x1}" y1="${y1}" x2="${x1}" y2="${y1}" stroke="#B8332A" stroke-width="2.5" stroke-dasharray="5 3" marker-end="url(#__gesture-arrow)" />
          </svg>
          <div id="__gesture-ring" style="position:fixed;left:${x1}px;top:${y1}px;width:44px;height:44px;border:2.5px solid #00779E;background:rgba(0,119,158,0.22);border-radius:9999px;transform:translate(-50%,-50%) scale(1);box-shadow:0 0 0 4px rgba(0,119,158,0.12);"></div>
        `;
        document.body.appendChild(wrap);
      },
      { x1, y1, x2, y2 }
    );

    await page.mouse.move(x1, y1);
    await page.mouse.down();
    const steps = Math.max(18, Math.round(durationMs / 20));
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const ease = 1 - Math.pow(1 - t, 3);
      const cx = x1 + (x2 - x1) * ease;
      const cy = y1 + (y2 - y1) * ease;
      await page.mouse.move(cx, cy);
      await page.evaluate(
        ({ cx, cy }) => {
          const line = document.getElementById('__gesture-line');
          const ring = document.getElementById('__gesture-ring');
          if (line) {
            line.setAttribute('x2', String(cx));
            line.setAttribute('y2', String(cy));
          }
          if (ring) {
            ring.style.left = `${cx}px`;
            ring.style.top = `${cy}px`;
          }
        },
        { cx, cy }
      );
      await page.waitForTimeout(Math.max(8, Math.round(durationMs / steps)));
    }
    await page.mouse.up();
    await page.waitForTimeout(keepTrailMs);
    await page.evaluate(() => document.getElementById('__gesture-overlay')?.remove());
    return;
  }

  // Touch path inside browser context at ~60fps using Touch + TouchEvent
  await page.evaluate(
    ({ x1, y1, x2, y2, durationMs, keepTrailMs }) => {
      return new Promise((resolve) => {
        const old = document.getElementById('__gesture-overlay');
        if (old) old.remove();

        const wrap = document.createElement('div');
        wrap.id = '__gesture-overlay';
        Object.assign(wrap.style, {
          position: 'fixed',
          inset: '0',
          pointerEvents: 'none',
          zIndex: '2147483645',
        });
        wrap.innerHTML = `
          <svg style="position:absolute;inset:0;width:100%;height:100%;overflow:visible;">
            <defs>
              <marker id="__gesture-arrow" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
                <polygon points="0 0, 8 4, 0 8" fill="#B8332A" />
              </marker>
            </defs>
            <line id="__gesture-line" x1="${x1}" y1="${y1}" x2="${x1}" y2="${y1}" stroke="#B8332A" stroke-width="2.5" stroke-dasharray="5 3" marker-end="url(#__gesture-arrow)" />
          </svg>
          <div id="__gesture-ring" style="position:fixed;left:${x1}px;top:${y1}px;width:44px;height:44px;border:2.5px solid #00779E;background:rgba(0,119,158,0.22);border-radius:9999px;transform:translate(-50%,-50%) scale(1.08);box-shadow:0 0 0 6px rgba(0,119,158,0.14);"></div>
        `;
        document.body.appendChild(wrap);

        const targetEl = document.elementFromPoint(x1, y1) || document.body;
        const makeTouch = (x, y) =>
          new Touch({
            identifier: 101,
            target: targetEl,
            clientX: x,
            clientY: y,
            pageX: x + window.scrollX,
            pageY: y + window.scrollY,
            screenX: x,
            screenY: y,
            radiusX: 14,
            radiusY: 14,
            force: 1,
          });

        const startTouch = makeTouch(x1, y1);
        targetEl.dispatchEvent(
          new TouchEvent('touchstart', {
            touches: [startTouch],
            targetTouches: [startTouch],
            changedTouches: [startTouch],
            bubbles: true,
            cancelable: true,
            composed: true,
          })
        );

        const line = document.getElementById('__gesture-line');
        const ring = document.getElementById('__gesture-ring');
        const t0 = performance.now();

        const step = () => {
          const elapsed = performance.now() - t0;
          const progress = Math.min(1, elapsed / Math.max(durationMs, 100));
          const ease = 1 - Math.pow(1 - progress, 3);
          const cx = x1 + (x2 - x1) * ease;
          const cy = y1 + (y2 - y1) * ease;

          if (line) {
            line.setAttribute('x2', String(cx));
            line.setAttribute('y2', String(cy));
          }
          if (ring) {
            ring.style.left = `${cx}px`;
            ring.style.top = `${cy}px`;
          }

          const moveTouch = makeTouch(cx, cy);
          targetEl.dispatchEvent(
            new TouchEvent('touchmove', {
              touches: [moveTouch],
              targetTouches: [moveTouch],
              changedTouches: [moveTouch],
              bubbles: true,
              cancelable: true,
              composed: true,
            })
          );

          if (progress < 1) {
            requestAnimationFrame(step);
          } else {
            const endTouch = makeTouch(x2, y2);
            targetEl.dispatchEvent(
              new TouchEvent('touchend', {
                touches: [],
                targetTouches: [],
                changedTouches: [endTouch],
                bubbles: true,
                cancelable: true,
                composed: true,
              })
            );
            setTimeout(() => {
              wrap.remove();
              resolve();
            }, keepTrailMs);
          }
        };

        requestAnimationFrame(step);
      });
    },
    { x1, y1, x2, y2, durationMs, keepTrailMs }
  );
}

async function simulateVisualTap(page, x, y, pulseCount = 1) {
  for (let i = 0; i < pulseCount; i++) {
    await page.evaluate(
      ({ x, y }) => {
        const ring = document.createElement('div');
        ring.style.cssText = `
          position:fixed;left:${x}px;top:${y}px;width:44px;height:44px;
          border:2.5px solid #00779E;background:rgba(0,119,158,0.24);
          border-radius:9999px;transform:translate(-50%,-50%) scale(0.85);
          pointer-events:none;z-index:2147483646;transition:transform 220ms ease, opacity 220ms ease;
        `;
        document.body.appendChild(ring);
        requestAnimationFrame(() => {
          ring.style.transform = 'translate(-50%,-50%) scale(1.22)';
        });
        setTimeout(() => {
          ring.style.opacity = '0';
          setTimeout(() => ring.remove(), 220);
        }, 180);
      },
      { x, y }
    );
    await page.touchscreen.tap(x, y);
    if (i < pulseCount - 1) await page.waitForTimeout(110);
  }
}

async function findSafePageSwipePoint(page) {
  return page.evaluate(() => {
    const candidatesY = [130, 180, 240, 320, 440, 560];
    const vw = window.innerWidth;
    for (const y of candidatesY) {
      const el = document.elementFromPoint(vw - 55, y);
      if (!el) continue;
      if (
        el.closest(
          'button, a, input, select, textarea, .course-card-swipe-container, .overflow-x-auto, .grafton-topbar__switcher, .grafton-mobile-dock'
        )
      ) {
        continue;
      }
      // Verify no horizontally scrollable parent
      let cur = el;
      let bad = false;
      while (cur && cur !== document.body) {
        if (cur.scrollWidth > cur.clientWidth + 4) {
          const ov = getComputedStyle(cur).overflowX;
          if (ov === 'auto' || ov === 'scroll') {
            bad = true;
            break;
          }
        }
        cur = cur.parentElement;
      }
      if (!bad) return { x1: vw - 55, x2: 55, y };
    }
    return { x1: vw - 60, x2: 60, y: 140 };
  });
}

async function recordMobileShowcase(browser) {
  console.log('\n[Mobile 430x932] Recording Scenes 1–3...');
  const context = await browser.newContext({
    viewport: { width: 430, height: 932 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 2,
    recordVideo: { dir: RAW_VIDEO_DIR, size: { width: 430, height: 932 } },
  });
  const page = await context.newPage();

  let output = null;
  let succeeded = false;
  try {
    await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle' });
    await page.waitForSelector('.schedule-block', { timeout: 15000 });
    await page.waitForTimeout(500);

    // =========================================================================
    // SCENE 1: Elastic Page-Swipe & Polychrome Dock Scrubbing
    // =========================================================================
    await showGestureHUD(
      page,
      'GESTURE 01 // ELASTIC PAGE SWIPE',
      'Desliza horizontalmente para navegar con dock policromático 1:1'
    );
    await page.waitForTimeout(600);

    // Swipe Left Horarios -> Cursos -> Aulas -> Docentes
    const targetSeq = ['courses', 'classrooms', 'professors'];
    for (const expectedModule of targetSeq) {
      const pt = await findSafePageSwipePoint(page);
      await simulateVisualSwipe(page, pt.x1, pt.y, pt.x2, pt.y, 520, { keepTrailMs: 260 });
      await page.waitForTimeout(650);
      const activeDock = await page.locator('.grafton-mobile-dock').getAttribute('data-active-dock');
      console.log(`  Page swipe -> active dock module: ${activeDock} (expected ${expectedModule})`);
      if (activeDock !== expectedModule) {
        // Fallback direct dock click if an interstitial container intercepted touchstart
        await page.locator(`.grafton-dock-item[data-dock-module="${expectedModule}"]`).tap();
        await page.waitForTimeout(450);
      }
    }

    // Gesture 02: Magnetic Thumb-Scrubbing Across the Bottom Dock -> back to Cursos
    await showGestureHUD(
      page,
      'GESTURE 02 // MAGNETIC DOCK THUMB-SCRUBBING',
      'Arrastra el pulgar sobre el dock con indicador flotante [ MÓDULO ]'
    );
    await page.waitForTimeout(450);
    const dockBox = await page.locator('.grafton-mobile-dock').boundingBox();
    if (dockBox) {
      const dockY = dockBox.y + dockBox.height / 2;
      const docX = dockBox.x + dockBox.width * 0.7; // Docentes
      const curX = dockBox.x + dockBox.width * 0.3; // Cursos
      await simulateVisualSwipe(page, docX, dockY, curX, dockY, 850, { keepTrailMs: 360 });
      await page.waitForTimeout(650);
      const afterScrub = await page.locator('.grafton-mobile-dock').getAttribute('data-active-dock');
      console.log(`  Dock scrub -> active dock module: ${afterScrub} (expected courses)`);
    }

    // =========================================================================
    // SCENE 2: Course Card Swipe Actions & Modal Drag-to-Dismiss on /cursos
    // =========================================================================
    await page.waitForSelector('.course-card-swipe-container .course-card', { timeout: 15000 });
    await page.locator('.course-card-swipe-container').first().evaluate((el) => {
      el.scrollIntoView({ behavior: 'instant', block: 'center' });
    });
    await page.waitForTimeout(450);

    await showGestureHUD(
      page,
      'GESTURE 03 // SWIPE RIGHT → MODO OYENTE',
      'Desliza derecha en /cursos para guardar ★ OYENTE'
    );
    const firstCard = page.locator('.course-card-swipe-container .course-card').first();
    const firstCardBox = await firstCard.boundingBox();
    if (firstCardBox) {
      const midY = firstCardBox.y + firstCardBox.height * 0.6;
      await simulateVisualSwipe(
        page,
        firstCardBox.x + 56,
        midY,
        firstCardBox.x + Math.min(280, firstCardBox.width - 30),
        midY,
        620,
        { keepTrailMs: 420 }
      );
      await page.waitForTimeout(900);
      console.log('  Course card swipe right completed (★ OYENTE).');

      await showGestureHUD(
        page,
        'GESTURE 04 // SWIPE LEFT → INSPECCIONAR HORARIO',
        'Desliza izquierda para abrir modal de secciones'
      );
      await page.waitForTimeout(450);
      await page.locator('.course-card-swipe-container').first().evaluate((el) => {
        el.scrollIntoView({ behavior: 'instant', block: 'center' });
      });
      await page.waitForTimeout(200);
      const cardBox2 = await firstCard.boundingBox();
      if (cardBox2) {
        const midY2 = cardBox2.y + cardBox2.height * 0.6;
        await simulateVisualSwipe(
          page,
          cardBox2.x + cardBox2.width - 56,
          midY2,
          cardBox2.x + 36,
          midY2,
          620,
          { keepTrailMs: 300 }
        );
      }
      await page.waitForSelector('.course-modal-dialog', { timeout: 8000 });
      console.log('  Course card swipe left opened .course-modal-dialog.');
      await page.waitForTimeout(750);

      await showGestureHUD(
        page,
        'GESTURE 05 // BOTTOM-SHEET DRAG-TO-DISMISS',
        'Arrastra hacia abajo el handle superior para cerrar'
      );
      await page.waitForTimeout(450);
      const headerBox = await page.locator('.course-modal-header').boundingBox();
      if (headerBox) {
        const hx = headerBox.x + headerBox.width / 2;
        const hy = headerBox.y + 18;
        await simulateVisualSwipe(page, hx, hy, hx, hy + 210, 620, { keepTrailMs: 320 });
        await page.waitForTimeout(750);
        console.log('  Bottom-sheet drag-to-dismiss executed.');
      }
    }

    // =========================================================================
    // SCENE 3: Timetable Micro-Tickets, Tap-to-Inspect & Double-Tap Day Zoom
    // =========================================================================
    const dockBox2 = await page.locator('.grafton-mobile-dock').boundingBox();
    if (dockBox2) {
      await simulateVisualTap(page, dockBox2.x + dockBox2.width * 0.1, dockBox2.y + dockBox2.height / 2, 1);
      await page.waitForTimeout(750);
    } else {
      await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle' });
    }
    await page.waitForSelector('.schedule-block', { timeout: 10000 });
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
    await page.waitForTimeout(250);

    await showGestureHUD(
      page,
      'GESTURE 06 // MICRO-TICKET TAP-TO-INSPECT',
      'Toca un micro-ticket en Semana para ver nombre, tipo y aula'
    );
    await page.waitForTimeout(450);

    const firstBlock = page.locator('.schedule-block').first();
    await firstBlock.scrollIntoViewIfNeeded();
    const blockBox = await firstBlock.boundingBox();
    if (blockBox) {
      await simulateVisualTap(page, blockBox.x + blockBox.width / 2, blockBox.y + blockBox.height / 2, 1);
      await page.waitForSelector('[data-testid="mobile-course-inspector-strip"]', { timeout: 5000 });
      console.log('  Micro-ticket tap opened mobile-course-inspector-strip.');
      await page.waitForTimeout(1050);
    }

    await showGestureHUD(
      page,
      'GESTURE 07 // DOUBLE-TAP DAY ZOOM (SEMANA ↔ DÍA)',
      'Doble toque en columna Martes para expandir Vista Día y volver'
    );
    await page.waitForTimeout(450);

    const tueHeader = await page.locator('[data-day-col="Mar"].day-col-header').first().boundingBox();
    if (tueHeader) {
      const tx = tueHeader.x + tueHeader.width / 2;
      const ty = tueHeader.y + tueHeader.height / 2;
      await simulateVisualTap(page, tx, ty, 2);
      await page.waitForTimeout(1150);

      // Double tap again inside single-day header or canvas to zoom back out to Semana
      const expandedCol = await page.locator('[data-day-col="Mar"].day-column-canvas').first().boundingBox();
      if (expandedCol) {
        await simulateVisualTap(page, expandedCol.x + expandedCol.width / 2, expandedCol.y + 42, 2);
        await page.waitForTimeout(950);
      }
    }
    succeeded = true;
    console.log('  Completed Mobile Scenes 1–3 cleanly (page swipe, dock scrub, card swipe, bottom-sheet drag, micro-ticket inspector, double-tap day zoom).');
  } finally {
    const video = page.video();
    await page.close();
    await context.close();
    if (video) {
      try {
        const outWebm = path.join(OUT_DIR, 'gesture-showcase-mobile.webm');
        const outMp4 = path.join(OUT_DIR, 'gesture-showcase-mobile.mp4');
        await video.saveAs(outWebm);
        execSync(
          `ffmpeg -y -i "${outWebm}" -c:v libx264 -pix_fmt yuv420p -r 30 -preset fast -crf 21 -movflags +faststart "${outMp4}"`,
          { stdio: 'ignore' }
        );
        console.log(`  Exported ${outMp4}`);
        output = { outWebm, outMp4 };
      } catch (videoErr) {
        if (succeeded) throw videoErr;
      }
    }
  }
  return output;
}

async function recordDesktopShowcase(browser) {
  console.log('\n[Desktop 1440x900] Recording Scenes 4–5...');
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    isMobile: false,
    hasTouch: false,
    deviceScaleFactor: 1,
    recordVideo: { dir: RAW_VIDEO_DIR, size: { width: 1440, height: 900 } },
  });
  const page = await context.newPage();

  let output = null;
  let succeeded = false;
  try {
    // =========================================================================
    // SCENE 4: 10-Cycle Curricular DAG Grab-to-Pan & Fit-to-Screen Zoom
    // =========================================================================
    await page.goto(`${BASE_URL}/malla`, { waitUntil: 'networkidle' });
    await page.waitForSelector('#dag-scroll-container', { timeout: 15000 });
    await page.waitForTimeout(600);

    await showGestureHUD(
      page,
      'GESTURE 08 // 2D CANVAS GRAB-TO-PAN & FIT ZOOM',
      'Arrastra el grafo curricular de 10 ciclos con inercia y ajusta vista (72%)'
    );
    await page.waitForTimeout(550);

    const dagBox = await page.locator('#dag-scroll-container').boundingBox();
    if (dagBox) {
      const panY = dagBox.y + Math.min(260, dagBox.height / 2);
      await simulateVisualSwipe(page, dagBox.x + 980, panY, dagBox.x + 280, panY, 680, {
        mode: 'mouse',
        keepTrailMs: 360,
      });
      await page.waitForTimeout(750);
    }

    const fitBtn = page.locator('[data-testid="dag-zoom-fit"]');
    const fitBox = await fitBtn.boundingBox();
    if (fitBox) {
      await page.mouse.move(fitBox.x + fitBox.width / 2, fitBox.y + fitBox.height / 2, { steps: 10 });
      await fitBtn.click();
      await page.waitForTimeout(1350);
    }
    console.log('  Completed Desktop Scene 4 cleanly (Curricular DAG grab-to-pan + 72% fit zoom).');

    // =========================================================================
    // SCENE 5: Command Palette (⌘K) -> A908 + Quantum Engine Cycling (←/→/J/K)
    // =========================================================================
    await showGestureHUD(
      page,
      'GESTURE 09 // UNIVERSAL COMMAND PALETTE (⌘K)',
      'Búsqueda global instantánea en 420 cursos, 392 docentes, 100 aulas y 16 mallas'
    );
    await page.waitForTimeout(550);

    await page.keyboard.press('Control+k');
    await page.waitForSelector('[data-testid="cmdk-input"]', { timeout: 6000 });
    await page.type('[data-testid="cmdk-input"]', 'Algoritmos', { delay: 75 });
    await page.waitForTimeout(800);

    await page.fill('[data-testid="cmdk-input"]', '');
    await page.type('[data-testid="cmdk-input"]', 'A908', { delay: 85 });
    await page.waitForTimeout(700);
    await page.keyboard.press('Enter');

    await page.waitForSelector('.classroom-modal', { timeout: 10000 });
    await page.waitForTimeout(1450);

    // Close modal & jump to / Horarios for Quantum Engine + J/K Cycling
    await page.keyboard.press('Escape');
    await page.waitForTimeout(450);
    await page.locator('.grafton-nav-btn[data-nav-module="schedule"]').click();
    await page.waitForSelector('.schedule-block', { timeout: 10000 });

    await showGestureHUD(
      page,
      'GESTURE 10 // QUANTUM ENGINE + KEYBOARD CYCLING (← / → / J / K)',
      'Ejecuta combinatoria sin cruces y navega resultados #1–#5 con teclas J / →'
    );
    await page.waitForTimeout(550);

    await page.locator('button:has-text("Auto-Generar")').first().click();
    await page.waitForSelector('.optimizer-generate-btn', { timeout: 8000 });
    await page.waitForTimeout(350);
    await page.locator('[role="dialog"] :text("Armador de Semestre (Modo Avanzado)")').first().click();
    await page.waitForTimeout(250);
    for (let i = 0; i < 3; i++) {
      const unsel = page.locator('[role="dialog"] .optimizer-course-item:not(.selected)').first();
      if ((await unsel.count()) > 0) {
        await unsel.click();
        await page.waitForTimeout(180);
      }
    }
    await page.locator('.optimizer-generate-btn').click();

    await page.waitForSelector('[data-optimizer-result-idx="0"]', { timeout: 25000 });
    await page.waitForTimeout(850);

    // Open Vista Previa of #01 and rapidly cycle #1 -> #2 -> #3 -> #4 -> #5 -> #4
    await page.locator('[data-optimizer-result-idx="0"] .btn-preview').click();
    await page.waitForSelector('[data-testid="optimizer-preview-counter"]', { timeout: 5000 });
    await page.waitForTimeout(650);

    for (const key of ['ArrowRight', 'j', 'ArrowRight', 'j', 'ArrowLeft']) {
      await page.keyboard.press(key);
      await page.waitForTimeout(650);
    }
    const finalCounter = await page.locator('[data-testid="optimizer-preview-counter"]').innerText();
    console.log(`  Quantum preview cycled cleanly -> counter now: ${finalCounter}`);
    await page.waitForTimeout(900);
    succeeded = true;
    console.log('  Completed Desktop Scene 5 cleanly (Command Palette ⌘K -> A908 + Quantum Engine cycling).');
  } finally {
    const video = page.video();
    await page.close();
    await context.close();
    if (video) {
      try {
        const outWebm = path.join(OUT_DIR, 'gesture-showcase-desktop.webm');
        const outMp4 = path.join(OUT_DIR, 'gesture-showcase-desktop.mp4');
        await video.saveAs(outWebm);
        execSync(
          `ffmpeg -y -i "${outWebm}" -c:v libx264 -pix_fmt yuv420p -r 30 -preset fast -crf 21 -movflags +faststart "${outMp4}"`,
          { stdio: 'ignore' }
        );
        console.log(`  Exported ${outMp4}`);
        output = { outWebm, outMp4 };
      } catch (videoErr) {
        if (succeeded) throw videoErr;
      }
    }
  }
  return output;
}

async function main() {
  ensureDirs();
  if (!fs.existsSync(DIST_DIR)) {
    throw new Error(`Missing ./dist at ${DIST_DIR}. Run npm run build first.`);
  }

  const server = await startStaticServer();
  console.log(`Static server listening at ${BASE_URL}`);
  const browser = await pw.chromium.launch({
    headless: true,
    executablePath: CHROMIUM_EXECUTABLE,
  });

  try {
    const mobile = await recordMobileShowcase(browser);
    const desktop = await recordDesktopShowcase(browser);

    // Build combined 1440x900 demo showcase MP4 (mobile padded cleanly onto Grafton Warm Alabaster canvas + desktop)
    if (mobile?.outMp4 && desktop?.outMp4) {
      const demoMp4 = path.join(OUT_DIR, 'gesture-showcase-demo.mp4');
      execSync(
        `ffmpeg -y -i "${mobile.outMp4}" -i "${desktop.outMp4}" -filter_complex "[0:v]scale=-2:860,pad=1440:900:(ow-iw)/2:20:color=#EAE7E1,setsar=1,fps=30[v0];[1:v]scale=1440:900,setsar=1,fps=30[v1];[v0][v1]concat=n=2:v=1:a=0[v]" -map "[v]" -c:v libx264 -pix_fmt yuv420p -preset fast -crf 21 -movflags +faststart "${demoMp4}"`,
        { stdio: 'ignore' }
      );

      for (const f of ['gesture-showcase-mobile.mp4', 'gesture-showcase-desktop.mp4', 'gesture-showcase-demo.mp4']) {
        const p = path.join(OUT_DIR, f);
        const dur = execSync(
          `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${p}"`,
          { encoding: 'utf8' }
        ).trim();
        const mb = (fs.statSync(p).size / (1024 * 1024)).toFixed(2);
        console.log(`Verified ${f}: ${mb} MB · duration ${Number(dur).toFixed(1)}s`);
      }
    }
  } finally {
    await browser.close();
    server.close();
  }
}

main().catch((err) => {
  console.error('Gesture showcase recording failed:', err);
  process.exit(1);
});
