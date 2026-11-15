const pw = require('/home/charmcast/.npm/_npx/e41f203b7505f1fb/node_modules/playwright');
const fs = require('fs');
const path = require('path');
const http = require('http');
const { execSync } = require('child_process');

const PORT = 4338;
const BASE_URL = `http://127.0.0.1:${PORT}`;
const OUT_DIR = path.resolve(process.cwd(), 'auditory_videos');
const RAW_VIDEO_DIR = '/tmp/auditory_videos_raw';
const DIST_DIR = path.resolve(process.cwd(), 'dist');
const CHROMIUM_EXECUTABLE = '/home/charmcast/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome';

// Keep every recording strictly <= 5 minutes (300s), finishing tour actions <= 260s
const MAX_TOUR_MS = 260_000;

const DEVICES = [
  {
    id: '01-desktop-1440x900',
    label: 'Desktop MacBook Pro (1440x900)',
    viewport: { width: 1440, height: 900 },
    isMobile: false,
    hasTouch: false,
  },
  {
    id: '02-tablet-mdpi-800x1280',
    label: 'Tablet MDPI (800x1280)',
    viewport: { width: 800, height: 1280 },
    isMobile: true,
    hasTouch: true,
  },
  {
    id: '03-mobile-iphone17-430x932',
    label: 'Mobile iPhone 17 Pro Max (430x932)',
    viewport: { width: 430, height: 932 },
    isMobile: true,
    hasTouch: true,
  },
  {
    id: '04-mobile-compact-375x812',
    label: 'Mobile Compact iPhone X (375x812)',
    viewport: { width: 375, height: 812 },
    isMobile: true,
    hasTouch: true,
  },
];

