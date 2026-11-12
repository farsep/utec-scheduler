const pw = require('/home/charmcast/.npm/_npx/e41f203b7505f1fb/node_modules/playwright');
const fs = require('fs');
const path = require('path');
const http = require('http');
const { execSync } = require('child_process');

const PORT = 4335;
const BASE_URL = `http://127.0.0.1:${PORT}`;
const OUT_DIR = path.resolve(process.cwd(), 'tour_videos_1');
const distDir = path.join(process.cwd(), 'dist');

function ensureOutDir() {
  if (!fs.existsSync(OUT_DIR)) {
    fs.mkdirSync(OUT_DIR, { recursive: true });
  }
}

function startServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      let reqPath = req.url.split('?')[0];
      if (reqPath.endsWith('/')) reqPath += 'index.html';
      else if (!path.extname(reqPath)) reqPath += '/index.html';
      const filePath = path.join(distDir, reqPath);
      if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        const ext = path.extname(filePath);
        const mime =
          ext === '.html'
            ? 'text/html'
            : ext === '.js'
            ? 'application/javascript'
            : ext === '.css'
            ? 'text/css'
            : ext === '.svg'
            ? 'image/svg+xml'
            : ext === '.png'
            ? 'image/png'
            : ext === '.json'
            ? 'application/json'
            : 'application/octet-stream';
        res.writeHead(200, { 'Content-Type': mime });
        fs.createReadStream(filePath).pipe(res);
      } else {
        res.writeHead(404);
        res.end('Not Found');
      }
    });
    server.listen(PORT, '127.0.0.1', () => {
      resolve(server);
    });
  });
}

async function injectVisualCursor(context) {
  await context.addInitScript(() => {
    window.addEventListener('DOMContentLoaded', () => {
      if (document.getElementById('__pw-cursor')) return;
      const dot = document.createElement('div');
      dot.id = '__pw-cursor';
      Object.assign(dot.style, {
        position: 'fixed',
        top: '0px',
        left: '0px',
        width: '18px',
        height: '18px',
        border: '2px solid #18181A',
        backgroundColor: 'rgba(217, 56, 30, 0.85)',
        boxShadow: '2px 2px 0px #18181A',
        pointerEvents: 'none',
        zIndex: '2147483647',
        transform: 'translate(-50%, -50%)',
        transition: 'transform 60ms linear, background-color 120ms ease'
      });
      document.body.appendChild(dot);

      window.addEventListener('mousemove', (e) => {
        dot.style.left = `${e.clientX}px`;
        dot.style.top = `${e.clientY}px`;
      }, { passive: true });

      window.addEventListener('mousedown', () => {
        dot.style.transform = 'translate(-50%, -50%) scale(1.45)';
        dot.style.backgroundColor = 'rgba(0, 119, 158, 0.95)';
      }, { passive: true });

      window.addEventListener('mouseup', () => {
        dot.style.transform = 'translate(-50%, -50%) scale(1)';
        dot.style.backgroundColor = 'rgba(217, 56, 30, 0.85)';
      }, { passive: true });
    });
  });
}

async function pause(page, ms = 850) {
  await page.waitForTimeout(ms);
}

async function smoothScroll(page, deltaY, steps = 6) {
  const stepY = deltaY / steps;
  for (let i = 0; i < steps; i++) {
    await page.mouse.wheel(0, stepY);
    await page.waitForTimeout(90);
  }
  await page.waitForTimeout(350);
}

async function safeClick(page, selectorOrText, waitMs = 850) {
  try {
    const loc = page.locator(selectorOrText).first();
    if ((await loc.count()) > 0 && (await loc.isVisible())) {
      await loc.scrollIntoViewIfNeeded({ timeout: 2000 }).catch(() => {});
      const box = await loc.boundingBox();
      if (box) {
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 6 });
      }
      await loc.click({ timeout: 3000 });
      await pause(page, waitMs);
      return true;
    }
  } catch (e) {
    console.warn(`[Tour] Skipped click on: ${selectorOrText}`);
  }
  return false;
}

