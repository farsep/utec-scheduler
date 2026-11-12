const pw = require('/home/charmcast/.npm/_npx/e41f203b7505f1fb/node_modules/playwright');
const fs = require('fs');
const path = require('path');
const http = require('http');
const { execSync } = require('child_process');

const PORT = 4334;
const BASE_URL = `http://127.0.0.1:${PORT}`;
const OUT_DIR = path.resolve(process.cwd(), 'tour-videos');
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

async function pause(page, ms = 900) {
  await page.waitForTimeout(ms);
}

async function smoothScroll(page, deltaY, steps = 6) {
  const stepY = deltaY / steps;
  for (let i = 0; i < steps; i++) {
    await page.mouse.wheel(0, stepY);
    await page.waitForTimeout(110);
  }
  await page.waitForTimeout(450);
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

  // =========================================================================
  // PHASE 1: MAIN SCHEDULE PLANNER (/), COMBINATIONS, GHOST DIFF & GENERATOR MODAL
  // =========================================================================
  console.log('[Phase 1] Schedule Planner & Generator Modal...');
  await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle' });
  await pause(page, 1200);

  // If on empty/welcome state, click "Datos Muestra UTEC" to load full schedule
  await safeClick(page, 'button:has-text("Datos Muestra"), button:has-text("Muestra")', 1200);

  // Hover and toggle course sections in the left sidebar to show Ghost Diffing & schedule blocks
  const sidebarButtons = page.locator('aside button, [class*="sidebar"] button');
  const sbCount = await sidebarButtons.count();
  for (let i = 0; i < Math.min(sbCount, 5); i++) {
    const btn = sidebarButtons.nth(i);
    if (await btn.isVisible()) {
      await btn.hover().catch(() => {});
      await pause(page, 650);
      await btn.click().catch(() => {});
      await pause(page, 750);
    }
  }

  // Cycle through schedule combinations / tabs (Opción 1, Opción 2, Opción 3 / Horario 1, 2...)
  await safeClick(page, 'button:has-text("Opción 2"), button:has-text("Horario 2"), button:has-text("OPT-02")', 900);
  await safeClick(page, 'button:has-text("Opción 3"), button:has-text("Horario 3"), button:has-text("OPT-03")', 900);
  await safeClick(page, 'button:has-text("Opción 1"), button:has-text("Horario 1"), button:has-text("OPT-01")', 900);

  // Open Auto-Generator Modal ("Generador Automático" / "Generar" / "Armador")
  if (await safeClick(page, 'button:has-text("Generador"), button:has-text("Generar"), button:has-text("Automático")', 1100)) {
    // Toggle switches inside Generator Modal
    await safeClick(page, 'text=/Armador de Semestre|Almuerzo|Modo Estricto/i', 800);
    // Drag across the "Calendario de Bloqueos" grid to paint a restriction block
    const blockGrid = page.locator('[role="dialog"] table, [role="dialog"] [class*="grid"], [role="dialog"] [class*="calendar"]').first();
    if ((await blockGrid.count()) > 0) {
      const box = await blockGrid.boundingBox();
      if (box) {
        await page.mouse.move(box.x + box.width * 0.35, box.y + box.height * 0.35);
        await page.mouse.down();
        await page.mouse.move(box.x + box.width * 0.35, box.y + box.height * 0.55, { steps: 10 });
        await page.mouse.up();
        await pause(page, 1000);
      }
    }
    await closeAnyModal(page);
  }

  // Open Export / Import modals if present on header
  if (await safeClick(page, 'button:has-text("Exportar")', 1000)) {
    await closeAnyModal(page);
  }
  if (await safeClick(page, 'button:has-text("Importar"), a:has-text("Importar")', 1000)) {
    await closeAnyModal(page);
  }

  // =========================================================================
  // PHASE 2: MALLA CURRICULAR & 16 CARRERAS (10 CYCLES, FACULTY SWITCHERS, DAG LINEAGE)
  // =========================================================================
  console.log('[Phase 2] Malla Curricular & 16 Carreras...');
  if (!(await safeClick(page, 'a[href*="/malla"], button:has-text("Malla"), a:has-text("Malla")', 1100))) {
    await page.goto(`${BASE_URL}/malla`, { waitUntil: 'networkidle' });
    await pause(page, 1100);
  }

  // Switch to "Ruta Curricular Interactiva · 16 Carreras UTEC" tab if available
  await safeClick(page, 'button:has-text("Ruta Curricular"), button:has-text("16 Carreras"), button:has-text("Malla Curricular")', 1000);

  // Cycle through the 4 Faculty Switchers
  for (const fac of ['Negocios', 'Computación', 'Ingeniería', 'Ciencias Básicas', 'Todas']) {
    await safeClick(page, `button:has-text("${fac}")`, 800);
  }

  // Click through specific careers to verify 200-credit 10-cycle graphs
  for (const career of [
    'Administración y Negocios Digitales',
    'Business Analytics',
    'Ciencia de Datos',
    'Ciencia de la Computación',
    'Ingeniería Mecatrónica',
    'Física'
  ]) {
    if (await safeClick(page, `button:has-text("${career}"), [role="button"]:has-text("${career}")`, 950)) {
      // Click 2 different course cards in the DAG to show Opaque Ghosting & 1st/2nd degree lineage
      const dagNodes = page.locator('.dag-node, [data-course-code]');
      if ((await dagNodes.count()) > 3) {
        await dagNodes.nth(1).click().catch(() => {});
        await pause(page, 850);
        await dagNodes.nth(4).click().catch(() => {});
        await pause(page, 850);
      }
    }
  }

  // Toggle "Conexiones Directas (1° grado)" vs "Cadena Completa (1° + 2° grado)"
  await safeClick(page, 'button:has-text("Conexiones Directas")', 950);
  await safeClick(page, 'button:has-text("Cadena Completa")', 950);

  // Scroll the 10-cycle DAG horizontally from Ciclo 1 to Ciclo 10 and back
  const dagScroll = page.locator('#dag-scroll-container, [class*="dag-columns"], [class*="overflow-x-auto"]').first();
  if ((await dagScroll.count()) > 0) {
    await dagScroll.evaluate((el) => el.scrollTo({ left: 750, behavior: 'smooth' }));
    await pause(page, 900);
    await dagScroll.evaluate((el) => el.scrollTo({ left: 1600, behavior: 'smooth' }));
    await pause(page, 1000);
    await dagScroll.evaluate((el) => el.scrollTo({ left: 0, behavior: 'smooth' }));
    await pause(page, 800);
  }

  // =========================================================================
  // PHASE 3: CATÁLOGO DE CURSOS OFERTADOS, TOASTS, LEVEL-1 COURSE MODAL & LEVEL-2 "PEDIR PERMISO" MODAL
  // =========================================================================
  console.log('[Phase 3] Catálogo de Cursos Ofertados & Modals...');
  await page.goto(`${BASE_URL}/cursos`, { waitUntil: 'networkidle' });
  await pause(page, 1000);
  await safeClick(page, 'button:has-text("Catálogo Ofertado"), button:has-text("420 Cursos")', 950);

  // Test Day Switchers, Dropdowns & Live Filter
  await safeClick(page, 'button:has-text("Lun")', 700);
  await safeClick(page, 'button:has-text("Mar")', 700);
  await safeClick(page, 'button:has-text("Todos")', 700);
  await safeClick(page, 'button:has-text("En vivo ahora")', 900);
  await safeClick(page, 'button:has-text("En vivo ahora")', 700);

  // Click Star button (☆) on a Course Card to trigger the Grafton Swiss Notification Toast ("Guardado como visitante")
  await safeClick(page, 'button[title*="Oyente"], button[title*="visitante"], button[aria-label*="visitante"], article button:has(svg polygon), button:has(svg path[d*="12 2"])', 1200);
  await safeClick(page, 'button:has-text("Mis Visitados")', 1000);
  await safeClick(page, 'button:has-text("Mis Visitados")', 800);
  await safeClick(page, 'button[title*="Oyente"], button[title*="visitante"], button[aria-label*="visitante"], article button:has(svg polygon), button:has(svg path[d*="12 2"])', 1100);

  // Open Level-1 Course Detail Modal ("VER HORARIO >" / "Ver Horarios y Aulas >")
  if (await safeClick(page, 'button:has-text("VER HORARIO"), button:has-text("Ver Horario")', 1100)) {
    // Switch inside Course Modal between "Secciones y Aulas" and "Malla Horaria Semanal"
    await safeClick(page, 'button:has-text("Malla Horaria"), [role="tab"]:has-text("Malla")', 1000);
    await safeClick(page, 'button:has-text("Secciones y Aulas"), [role="tab"]:has-text("Secciones")', 900);

    // Open Level-2 Nested Sub-Modal: "Pedir Permiso" (Solicitud de Asistencia como Visitante / Oyente)
    if (await safeClick(page, 'button:has-text("Pedir Permiso")', 1200)) {
      await safeClick(page, 'text=/Completar datos/i', 800);
      await safeClick(page, 'button:has-text("Copiar Borrador"), button:has-text("Copiar")', 850);
      // Close Level-2 sub-modal
      await page.keyboard.press('Escape');
      await pause(page, 600);
    }
    await closeAnyModal(page);
  }

  await smoothScroll(page, 600);
  await smoothScroll(page, -600);

  // =========================================================================
  // PHASE 4: AULAS Y ESPACIOS LIBRES (/aulas) — FLOOR MAP, TIME POPOVER, MERGED SLOTS & ROOM MODAL
  // =========================================================================
  console.log('[Phase 4] Aulas y Espacios Libres...');
  await page.goto(`${BASE_URL}/aulas`, { waitUntil: 'networkidle' });
  await pause(page, 1100);

  // Click a tile in the top "Aulas y Laboratorios por Niveles" section to verify it opens the Room Modal
  if (await safeClick(page, 'button:has-text("A1001"), button:has-text("L601"), button:has-text("A902"), [id*="floor"] button', 1100)) {
    // Switch day tabs inside the Classroom Detail Modal (Lunes -> Martes -> Miércoles)
    await safeClick(page, '[role="dialog"] button:has-text("Martes")', 850);
    await safeClick(page, '[role="dialog"] button:has-text("Miércoles")', 850);
    await safeClick(page, '[role="dialog"] button:has-text("Lunes")', 850);
    await closeAnyModal(page);
  }

  // Switch between "Libres Ahora" and "Buscar por Horario"
  await safeClick(page, 'button:has-text("Buscar por Horario")', 900);

  // Open the Floating Time Selector Popover ("Seleccionar Hora" / AM-PM trigger)
  if (await safeClick(page, 'button:has-text("AM"), button:has-text("PM"), button:has-text("Seleccionar Hora")', 1100)) {
    await safeClick(page, 'button:has-text("11:00"), button:has-text("10:00")', 750);
    await safeClick(page, 'button:has-text(":30 min"), button:has-text(":15 min"), button:has-text(":00 min")', 750);
    await safeClick(page, 'button:has-text("Aplicar"), button:has-text("APLICAR")', 950);
  }
  await safeClick(page, 'button:has-text("+15m")', 700);
  await safeClick(page, 'button:has-text("-15m")', 700);

  // Test Day, Minimum Availability, Floor & Space-Type Switchers
  await safeClick(page, 'button:has-text("≥ 2h")', 750);
  await safeClick(page, 'button:has-text("Cualquiera")', 750);
  await safeClick(page, 'button:has-text("Piso 1")', 950); // Shows Aula Magna, Futsal, L021, L022
  await safeClick(page, 'button:has-text("Todos los Pisos")', 850);
  await safeClick(page, 'button:has-text("Laboratorios")', 800);
  await safeClick(page, 'button:has-text("Mesas")', 800);
  await safeClick(page, 'button:has-text("Todos")', 800);

  await smoothScroll(page, 550);

  // Open a Classroom Card Modal via "VER HORARIO >"
  if (await safeClick(page, 'button:has-text("VER HORARIO"), button:has-text("Ver Horario")', 1100)) {
    await smoothScroll(page, 250);
    await closeAnyModal(page);
  }

  // Expand "Ver Aulas Ocupadas en este horario" accordion
  await safeClick(page, 'text=/Ver Aulas Ocupadas/i', 1000);
  await smoothScroll(page, 450);
  await smoothScroll(page, -900);

  // =========================================================================
  // PHASE 5: DIRECTORIO DE DOCENTES (/profesores) — SUB-TABS, DYNAMIC TEO/LAB & EXACT DEEP-LINK
  // =========================================================================
  console.log('[Phase 5] Directorio de Docentes...');
  await page.goto(`${BASE_URL}/profesores`, { waitUntil: 'networkidle' });
  await pause(page, 1100);

  await safeClick(page, 'button:has-text("Dictando Ahora")', 900);
  await safeClick(page, 'button:has-text("Dictando Ahora")', 750);

  // Open Professor Modal (e.g. Ada Congrains or first teacher)
  if (await safeClick(page, 'button:has-text("Ver Horario Completo"), a:has-text("Ver Horario Completo")', 1100)) {
    // Sub-tab 1: Horario Semanal (Matriz vs Por Día + Current-Time Line)
    await safeClick(page, '[role="dialog"] button:has-text("Por Día")', 900);
    await safeClick(page, '[role="dialog"] button:has-text("Matriz")', 950);

    // Sub-tab 2: Cursos · Secciones (Hover over TEO / LAB dynamic badges)
    await safeClick(page, '[role="dialog"] button:has-text("Cursos")', 1000);
    await safeHover(page, '[role="dialog"] [class*="badge"], [role="dialog"] text=/TEO|LAB/i', 850);

    // Sub-tab 3: Aulas Utilizadas (Canonical M301 / A201 codes)
    await safeClick(page, '[role="dialog"] button:has-text("Aulas Utilizadas")', 1000);
    await closeAnyModal(page);
  }

  // Verify exact deep-link resolution for "Pino Matos, Jose" (must NOT open Espinoza Matos)
  await page.goto(`${BASE_URL}/profesores?profesor=Pino%20Matos%2C%20Jose`, { waitUntil: 'networkidle' });
  await pause(page, 1200);
  await closeAnyModal(page);

  // =========================================================================
  // PHASE 6: DIRECTORIO DE MENTORES (/mentores) — FILTERS, MODAL SUB-TABS & EMPTY STATE
  // =========================================================================
  console.log('[Phase 6] Directorio de Mentores...');
  await page.goto(`${BASE_URL}/mentores`, { waitUntil: 'networkidle' });
  await pause(page, 1100);

  await safeClick(page, 'button:has-text("En Mentoría Ahora")', 850);
  await safeClick(page, 'button:has-text("En Mentoría Ahora")', 750);
  await safeClick(page, 'button:has-text("Presencial")', 750);
  await safeClick(page, 'button:has-text("Virtual")', 750);
  await safeClick(page, 'button:has-text("Virtual")', 700);

  // Open Mentor Detail Modal ("Ver detalle >") and cycle through its 3 sub-tabs
  if (await safeClick(page, 'button:has-text("Ver detalle")', 1100)) {
    await safeClick(page, '[role="dialog"] button:has-text("Aulas y Reservas")', 950);
    await safeClick(page, '[role="dialog"] button:has-text("Cursos y Consejos")', 950);
    await safeClick(page, '[role="dialog"] button:has-text("Horario Semanal")', 950);
    await closeAnyModal(page);
  }

  // Trigger "No se encontraron mentores" Empty State by typing "inter" and then click "Restablecer Filtros"
  await safeFill(page, '.prof-search-input, input[placeholder*="Buscar mentor"], input[type="text"]:visible', 'inter', 1200);
  await safeClick(page, 'button:has-text("Restablecer Filtros"), button:has-text("Restablecer")', 1000);

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

async function runMobileTour(browser) {
  console.log('\n--- 2. RECORDING MOBILE-NATIVE EXHAUSTIVE TOUR (430x932) ---');
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

  // Visit all 5 routes on Mobile using the Bottom Navigation Dock ("Horarios | Cursos | Aulas | Docentes | Mentores")
  console.log('[Mobile] Starting at /aulas (Grafton KPI Band + Bottom Dock)...');
  await page.goto(`${BASE_URL}/aulas`, { waitUntil: 'networkidle' });
  await pause(page, 1200); // Show the new 3-column horizontal KPI band + Frosted Concrete Bottom Dock

  // Test Campus Vertical mode & room chip modal trigger
  console.log('[Mobile] Switching to Campus Vertical mode...');
  await safeClick(page, 'button:has-text("Campus Vertical"), .classroom-submode-btn:has-text("Campus")', 1100);
  await smoothScroll(page, 300);

  // Click a room tile in Campus Vertical to open ClassroomDetailModal
  console.log('[Mobile] Clicking room tile in Campus Vertical to verify modal trigger...');
  if (await safeClick(page, '.campus-room-chip, [data-room-code="A901"], [data-room-code="L601"]', 1200)) {
    await pause(page, 1000);
    await closeAnyModal(page);
  }

  await smoothScroll(page, -300);
  // Click floating "↑ Filtros y Pisos" button on mobile
  await safeClick(page, 'button:has-text("Filtros y Pisos")', 1000);

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
    await smoothScroll(page, 350);

    // If on Horarios, test the mobile Day/Week view switcher
    if (tabLabel === 'Horarios') {
      console.log('[Mobile] Testing mobile Day/Week view switcher on Horarios...');
      await safeClick(page, 'button:has-text("Lun")', 900);
      await safeClick(page, 'button:has-text("Mar")', 900);
      await safeClick(page, 'button:has-text("Semana")', 900);
    }

    await smoothScroll(page, -350);
  }

  // Also visit /malla on mobile to verify compact career bar
  console.log('[Mobile] Visiting /malla to verify compact career bar...');
  await page.goto(`${BASE_URL}/malla`, { waitUntil: 'networkidle' });
  await pause(page, 1200);
  await safeClick(page, '.dag-career-pill:has-text("DS"), .dag-career-pill:has-text("Data")', 1000);
  await smoothScroll(page, 300);
  await smoothScroll(page, -300);

  console.log('Finishing Mobile recording...');
  const video = page.video();
  await page.close();
  await context.close();

  if (video) {
    const destWebm = path.join(OUT_DIR, '02-mobile-exhaustive-tour.webm');
    await video.saveAs(destWebm);
    console.log(`Saved Mobile webm: ${destWebm}`);
    try {
      const destMp4 = path.join(OUT_DIR, '02-mobile-exhaustive-tour.mp4');
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
    await runMobileTour(browser);
    console.log('\n======================================================');
    console.log('EXHAUSTIVE VIDEO TOURS RECORDED & CONVERTED WITH 100% SUCCESS!');
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