function ensureOutDir() {
  if (!fs.existsSync(OUT_DIR)) {
    fs.mkdirSync(OUT_DIR, { recursive: true });
  }
  if (!fs.existsSync(RAW_VIDEO_DIR)) {
    fs.mkdirSync(RAW_VIDEO_DIR, { recursive: true });
  }
  // Remove any stale temporary webm files from OUT_DIR
  for (const f of fs.readdirSync(OUT_DIR)) {
    if (f.endsWith('.webm')) {
      fs.unlinkSync(path.join(OUT_DIR, f));
    }
  }
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

async function injectVisualCursor(context, isTouchDevice) {
  await context.addInitScript((isTouch) => {
    window.addEventListener('DOMContentLoaded', () => {
      if (document.getElementById('__pw-cursor')) return;
      const dot = document.createElement('div');
      dot.id = '__pw-cursor';
      Object.assign(dot.style, {
        position: 'fixed',
        top: '-40px',
        left: '-40px',
        width: isTouch ? '22px' : '16px',
        height: isTouch ? '22px' : '16px',
        border: '2px solid #18181A',
        borderRadius: isTouch ? '999px' : '0px',
        backgroundColor: 'rgba(0, 102, 140, 0.85)',
        boxShadow: '2px 2px 0px #18181A',
        pointerEvents: 'none',
        zIndex: '2147483647',
        transform: 'translate(-50%, -50%)',
        transition: 'transform 70ms linear, background-color 120ms ease',
      });
      document.body.appendChild(dot);

      const moveTo = (x, y) => {
        dot.style.left = `${x}px`;
        dot.style.top = `${y}px`;
      };
      const pulseDown = () => {
        dot.style.transform = 'translate(-50%, -50%) scale(1.4)';
        dot.style.backgroundColor = 'rgba(13, 122, 78, 0.95)';
      };
      const pulseUp = () => {
        dot.style.transform = 'translate(-50%, -50%) scale(1)';
        dot.style.backgroundColor = 'rgba(0, 102, 140, 0.85)';
      };

      window.addEventListener('mousemove', (e) => moveTo(e.clientX, e.clientY), { passive: true });
      window.addEventListener('mousedown', pulseDown, { passive: true });
      window.addEventListener('mouseup', pulseUp, { passive: true });
      window.addEventListener(
        'touchstart',
        (e) => {
          if (e.touches[0]) moveTo(e.touches[0].clientX, e.touches[0].clientY);
          pulseDown();
        },
        { passive: true }
      );
      window.addEventListener('touchend', pulseUp, { passive: true });
    });
  }, isTouchDevice);
}

function createHelpers(page, startTime, deviceId) {
  const hasBudget = () => Date.now() - startTime < MAX_TOUR_MS;

  const pause = async (ms = 650) => {
    if (!hasBudget()) return false;
    await page.waitForTimeout(ms);
    return true;
  };

  const smoothScroll = async (deltaY, steps = 5, stepWait = 80) => {
    if (!hasBudget()) return;
    const stepY = deltaY / steps;
    for (let i = 0; i < steps; i++) {
      await page.mouse.wheel(0, stepY).catch(() => {});
      await page.waitForTimeout(stepWait);
    }
    await page.waitForTimeout(250);
  };

  const movePointer = async (loc) => {
    try {
      const box = await loc.boundingBox();
      if (box) {
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 4 });
      }
    } catch (_) {}
  };

  const safeClick = async (selectorOrText, waitMs = 600) => {
    if (!hasBudget()) return false;
    try {
      const loc = page.locator(selectorOrText).first();
      if ((await loc.count()) > 0 && (await loc.isVisible())) {
        await loc.scrollIntoViewIfNeeded({ timeout: 2000 }).catch(() => {});
        await movePointer(loc);
        await loc.click({ timeout: 3000 });
        await pause(waitMs);
        return true;
      }
    } catch (e) {
      // ignore non-visible or detached elements
    }
    return false;
  };

  const safeClickNth = async (selector, index, waitMs = 600) => {
    if (!hasBudget()) return false;
    try {
      const loc = page.locator(selector).nth(index);
      if ((await loc.count()) > 0 && (await loc.isVisible())) {
        await loc.scrollIntoViewIfNeeded({ timeout: 2000 }).catch(() => {});
        await movePointer(loc);
        await loc.click({ timeout: 3000 });
        await pause(waitMs);
        return true;
      }
    } catch (_) {}
    return false;
  };

  const safeHover = async (selectorOrText, waitMs = 550) => {
    if (!hasBudget()) return false;
    try {
      const loc = page.locator(selectorOrText).first();
      if ((await loc.count()) > 0 && (await loc.isVisible())) {
        await loc.scrollIntoViewIfNeeded({ timeout: 2000 }).catch(() => {});
        await movePointer(loc);
        await loc.hover({ timeout: 2000 });
        await pause(waitMs);
        return true;
      }
    } catch (_) {}
    return false;
  };

  const safeFill = async (selectorOrText, text, waitMs = 600) => {
    if (!hasBudget()) return false;
    try {
      const loc = page.locator(selectorOrText).first();
      if ((await loc.count()) > 0 && (await loc.isVisible())) {
        await loc.scrollIntoViewIfNeeded({ timeout: 2000 }).catch(() => {});
        await movePointer(loc);
        await loc.fill(text, { timeout: 2500 });
        await pause(waitMs);
        return true;
      }
    } catch (_) {}
    return false;
  };

  const closeAnyModal = async () => {
    await page.keyboard.press('Escape').catch(() => {});
    await page.waitForTimeout(300);
    const closeSel =
      '.visitor-modal-close-btn:visible, .course-modal-close-btn:visible, .grafton-gcal-close-btn:visible, [role="dialog"] button.close-btn:visible, .modal-card button.close-btn:visible, [role="dialog"] button[aria-label*="Cerrar"]:visible, [role="dialog"] button:has-text("Cerrar"):visible';
    for (let attempt = 0; attempt < 2; attempt++) {
      const btn = page.locator(closeSel).first();
      if ((await btn.count()) > 0 && (await btn.isVisible())) {
        await btn.click({ timeout: 1500 }).catch(() => {});
        await page.waitForTimeout(300);
      } else {
        break;
      }
    }
  };

  const log = (msg) => {
    const secs = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[${deviceId} @ ${secs}s] ${msg}`);
  };

  return { hasBudget, pause, smoothScroll, safeClick, safeClickNth, safeHover, safeFill, closeAnyModal, log };
}

async function runDeviceTour(browser, device) {
  const startTime = Date.now();
  const context = await browser.newContext({
    viewport: device.viewport,
    isMobile: device.isMobile,
    hasTouch: device.hasTouch,
    recordVideo: {
      dir: RAW_VIDEO_DIR,
      size: device.viewport,
    },
  });

  await injectVisualCursor(context, device.isMobile);
  const page = await context.newPage();
  const { hasBudget, pause, smoothScroll, safeClick, safeClickNth, safeHover, safeFill, closeAnyModal, log } =
    createHelpers(page, startTime, device.id);

  try {
    // =========================================================================
    // PHASE 1: HORARIO (/) — Sidebar/Drawer, Ghost Preview, Tabs, Days, Generator, Export & Import
    // =========================================================================
    log('Phase 1: Horario (/)');
    await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle' });
    await page.locator('button:has-text("Auto-Generar")').first().waitFor({ state: 'visible', timeout: 8000 }).catch(() => {});
    await pause(800);

    // Ensure sample courses/schedule loaded if welcome banner shows
    await safeClick('button:has-text("Datos Muestra"), button:has-text("Cargar Datos Muestra")', 900);

    // Desktop sidebar or Mobile/Tablet drawer
    const isNarrow = device.viewport.width < 1024;
    if (isNarrow) {
      await safeClick('#mobile-sidebar-btn, button:has-text("Cursos")', 700);
    }

    // Search in course sidebar, expand course, hover section for ghost preview, toggle sections
    const sbSearch = 'aside input[placeholder*="Buscar"]:visible, .course-sidebar input[placeholder*="Buscar"]:visible, input[placeholder*="Buscar curso"]:visible';
    await safeFill(sbSearch, 'CS', 650);
    await safeFill(sbSearch, '', 450);

    // Hover & toggle first few visible sidebar section buttons
    const courseBtns = page.locator('.course-sidebar button:visible, aside button:visible');
    const cCount = await courseBtns.count();
    for (let i = 0; i < Math.min(cCount, 4); i++) {
      await safeHover(`.course-sidebar button:visible, aside button:visible >> nth=${i}`, 320);
      await safeClickNth('.course-sidebar button:visible, aside button:visible', i, 420);
    }

    if (isNarrow) {
      await safeClick('.mobile-sidebar-drawer button[aria-label*="Cerrar"]:visible, .mobile-sidebar-backdrop:visible', 550);
      await page.keyboard.press('Escape').catch(() => {});
    }

    // Timetable Tabs (+ New tab, Duplicate tab, Switch options)
    await safeClick('.add-tab-btn[aria-label="Nueva opción de horario"]', 550);
    await safeClick('.tab-content-btn:has-text("Opción 2"), .tab-content-btn:has-text("Horario 2")', 550);
    await safeClick('.tab-content-btn:has-text("Opción 1"), .tab-content-btn:has-text("Horario 1")', 550);

    // Timetable Day Segmented Control (Lunes..Sábado -> Reset)
    for (const day of ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']) {
      if (!hasBudget()) break;
      await safeClick(`.timetable-day-segment-btn:has-text("${day}")`, 420);
    }
    await safeClick('.timetable-reset-week-btn, .timetable-day-segment-btn:has-text("Semana")', 600);

    // Generator Modal (Quantum EngineVisualizer + 50 Results + Preview + New Tab + Apply)
    log('Phase 1B: Generador Automático de Horarios');
    if (hasBudget() && (await safeClick('button:has-text("Auto-Generar")', 800))) {
      const dialog = page.locator('[role="dialog"]').first();

      // Enable Armador de Semestre & pick extra courses
      await safeClick('[role="dialog"] :text("Armador de Semestre (Modo Avanzado)")', 600);
      for (let i = 0; i < 4; i++) {
        await safeClick('[role="dialog"] .optimizer-course-item:not(.selected)', 300);
      }

      // Toggle preference keys & filters
      await safeClick('[role="dialog"] .pref-pill:has-text("Menos días")', 400);
      await safeClick('[role="dialog"] .pref-pill:has-text("Mañanas")', 400);
      await safeClick('[role="dialog"] .pref-pill:has-text("Mañanas")', 350);

      // Show Calendario de Bloqueos & paint on desktop
      await safeClick('[data-testid="toggle-blocker-grid"], [role="dialog"] :text("Calendario de Bloqueos")', 600);
      const blockerGrid = page.locator('.time-blocker-grid, [class*="time-blocker"]').first();
      if (!isNarrow && (await blockerGrid.count()) > 0 && (await blockerGrid.isVisible())) {
        const box = await blockerGrid.boundingBox();
        if (box) {
          await page.mouse.move(box.x + 80, box.y + 60);
          await page.mouse.down();
          await page.mouse.move(box.x + 80, box.y + 110, { steps: 4 });
          await page.mouse.up();
          await pause(450);
        }
      }
      await safeClick('[role="dialog"] :text("Modo Estricto")', 400);
      await safeClick('[role="dialog"] :text("Modo Estricto")', 350);

      // Generate schedules -> Quantum Combinatorial Engine Visualizer
      if (await safeClick('[role="dialog"] .optimizer-generate-btn:not(:disabled)', 400)) {
        await dialog.locator('[data-testid="quantum-engine-visualizer"]').waitFor({ state: 'visible', timeout: 3000 }).catch(() => {});
        await pause(1200);
        await dialog.locator('.optimizer-swiss-card').first().waitFor({ state: 'visible', timeout: 25000 }).catch(() => {});
        await pause(800);

        // Scroll 50 results top -> bottom -> top
        const scrollBox = dialog.locator('.optimizer-results-scroll.overflow-y-auto').last();
        if ((await scrollBox.count()) > 0) {
          await scrollBox.evaluate((el) => { el.scrollTop = el.scrollHeight * 0.45; });
          await pause(550);
          await scrollBox.evaluate((el) => { el.scrollTop = el.scrollHeight; });
          await pause(650);
          await scrollBox.evaluate((el) => { el.scrollTop = 0; });
          await pause(500);
        }

        // Toggle between config and results on <1024px
        if (isNarrow) {
          await safeClick('[role="dialog"] button:has-text("Configurar Cursos y Filtros")', 600);
          await safeClick('[role="dialog"] .optimizer-mobile-back-results-btn', 600);
        }

        // Preview Option 1 -> Back -> + Nueva Pestaña -> Aplicar
        await safeClick('[role="dialog"] .btn-preview', 900);
        await safeClick('[role="dialog"] button:has-text("Volver a resultados")', 600);
        await safeClick('[role="dialog"] .btn-new-tab', 650);
        await safeClick('[role="dialog"] .btn-apply', 750);
      }
      await closeAnyModal();
    }

    // Export Modal & Google Calendar Modal
    log('Phase 1C: Exportar & Google Calendar Modal');
    if (hasBudget() && (await safeClick('button.grafton-export-btn', 750))) {
      for (const seg of ['10 min', '15 min', '30 min', '1 hora', 'Sin alarma']) {
        await safeClick(`.alarm-segment-btn:has-text("${seg}")`, 320);
      }
      await safeClick('[role="dialog"] button:has-text("Un color por cada curso")', 450);
      await safeClick('[role="dialog"] button:has-text("Por categoría")', 450);

      // Open Google Calendar modal
      if (await safeClick('[role="dialog"] .btn-export-action:has-text("Conectar")', 800)) {
        await safeClick('[role="dialog"] .grafton-gcal-mode-btn:nth-child(2)', 450);
        await safeClick('[role="dialog"] .grafton-gcal-mode-btn:nth-child(1)', 450);
        await closeAnyModal();
      }
      await closeAnyModal();
    }

    // Import Modal
    log('Phase 1D: Importar Oferta Modal');
    if (hasBudget() && (await safeClick('button.grafton-nav-btn--import:visible, button.timetable-import-btn:visible', 750))) {
      await pause(800);
      await closeAnyModal();
    }

    // =========================================================================
    // PHASE 2: MALLA & 16 CARRERAS (/malla)
    // =========================================================================
    log('Phase 2: Malla & 16 Carreras (/malla)');
    if (hasBudget()) {
      if (!(await safeClick('.grafton-nav-btn[data-nav-module="malla"]', 850))) {
        await page.goto(`${BASE_URL}/malla`, { waitUntil: 'networkidle' });
        await pause(800);
      }

      for (const fac of ['Computación', 'Ingeniería', 'Negocios', 'Ciencias Básicas', 'Todas']) {
        if (!hasBudget()) break;
        await safeClick(`button:has-text("${fac}")`, 420);
      }

      for (const code of ['DS', 'SI', 'AD', 'ME', 'MT', 'CS']) {
        if (!hasBudget()) break;
        await safeClick(`.dag-career-pill:has-text("${code}")`, 420);
      }

      await safeClick('.dag-node:has-text("CS1011"), .dag-node:has-text("PI1101")', 600);
      await safeClick('.dag-node:has-text("CS2013"), .dag-node:has-text("CS2032")', 650);
      await safeClick('.dag-pill--prereq', 550);
      await safeClick('.dag-pill--unlock', 550);

      const dagScroll = page.locator('.dag-scroll-container').first();
      if ((await dagScroll.count()) > 0) {
        await dagScroll.evaluate((el) => { el.scrollLeft = 650; });
        await pause(550);
        await dagScroll.evaluate((el) => { el.scrollLeft = 1400; });
        await pause(550);
        await dagScroll.evaluate((el) => { el.scrollLeft = 0; });
        await pause(450);
      }
    }

    // =========================================================================
    // PHASE 3: CURSOS OFERTADOS (/cursos)
    // =========================================================================
    log('Phase 3: Cursos Ofertados (/cursos)');
    if (hasBudget()) {
      if (isNarrow) {
        if (!(await safeClick('.grafton-mobile-dock [data-dock-module="courses"]', 850))) {
          await page.goto(`${BASE_URL}/cursos`, { waitUntil: 'networkidle' });
          await pause(800);
        }
      } else if (!(await safeClick('.grafton-nav-btn[data-nav-module="courses"]', 850))) {
        await page.goto(`${BASE_URL}/cursos`, { waitUntil: 'networkidle' });
        await pause(800);
      }

      const cursoSearch = 'input[placeholder*="Buscar por código"]:visible, input[placeholder*="Buscar curso"]:visible';
      await safeFill(cursoSearch, 'Algoritmos', 600);
      await safeFill(cursoSearch, '', 450);

      await safeClick('button:has-text("Lun"):visible', 400);
      await safeClick('button:has-text("Mie"):visible', 400);
      await safeClick('button:has-text("Todos"):visible', 400);

      // Click star button inside the first course card to bookmark + show Swiss toast
      await safeClick('.course-card .course-star-btn:visible', 850);
      await safeClick('button:has-text("Mis Visitados"):visible', 650);
      await safeClick('button:has-text("Restablecer"):visible', 550);

      // Open Course Detail Modal -> Switch Tabs -> VisitorEmailModal -> Close
      if (await safeClick('.course-view-detail-btn:visible', 850)) {
        await safeClick('[role="dialog"] button:has-text("Horario Semanal"):visible', 650);
        await safeClick('[role="dialog"] button:has-text("Secciones"):visible', 600);
        if (await safeClick('.course-permission-btn:visible, [role="dialog"] button:has-text("Pedir Permiso"):visible', 800)) {
          await safeClick('[role="dialog"] label:has-text("Repaso"):visible, [role="dialog"] button:has-text("Repaso"):visible', 450);
          await safeClick('.visitor-copy-btn:visible', 500);
          await closeAnyModal();
        }
        await closeAnyModal();
      }

      // Scroll down to showcase Floating Top Button on narrow viewports
      await smoothScroll(850, 5, 70);
      if (isNarrow) {
        await safeClick('.mobile-floating-top-btn', 700);
      } else {
        await smoothScroll(-850, 4, 60);
      }
    }

    // =========================================================================
    // PHASE 4: AULAS LIBRES (/aulas)
    // =========================================================================
    log('Phase 4: Aulas Libres (/aulas)');
    if (hasBudget()) {
      if (isNarrow) {
        if (!(await safeClick('.grafton-mobile-dock [data-dock-module="classrooms"]', 850))) {
          await page.goto(`${BASE_URL}/aulas`, { waitUntil: 'networkidle' });
          await pause(800);
        }
      } else if (!(await safeClick('.grafton-nav-btn[data-nav-module="classrooms"]', 850))) {
        await page.goto(`${BASE_URL}/aulas`, { waitUntil: 'networkidle' });
        await pause(800);
      }

      // Live time controls & CustomTimePicker
      await safeClick('button:has-text("+15m")', 450);
      await safeClick('button:has-text("-15m")', 450);
      if (await safeClick('.live-time-stepper-btn, .grafton-time-trigger-btn', 650)) {
        await safeClick('.gtp-apply-btn', 550);
      }

      // Filter mode -> preset blocks -> duration -> floors -> types -> reset for cards
      await safeClick('button:has-text("Buscar por Horario"):visible', 600);
      await safeClick('button:has-text("Mañana"):visible', 400);
      await safeClick('.duration-pill-btn:has-text("2h"):visible', 400);
      await safeClick('.duration-pill-btn:has-text("Cualquiera"):visible', 380);
      await safeClick('.floor-pill-btn:has-text("Piso 2"):visible', 400);
      await safeClick('.floor-pill-btn:has-text("Todos los Pisos"):visible', 400);
      await safeClick('.type-chip-btn:has-text("Laboratorios"):visible', 400);
      await safeClick('.type-chip-btn:has-text("Todos"):visible', 400);

      // Open ClassroomDetailModal from card
      if (await safeClick('.classroom-card .btn-view-schedule:visible', 850)) {
        await safeClick('.modal-day-tab:has-text("Mar"):visible', 450);
        await safeClick('.modal-day-tab:has-text("Mie"):visible', 450);
        await closeAnyModal();
      }

      // Campus Vertical view & room tile click
      await safeClick('.classroom-submode-btn:has-text("Campus"):visible', 800);
      await smoothScroll(380, 4, 70);
      if (await safeClick('.campus-room-chip:visible, [data-room-code="A901"]:visible, [data-room-code="L601"]:visible', 850)) {
        await safeClick('.modal-day-tab:has-text("Jue"):visible', 450);
        await closeAnyModal();
      }
      await safeClick('.classroom-submode-btn:has-text("Directorio"):visible', 600);
      await safeClick('button:has-text("Libres Ahora"):visible', 450);
      await smoothScroll(-380, 4, 60);
    }

    // =========================================================================
    // PHASE 5: DOCENTES (/profesores)
    // =========================================================================
    log('Phase 5: Docentes (/profesores)');
    if (hasBudget()) {
      if (isNarrow) {
        if (!(await safeClick('.grafton-mobile-dock [data-dock-module="professors"]', 850))) {
          await page.goto(`${BASE_URL}/profesores`, { waitUntil: 'networkidle' });
          await pause(800);
        }
      } else if (!(await safeClick('.grafton-nav-btn[data-nav-module="professors"]', 850))) {
        await page.goto(`${BASE_URL}/profesores`, { waitUntil: 'networkidle' });
        await pause(800);
      }

      await safeClick('button:has-text("Dictando Ahora"):visible', 450);
      await safeClick('button:has-text("Presencial"):visible', 400);
      await safeClick('button:has-text("Virtual"):visible', 400);
      // Reset filters so full directory of professor cards is guaranteed visible
      await safeClick('button:has-text("Restablecer"):visible', 600);

      if (await safeClick('.prof-view-detail-btn:visible, .professor-card .btn-view-schedule:visible', 900)) {
        await safeClick('[role="dialog"] button:has-text("Por Día"):visible', 550);
        await safeClick('[role="dialog"] button:has-text("Matriz"):visible', 500);
        await safeClick('[role="dialog"] button:has-text("Cursos"):visible', 550);
        await safeClick('[role="dialog"] button:has-text("Aulas"):visible', 550);
        await safeClick('.prof-modal-copy-btn:visible', 450);
        await closeAnyModal();
      }
    }

    // =========================================================================
    // PHASE 6: MENTORES (/mentores)
    // =========================================================================
    log('Phase 6: Mentores (/mentores)');
    if (hasBudget()) {
      if (isNarrow) {
        if (!(await safeClick('.grafton-mobile-dock [data-dock-module="mentors"]', 850))) {
          await page.goto(`${BASE_URL}/mentores`, { waitUntil: 'networkidle' });
          await pause(800);
        }
      } else if (!(await safeClick('.grafton-nav-btn[data-nav-module="mentors"]', 850))) {
        await page.goto(`${BASE_URL}/mentores`, { waitUntil: 'networkidle' });
        await pause(800);
      }

      await safeClick('button:has-text("En Mentoría Ahora"):visible', 450);
      await safeClick('button:has-text("Presencial"):visible', 400);
      await safeClick('button:has-text("Virtual"):visible', 400);
      // Reset filters so mentor cards are guaranteed visible
      await safeClick('button:has-text("Restablecer"):visible', 600);

      if (await safeClick('.mentor-view-btn:visible, .mentor-card .btn-view-schedule:visible', 900)) {
        await safeClick('[role="dialog"] button:has-text("Aulas y Reservas"):visible', 550);
        await safeClick('[role="dialog"] button:has-text("Cursos y Consejos"):visible', 550);
        await safeClick('[role="dialog"] button:has-text("Horario Semanal"):visible', 550);
        await closeAnyModal();
      }

      // Navigate via Mobile Bottom Dock back to Horarios on <1024px
      if (isNarrow) {
        await safeClick('.grafton-mobile-dock [data-dock-module="schedule"]', 750);
      } else {
        await safeClick('.grafton-nav-btn[data-nav-module="schedule"]', 750);
      }
    }

    // =========================================================================
    // PHASE 7: LEGAL & FOOTER PAGES (/privacy, /terms) -> Return Home
    // =========================================================================
    log('Phase 7: Legal & Return Home');
    if (hasBudget()) {
      await page.goto(`${BASE_URL}/privacy`, { waitUntil: 'networkidle' });
      await pause(550);
      await smoothScroll(350, 3, 70);
      await page.goto(`${BASE_URL}/terms`, { waitUntil: 'networkidle' });
      await pause(550);
      await smoothScroll(350, 3, 70);
      await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle' });
      await pause(750);
    }

    log('Finished tour steps cleanly; saving video...');
  } finally {
    const video = page.video();
    await page.close();
    await context.close();

    if (video) {
      const tmpWebm = path.join(RAW_VIDEO_DIR, `${device.id}.webm`);
      const outMp4 = path.join(OUT_DIR, `${device.id}.mp4`);
      await video.saveAs(tmpWebm);
      try {
        execSync(
          `ffmpeg -y -i "${tmpWebm}" -t 300 -c:v libx264 -pix_fmt yuv420p -preset fast -crf 23 -movflags +faststart "${outMp4}"`,
          { stdio: 'ignore' }
        );
        fs.unlinkSync(tmpWebm);
        const durStr = execSync(
          `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${outMp4}"`,
          { encoding: 'utf8' }
        ).trim();
        const sizeMB = (fs.statSync(outMp4).size / (1024 * 1024)).toFixed(2);
        log(`Exported ${path.basename(outMp4)} (${sizeMB} MB, duration: ${Number(durStr).toFixed(1)}s)`);
      } catch (err) {
        console.error(`[${device.id}] ffmpeg conversion error:`, err);
      }
    }
  }
}

async function main() {
  ensureOutDir();
  if (!fs.existsSync(DIST_DIR)) {
    throw new Error(`Missing ./dist directory at ${DIST_DIR}. Run astro build first.`);
  }

  const server = await startStaticServer();
  console.log(`Static preview server listening at ${BASE_URL}`);

  const browser = await pw.chromium.launch({
    headless: true,
    executablePath: CHROMIUM_EXECUTABLE,
  });

  try {
    // Run 2 parallel pairs so videos encode smoothly and total wall time stays compact
    await Promise.all([
      runDeviceTour(browser, DEVICES[0]),
      runDeviceTour(browser, DEVICES[1]),
    ]);
    await Promise.all([
      runDeviceTour(browser, DEVICES[2]),
      runDeviceTour(browser, DEVICES[3]),
    ]);
    console.log(`\nAll ${DEVICES.length} auditory videos generated in ${OUT_DIR}`);
  } finally {
    await browser.close();
    server.close();
  }
}

main().catch((err) => {
  console.error('Auditory video recording failed:', err);
  process.exit(1);
});