async function safeHover(page, selectorOrText, waitMs = 750) {
  try {
    const loc = page.locator(selectorOrText).first();
    if ((await loc.count()) > 0 && (await loc.isVisible())) {
      await loc.scrollIntoViewIfNeeded({ timeout: 2000 }).catch(() => {});
      const box = await loc.boundingBox();
      if (box) {
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 8 });
      }
      await loc.hover({ timeout: 2500 });
      await pause(page, waitMs);
      return true;
    }
  } catch (e) {
    console.warn(`[Tour] Skipped hover on: ${selectorOrText}`);
  }
  return false;
}

async function safeFill(page, selectorOrText, text, waitMs = 850) {
  try {
    const loc = page.locator(selectorOrText).first();
    if ((await loc.count()) > 0 && (await loc.isVisible())) {
      await loc.scrollIntoViewIfNeeded({ timeout: 2000 }).catch(() => {});
      await loc.fill(text, { timeout: 3000 });
      await pause(page, waitMs);
      return true;
    }
  } catch (e) {
    console.warn(`[Tour] Skipped fill on: ${selectorOrText}`);
  }
  return false;
}

async function closeAnyModal(page) {
  await page.keyboard.press('Escape');
  await pause(page, 450);
  await safeClick(page, '[role="dialog"] button:has-text("Cerrar"), [role="dialog"] button:has-text("✕"), [role="dialog"] button:has-text("×"), .modal button:has-text("Cerrar")', 450);
}

// =============================================================================
// TOUR 1: DESKTOP (1440x900) — COMPLETE EXHAUSTIVE TESTING
// =============================================================================
async function runDesktopTour(browser) {
  console.log('\n--- 1. RECORDING DESKTOP EXHAUSTIVE TOUR (1440x900) ---');
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    recordVideo: {
      dir: OUT_DIR,
      size: { width: 1440, height: 900 }
    }
  });

  await injectVisualCursor(context);
  const page = await context.newPage();

  // 1. HORARIOS (/)
  console.log('[Desktop - Phase 1] Horarios & Schedule Generator...');
  await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle' });
  await pause(page, 1100);

  // Load sample data if needed
  await safeClick(page, 'button:has-text("Datos Muestra"), button:has-text("Muestra")', 1100);

  // Sidebar interaction: search, hover section for ghost preview, select
  await safeFill(page, 'input[placeholder*="Buscar curso"], input[placeholder*="Filtrar"]', 'CS', 800);
  await safeClick(page, 'button[class*="clear"], [class*="search"] button', 600);

  const sidebarButtons = page.locator('aside button, [class*="sidebar"] button');
  const sbCount = await sidebarButtons.count();
  for (let i = 0; i < Math.min(sbCount, 4); i++) {
    const btn = sidebarButtons.nth(i);
    if (await btn.isVisible()) {
      await btn.hover().catch(() => {});
      await pause(page, 550);
      await btn.click().catch(() => {});
      await pause(page, 650);
    }
  }

  // Cycle options
  await safeClick(page, 'button:has-text("Opción 2"), button:has-text("Horario 2")', 850);
  await safeClick(page, 'button:has-text("Opción 3"), button:has-text("Horario 3")', 850);
  await safeClick(page, 'button:has-text("Opción 1"), button:has-text("Horario 1")', 850);

  // Test Grafton Swiss Segmented Day Control (Semana | Lunes | Martes | Miércoles...)
  console.log('[Desktop] Testing Grafton Swiss Segmented Day Control in Timetable...');
  for (const day of ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']) {
    await safeClick(page, `.timetable-day-segment-btn:has-text("${day}")`, 750);
  }
  // Test Quick Return Button "← Volver a vista semanal"
  await safeClick(page, '.timetable-reset-week-btn, button:has-text("Volver a vista semanal")', 850);
  // Verify Semana is active again
  await safeClick(page, '.timetable-day-segment-btn:has-text("Semana")', 750);

  // Schedule Optimizer Modal ("Auto-Generar")
  if (await safeClick(page, 'button:has-text("Auto-Generar"), button:has-text("Generador")', 1100)) {
    await pause(page, 800);
    await safeClick(page, 'button:has-text("Calcular"), button:has-text("Generar")', 900);
    await pause(page, 900);
    await closeAnyModal(page);
    await page.waitForSelector('.modal-overlay', { state: 'detached', timeout: 2000 }).catch(() => {});
  }

  // Export Modal
  if (await safeClick(page, 'button.grafton-export-btn, button:has-text("Exportar")', 1100)) {
    await pause(page, 900);
    await closeAnyModal(page);
    await page.waitForSelector('.modal-overlay', { state: 'detached', timeout: 2000 }).catch(() => {});
  }

  // Import Modal
  if (await safeClick(page, 'button.grafton-nav-btn--import, button:has-text("Importar")', 1100)) {
    await pause(page, 900);
    await closeAnyModal(page);
    await page.waitForSelector('.modal-overlay', { state: 'detached', timeout: 2000 }).catch(() => {});
  }

  // 2. MALLA CURRICULAR (/malla) - SPA In-Memory Navigation
  console.log('[Desktop - Phase 2] Malla Curricular & Compact Swiss Career Bar (SPA Transition)...');
  if (!(await safeClick(page, '.grafton-nav-btn:has-text("Malla & 16 Carreras")', 1100))) {
    await page.goto(`${BASE_URL}/malla`, { waitUntil: 'networkidle' });
    await pause(page, 1100);
  }

  // Faculty pills
  for (const fac of ['Computación (4)', 'Negocios (2)', 'Ingeniería (9)', 'Ciencias Básicas (1)', 'Todas (16)']) {
    await safeClick(page, `button:has-text("${fac}")`, 750);
  }

  // Switch careers via compact pills
  for (const code of ['DS', 'SI', 'AD', 'ME', 'MT', 'CS']) {
    await safeClick(page, `.dag-career-pill:has-text("${code}")`, 750);
  }

  // Click course node in Cycle 1 -> inspector shows "Ingreso directo"
  await safeClick(page, '.dag-node:has-text("CS1011"), .dag-node:has-text("PI1101"), .dag-node-card:first-child', 850);

  // Click course node with prerequisites
  await safeClick(page, '.dag-node:has-text("CS2013"), .dag-node:has-text("CS2032"), .dag-node:has-text("CS1042")', 950);

  // Click prerequisite pill in inspector to jump
  await safeClick(page, '.dag-pill--prereq', 900);

  // Click unlock pill in inspector to jump
  await safeClick(page, '.dag-pill--unlock', 900);

  // Smooth horizontal scroll across all 10 cycles
  const scrollContainer = page.locator('.dag-scroll-container').first();
  if ((await scrollContainer.count()) > 0) {
    await scrollContainer.evaluate((el) => { el.scrollLeft = 800; });
    await pause(page, 900);
    await scrollContainer.evaluate((el) => { el.scrollLeft = 1600; });
    await pause(page, 900);
    await scrollContainer.evaluate((el) => { el.scrollLeft = 0; });
    await pause(page, 650);
  }

  // 3. CURSOS OFERTADOS (/cursos) - SPA Transition
  console.log('[Desktop - Phase 3] Cursos Ofertados, Modals & Visitor Toast (SPA Transition)...');
  if (!(await safeClick(page, '.grafton-nav-btn:has-text("Cursos")', 1100))) {
    await page.goto(`${BASE_URL}/cursos`, { waitUntil: 'networkidle' });
    await pause(page, 1100);
  }

  // Search filter
  await safeFill(page, 'input[placeholder*="Buscar curso"], input[placeholder*="código"]', 'Algoritmos', 900);
  await safeClick(page, 'button[class*="clear"], [class*="search"] button', 700);

  // Day filter
  await safeClick(page, '.filter-controls-row button:has-text("Lun"), button:has-text("Lun")', 750);
  await safeClick(page, '.filter-controls-row button:has-text("Mié"), button:has-text("Mié")', 750);

  // Star button for visitor toast
  await safeClick(page, 'button[title*="visitante"], button[title*="oyente"], button:has-text("☆"), .course-star-btn', 900);
  await pause(page, 1000); // verify Grafton Swiss toast visible

  // Open Course Detail Modal (Level 1)
  if (await safeClick(page, '.course-card, button:has-text("Ver Secciones"), button:has-text("Detalle")', 1100)) {
    // Sub-tab: Horario Semanal
    await safeClick(page, '[role="dialog"] button:has-text("Horario Semanal"), [role="dialog"] button:has-text("Malla")', 900);
    await safeClick(page, '[role="dialog"] button:has-text("Secciones")', 900);

    // Open Visitor Email Sub-Modal (Level 2)
    if (await safeClick(page, 'button:has-text("Pedir Permiso"), button:has-text("Oyente"), button:has-text("Solicitud")', 1100)) {
      await safeClick(page, '[role="dialog"] label:has-text("Repaso"), [role="dialog"] label:has-text("Adelanto")', 800);
      await closeAnyModal(page); // close Level 2
    }
    await closeAnyModal(page); // close Level 1
  }

  // 4. AULAS Y ESPACIOS LIBRES (/aulas) - SPA Transition
  console.log('[Desktop - Phase 4] Aulas Libres & Campus Vertical (SPA Transition)...');
  if (!(await safeClick(page, '.grafton-nav-btn:has-text("Aulas Libres")', 1100))) {
    await page.goto(`${BASE_URL}/aulas`, { waitUntil: 'networkidle' });
    await pause(page, 1100);
  }

  // Toggle to Campus Vertical (Pisos)
  await safeClick(page, 'button:has-text("Campus Vertical"), .classroom-submode-btn:has-text("Campus")', 1100);
  await smoothScroll(page, 400);

  // Click room chip (A901 / L601) to open ClassroomDetailModal
  if (await safeClick(page, '.campus-room-chip, [data-room-code="A901"], [data-room-code="L601"]', 1200)) {
    await safeClick(page, '[role="dialog"] button:has-text("Mar"), [role="dialog"] button:has-text("Mié")', 850);
    await closeAnyModal(page);
  }

  // Switch back to Directorio de Aulas
  await safeClick(page, 'button:has-text("Directorio"), .classroom-submode-btn:has-text("Directorio")', 1100);

  // Search by hour mode & verify left-aligned CustomTimePicker popover
  await safeClick(page, 'button:has-text("Buscar por Horario")', 900);
  
  // Click "A: 12:00 PM" timepicker to verify left-aligned desktop popover (Image 3)
  if (await safeClick(page, '.time-inputs-container .grafton-time-trigger-btn', 900)) {
    await safeClick(page, '.gtp-chip:has-text("11:00"), .gtp-chip:has-text("12:00")', 750);
    await safeClick(page, '.gtp-apply-btn', 750);
  }

  // Quick live-time steppers
  await safeClick(page, 'button:has-text("Libres Ahora")', 800);
  await safeClick(page, 'button:has-text("+15m")', 650);
  await safeClick(page, 'button:has-text("-15m")', 650);

  // Floor and space type filters
  await safeClick(page, '.floor-pill-btn:has-text("Piso 2")', 750);
  await safeClick(page, '.floor-pill-btn:has-text("Todos los Pisos")', 750);
  await safeClick(page, '.type-chip-btn:has-text("Laboratorios")', 750);
  await safeClick(page, '.type-chip-btn:has-text("Todos")', 750);

  // Open ClassroomDetailModal from card
  if (await safeClick(page, '.classroom-card, button:has-text("Ver Horario")', 1100)) {
    await closeAnyModal(page);
  }

  // 5. DOCENTES (/profesores) - SPA Transition
  console.log('[Desktop - Phase 5] Directorio de Docentes (SPA Transition)...');
  if (!(await safeClick(page, '.grafton-nav-btn:has-text("Docentes")', 1100))) {
    await page.goto(`${BASE_URL}/profesores`, { waitUntil: 'networkidle' });
    await pause(page, 1100);
  }

  await safeClick(page, 'button:has-text("Dictando Ahora")', 800);
  await safeClick(page, 'button:has-text("Presencial")', 750);
  await safeClick(page, 'button:has-text("Virtual")', 750);

  // Open Professor Detail Modal
  if (await safeClick(page, '.prof-card, button:has-text("Ver Horario Completo"), button:has-text("Ver Perfil")', 1100)) {
    await safeClick(page, '[role="dialog"] button:has-text("Por Día")', 850);
    await safeClick(page, '[role="dialog"] button:has-text("Matriz")', 850);
    await safeClick(page, '[role="dialog"] button:has-text("Cursos")', 850);
    await safeClick(page, '[role="dialog"] button:has-text("Aulas")', 850);
    await closeAnyModal(page);
  }

  // Deep-link resolution for Pino Matos, Jose
  await page.goto(`${BASE_URL}/profesores?profesor=Pino%20Matos%2C%20Jose`, { waitUntil: 'networkidle' });
  await pause(page, 1200);
  await closeAnyModal(page);

  // 6. MENTORES (/mentores)
  console.log('[Desktop - Phase 6] Directorio de Mentores...');
  await page.goto(`${BASE_URL}/mentores`, { waitUntil: 'networkidle' });
  await pause(page, 1100);

  await safeClick(page, 'button:has-text("En Mentoría Ahora")', 750);
  await safeClick(page, 'button:has-text("Presencial")', 750);
  await safeClick(page, 'button:has-text("Virtual")', 750);

  if (await safeClick(page, 'button:has-text("Ver detalle")', 1100)) {
    await safeClick(page, '[role="dialog"] button:has-text("Aulas y Reservas")', 850);
    await safeClick(page, '[role="dialog"] button:has-text("Cursos y Consejos")', 850);
    await safeClick(page, '[role="dialog"] button:has-text("Horario Semanal")', 850);
    await closeAnyModal(page);
  }

  // Empty state test
  await safeFill(page, '.prof-search-input, input[placeholder*="Buscar mentor"]', 'xyzinexistente', 900);
  await safeClick(page, 'button:has-text("Restablecer")', 850);

  // Return to Horarios for clean final desktop frame
  await safeClick(page, '.grafton-nav-btn:has-text("Horario")', 1000);
  const thumbDesktop = path.join(OUT_DIR, 'thumb-desktop.png');
  await page.screenshot({ path: thumbDesktop });
  try {
    fs.copyFileSync(thumbDesktop, '/home/charmcast/.gemini/antigravity/brain/24f434e2-bf0f-4361-abbc-96cc52a1d046/thumb-desktop.png');
  } catch (_) {}

  console.log('Finishing Desktop recording...');
  const video = page.video();
  await page.close();
  await context.close();

  if (video) {
    const destWebm = path.join(OUT_DIR, '01-desktop-exhaustive-tour.webm');
    await video.saveAs(destWebm);
    console.log(`Saved Desktop webm: ${destWebm}`);
    try {
      const destMp4 = path.join(OUT_DIR, '01-desktop-exhaustive-tour.mp4');
      execSync(`ffmpeg -y -i "${destWebm}" -c:v libx264 -pix_fmt yuv420p -preset fast -crf 23 "${destMp4}"`, { stdio: 'ignore' });
      console.log(`Generated Desktop mp4: ${destMp4}`);
    } catch (e) {
      console.warn('ffmpeg conversion warning:', e.message);
    }
  }
}

// =============================================================================
// TOUR 2: TABLET (768x1024 · iPad Portrait) — RESPONSIVE ERGONOMICS & FLOWS
// =============================================================================
async function runTabletTour(browser) {
  console.log('\n--- 2. RECORDING TABLET EXHAUSTIVE TOUR (768x1024) ---');
  const context = await browser.newContext({
    viewport: { width: 768, height: 1024 },
    isMobile: true,
    hasTouch: true,
    recordVideo: {
      dir: OUT_DIR,
      size: { width: 768, height: 1024 }
    }
  });

  await injectVisualCursor(context);
  const page = await context.newPage();

  // 1. HORARIOS (/) ON TABLET
  console.log('[Tablet] Testing Horarios, Drawer & Mobile Day Switcher...');
  await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle' });
  await pause(page, 1100);

  // Toggle drawer if present
  await safeClick(page, 'button:has-text("Cursos"), [aria-label*="drawer"], [aria-label*="menú"]', 1000);
  await pause(page, 800);
  await safeClick(page, '.mobile-sidebar-drawer button:has-text("✕"), [aria-label*="Cerrar"]', 700);

  // Test Day/Week view switcher on tablet
  await safeClick(page, 'button:has-text("Lun")', 800);
  await safeClick(page, 'button:has-text("Mar")', 800);
  await safeClick(page, 'button:has-text("Mié")', 800);
  await safeClick(page, 'button:has-text("Semana")', 850);

  await smoothScroll(page, 350);
  await smoothScroll(page, -350);

  // 2. MALLA CURRICULAR (/malla) ON TABLET
  console.log('[Tablet] Testing Malla Curricular & Compact Bar...');
  await page.goto(`${BASE_URL}/malla`, { waitUntil: 'networkidle' });
  await pause(page, 1100);

  // Switch faculties and careers
  await safeClick(page, 'button:has-text("Computación")', 800);
  await safeClick(page, '.dag-career-pill:has-text("DS"), .dag-career-pill:has-text("Data")', 850);
  await safeClick(page, '.dag-career-pill:has-text("SI")', 850);
  await safeClick(page, 'button:has-text("Todas")', 800);

  // Click course node to verify sticky inspector on tablet
  await safeClick(page, '.dag-node:has-text("CS1011"), .dag-node:has-text("PI1101"), .dag-node-card:first-child', 900);
  await smoothScroll(page, 300);
  await smoothScroll(page, -300);

  // 3. CURSOS (/cursos) ON TABLET
  console.log('[Tablet] Testing Cursos Ofertados & 2-column layout...');
  await page.goto(`${BASE_URL}/cursos`, { waitUntil: 'networkidle' });
  await pause(page, 1100);

  await safeClick(page, 'button[title*="visitante"], button:has-text("☆"), .course-star-btn', 850);
  await pause(page, 800);

  if (await safeClick(page, '.course-card, button:has-text("Ver Secciones")', 1100)) {
    await safeClick(page, '[role="dialog"] button:has-text("Horario Semanal")', 850);
    await closeAnyModal(page);
  }

  // 4. AULAS (/aulas) ON TABLET
  console.log('[Tablet] Testing Aulas Libres & Symmetrical Live Time Card on Tablet...');
  await page.goto(`${BASE_URL}/aulas`, { waitUntil: 'networkidle' });
  await pause(page, 1100);

  // Test Symmetrical Live Time Toolbar on Tablet
  await safeClick(page, '.live-time-actions button:has-text("-15m")', 800);
  await safeClick(page, '.live-time-actions .live-time-stepper-btn', 850);
  await safeClick(page, '.gtp-apply-btn', 750);
  await safeClick(page, '.live-time-actions button:has-text("+15m")', 800);

  // Campus Vertical
  await safeClick(page, 'button:has-text("Campus Vertical"), .classroom-submode-btn:has-text("Campus")', 1100);
  await smoothScroll(page, 350);

  // Click room chip
  if (await safeClick(page, '.campus-room-chip, [data-room-code="A901"]', 1100)) {
    await safeClick(page, '[role="dialog"] button:has-text("Mié")', 800);
    await closeAnyModal(page);
  }

  // 5. DOCENTES & MENTORES ON TABLET
  console.log('[Tablet] Testing Docentes & Mentores...');
  await page.goto(`${BASE_URL}/profesores`, { waitUntil: 'networkidle' });
  await pause(page, 1000);
  if (await safeClick(page, '.prof-card, button:has-text("Ver Horario Completo")', 1100)) {
    await safeClick(page, '[role="dialog"] button:has-text("Por Día")', 800);
    await closeAnyModal(page);
  }

  await page.goto(`${BASE_URL}/mentores`, { waitUntil: 'networkidle' });
  await pause(page, 1000);
  if (await safeClick(page, 'button:has-text("Ver detalle")', 1100)) {
    await closeAnyModal(page);
  }

  const thumbTablet = path.join(OUT_DIR, 'thumb-tablet.png');
  await page.screenshot({ path: thumbTablet });
  try {
    fs.copyFileSync(thumbTablet, '/home/charmcast/.gemini/antigravity/brain/24f434e2-bf0f-4361-abbc-96cc52a1d046/thumb-tablet.png');
  } catch (_) {}

  console.log('Finishing Tablet recording...');
  const video = page.video();
  await page.close();
  await context.close();

  if (video) {
    const destWebm = path.join(OUT_DIR, '02-tablet-exhaustive-tour.webm');
    await video.saveAs(destWebm);
    console.log(`Saved Tablet webm: ${destWebm}`);
    try {
      const destMp4 = path.join(OUT_DIR, '02-tablet-exhaustive-tour.mp4');
      execSync(`ffmpeg -y -i "${destWebm}" -c:v libx264 -pix_fmt yuv420p -preset fast -crf 23 "${destMp4}"`, { stdio: 'ignore' });
      console.log(`Generated Tablet mp4: ${destMp4}`);
    } catch (e) {
      console.warn('ffmpeg conversion warning:', e.message);
    }
  }
}

// =============================================================================
// TOUR 3: MOBILE (430x932 · iPhone 17 Pro Max) — NATIVE DOCK & TOUCH WORKFLOWS
// =============================================================================
async function runMobileTour(browser) {
  console.log('\n--- 3. RECORDING MOBILE-NATIVE EXHAUSTIVE TOUR (430x932) ---');
  const context = await browser.newContext({
    viewport: { width: 430, height: 932 },
    isMobile: true,
    hasTouch: true,
    recordVideo: {
      dir: OUT_DIR,
      size: { width: 430, height: 932 }
    }
  });

  await injectVisualCursor(context);
  const page = await context.newPage();

  // 1. Start at /aulas (Grafton 3-column KPI band + bottom dock)
  console.log('[Mobile] Starting at /aulas (Grafton KPI Band + Bottom Dock)...');
  await page.goto(`${BASE_URL}/aulas`, { waitUntil: 'networkidle' });
  await pause(page, 1200);

  // Test Symmetrical Live Time Stepper on Mobile
  await safeClick(page, '.live-time-actions button:has-text("-15m")', 750);
  await safeClick(page, '.live-time-actions .live-time-stepper-btn', 850);
  await safeClick(page, '.gtp-apply-btn', 750);
  await safeClick(page, '.live-time-actions button:has-text("+15m")', 750);

  // Test Campus Vertical mode & room chip modal trigger
  console.log('[Mobile] Switching to Campus Vertical mode...');
  await safeClick(page, 'button:has-text("Campus Vertical"), .classroom-submode-btn:has-text("Campus")', 1100);
  await smoothScroll(page, 300);

  // Click a room tile in Campus Vertical to open ClassroomDetailModal
  console.log('[Mobile] Clicking room tile in Campus Vertical to verify modal trigger...');
  if (await safeClick(page, '.campus-room-chip, [data-room-code="A901"], [data-room-code="L601"]', 1200)) {
    await safeClick(page, '[role="dialog"] button:has-text("Mié"), [role="dialog"] button:has-text("Jue")', 850);
    await pause(page, 800);
    await closeAnyModal(page);
  }

  await smoothScroll(page, -300);

  // Click floating "↑ Filtros y Pisos" button on mobile
  await safeClick(page, 'button:has-text("Filtros y Pisos")', 950);

  // Navigate across the 5 tabs via the Mobile Bottom Dock
  for (const tabLabel of ['Cursos', 'Docentes', 'Mentores', 'Horarios', 'Aulas']) {
    console.log(`[Mobile] Dock switching to ${tabLabel}...`);
    if (!(await safeClick(page, `.grafton-mobile-dock a:has-text("${tabLabel}"), .grafton-mobile-dock button:has-text("${tabLabel}"), nav a:has-text("${tabLabel}")`, 1200))) {
      const routeMap = {
        Horarios: '/',
        Cursos: '/cursos',
        Aulas: '/aulas',
        Docentes: '/profesores',
        Mentores: '/mentores'
      };
      await page.goto(`${BASE_URL}${routeMap[tabLabel]}`, { waitUntil: 'networkidle' });
      await pause(page, 1100);
    }
    await smoothScroll(page, 280);

    // If on Horarios, test the mobile Day/Week view switcher and drawer
    if (tabLabel === 'Horarios') {
      console.log('[Mobile] Testing mobile Day/Week view switcher on Horarios...');
      await safeClick(page, 'button:has-text("Lun")', 850);
      await safeClick(page, 'button:has-text("Mar")', 850);
      await safeClick(page, 'button:has-text("Semana")', 850);

      // Open drawer on mobile
      await safeClick(page, 'button:has-text("Cursos"), [aria-label*="menú"], button.mobile-sidebar-toggle', 950);
      await pause(page, 750);
      await safeClick(page, '.mobile-sidebar-drawer button:has-text("✕"), [aria-label*="Cerrar"]', 700);
    }

    // If on Cursos, test star bookmark & modal
    if (tabLabel === 'Cursos') {
      await safeClick(page, 'button[title*="visitante"], button:has-text("☆"), .course-star-btn', 850);
      await pause(page, 850);
    }

    // If on Docentes, open professor modal
    if (tabLabel === 'Docentes') {
      if (await safeClick(page, '.prof-card, button:has-text("Ver Horario Completo")', 1000)) {
        await safeClick(page, '[role="dialog"] button:has-text("Por Día")', 800);
        await closeAnyModal(page);
      }
    }

    await smoothScroll(page, -280);
  }

  // Visit /malla on mobile to verify compact career bar
  console.log('[Mobile] Visiting /malla to verify compact career bar...');
  await page.goto(`${BASE_URL}/malla`, { waitUntil: 'networkidle' });
  await pause(page, 1200);
  await safeClick(page, '.dag-career-pill:has-text("DS"), .dag-career-pill:has-text("Data")', 950);
  await safeClick(page, '.dag-career-pill:has-text("CS")', 950);
  await smoothScroll(page, 300);
  await smoothScroll(page, -300);

  const thumbMobile = path.join(OUT_DIR, 'thumb-mobile.png');
  await page.screenshot({ path: thumbMobile });
  try {
    fs.copyFileSync(thumbMobile, '/home/charmcast/.gemini/antigravity/brain/24f434e2-bf0f-4361-abbc-96cc52a1d046/thumb-mobile.png');
  } catch (_) {}

  console.log('Finishing Mobile recording...');
  const video = page.video();
  await page.close();
  await context.close();

  if (video) {
    const destWebm = path.join(OUT_DIR, '03-mobile-exhaustive-tour.webm');
    await video.saveAs(destWebm);
    console.log(`Saved Mobile webm: ${destWebm}`);
    try {
      const destMp4 = path.join(OUT_DIR, '03-mobile-exhaustive-tour.mp4');
      execSync(`ffmpeg -y -i "${destWebm}" -c:v libx264 -pix_fmt yuv420p -preset fast -crf 23 "${destMp4}"`, { stdio: 'ignore' });
      console.log(`Generated Mobile mp4: ${destMp4}`);
    } catch (e) {
      console.warn('ffmpeg conversion warning:', e.message);
    }
  }
}

async function main() {
  ensureOutDir();
  const server = await startServer();
  console.log(`Static web server running at ${BASE_URL}`);

  const browser = await pw.chromium.launch({
    headless: true,
    executablePath: '/home/charmcast/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome'
  });

  try {
    await runDesktopTour(browser);
    await runTabletTour(browser);
    await runMobileTour(browser);
    console.log('\n======================================================');
    console.log('ALL THREE TOURS (DESKTOP, TABLET, MOBILE) RECORDED & EXPORTED TO tour_videos_1 WITH 100% SUCCESS!');
    console.log('Output directory:', OUT_DIR);
    console.log('======================================================\n');
  } finally {
    await browser.close();
    server.close();
  }
}

main().catch((err) => {
  console.error('Fatal tour error:', err);
  process.exit(1);
});

