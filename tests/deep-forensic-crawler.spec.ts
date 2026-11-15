import { test, expect, Page, Locator } from '@playwright/test';

export async function assertPageVisualIntegrity(page: Page, contextLabel: string): Promise<string[]> {
  return page.evaluate((label) => {
    const errors: string[] = [];

    // 1. Check for ANY raw browser-default blue link rgb(0, 0, 238)
    for (const a of Array.from(document.querySelectorAll('a'))) {
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

    // 3. Check for leftover AI sparkles
    if (bodyText.includes('✨')) {
      errors.push(`[${label}] Leftover AI sparkle found on page`);
    }

    // 4. Horizontal overflow of root document
    if (document.documentElement.scrollWidth > document.documentElement.clientWidth + 2) {
      errors.push(
        `[${label}] Document horizontal overflow: scrollW=${document.documentElement.scrollWidth} clientW=${document.documentElement.clientWidth}`
      );
    }

    // 5. Contrast check + clipped timetable elements
    const parseRgb = (str: string): [number, number, number, number] | null => {
      const m = str.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
      if (!m) return null;
      return [Number(m[1]), Number(m[2]), Number(m[3]), m[4] !== undefined ? Number(m[4]) : 1];
    };
    const relLum = ([r, g, b]: [number, number, number]) => {
      const lin = (c: number) => {
        const s = c / 255;
        return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
      };
      return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
    };
    const getEffectiveBg = (el: Element): [number, number, number] => {
      let cur: Element | null = el;
      while (cur) {
        const parsed = parseRgb(getComputedStyle(cur).backgroundColor);
        if (parsed && parsed[3] > 0.2) return [parsed[0], parsed[1], parsed[2]];
        cur = cur.parentElement;
      }
      return [244, 243, 239];
    };

    const lowContrast: Array<Record<string, unknown>> = [];
    const clippedTextEls: string[] = [];
    const dialog = document.querySelector('[role="dialog"]');
    const scopeRoot = dialog || document.querySelector('main') || document.body;

    for (const el of Array.from(scopeRoot.querySelectorAll('*'))) {
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) < 0.2) continue;

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

      if (
        el.classList.contains('course-session-card') ||
        el.classList.contains('prof-session-block') ||
        el.classList.contains('course-card-block-sec') ||
        el.classList.contains('course-card-mobile-sub')
      ) {
        if (el.scrollHeight > el.clientHeight + 3) {
          clippedTextEls.push(
            `VCLIP:${el.className} (${el.scrollHeight}>${el.clientHeight}) "${(el as HTMLElement).innerText.replace(/\n/g, ' ').slice(0, 30)}"`
          );
        }
        if (
          (el.classList.contains('course-card-block-sec') || el.classList.contains('course-card-mobile-sub')) &&
          el.scrollWidth > el.clientWidth
        ) {
          clippedTextEls.push(
            `HCLIP:${el.className} (${el.scrollWidth}>${el.clientWidth}) "${(el as HTMLElement).innerText}"`
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

    // 6. Check dialog bounds & strict 0px Swiss corners inside active dialogs
    if (dialog) {
      const dialogInner = dialog.querySelector('[class*="modal"]:not([class*="overlay"]):not([class*="backdrop"])') || dialog;
      const dRect = dialogInner.getBoundingClientRect();
      if (dRect.right > window.innerWidth + 2 || dRect.left < -2) {
        errors.push(`[${label}] Modal horizontally outside viewport: left=${Math.round(dRect.left)}, right=${Math.round(dRect.right)}, vw=${window.innerWidth}`);
      }
      const roundOffenders: string[] = [];
      for (const el of Array.from(dialogInner.querySelectorAll('*'))) {
        const rect = el.getBoundingClientRect();
        if (rect.width <= 14 && rect.height <= 14) continue;
        const cs = getComputedStyle(el);
        const br = parseFloat(cs.borderTopLeftRadius || '0');
        if (br > 2 && rect.width < 9999 && !cs.borderRadius.includes('50%') && !cs.borderRadius.includes('999')) {
          roundOffenders.push(`${el.tagName.toLowerCase()}.${(el.className || '').toString().slice(0, 35)} radius=${cs.borderRadius}`);
        }
      }
      if (roundOffenders.length > 0) {
        errors.push(`[${label}] Rounded (>2px) elements in dialog (${roundOffenders.length}): ${JSON.stringify(roundOffenders.slice(0, 4))}`);
      }
    }

    return errors;
  }, contextLabel);
}

async function watchLayoutStability(page: Page, contextLabel: string, durationMs: number, allFindings: string[]) {
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

async function safeClick(locator: Locator, label: string, allFindings: string[], timeout = 3000): Promise<boolean> {
  try {
    await locator.click({ timeout });
    return true;
  } catch (err: any) {
    const firstLine = (err?.message || String(err)).split('\n')[0];
    allFindings.push(`[${label}] Click failed: ${firstLine}`);
    return false;
  }
}

const VIEWPORTS = [
  { name: 'mobile-375', width: 375, height: 812 },
  { name: 'mobile-412', width: 412, height: 915 },
  { name: 'tablet-800', width: 800, height: 1280 },
  { name: 'desktop-1440', width: 1440, height: 900 },
];

test.describe('Deep Forensic Visual & Interaction Crawler across All Views & Viewports', () => {
  for (const vp of VIEWPORTS) {
    test(`Full interactive visual & DOM integrity audit on ${vp.name} (${vp.width}x${vp.height})`, async ({ page }) => {
      test.setTimeout(600_000);
      await page.setViewportSize({ width: vp.width, height: vp.height });

      const allFindings: string[] = [];
      const consoleErrors: string[] = [];
      const pageErrors: string[] = [];

      page.on('pageerror', (err) => pageErrors.push(`[${vp.name}] pageerror: ${err.message}`));
      page.on('console', (msg) => {
        if (msg.type() === 'error') {
          consoleErrors.push(`[${vp.name}] console.error: ${msg.text()}`);
        }
      });

      const scan = async (ctx: string) => {
        const errs = await assertPageVisualIntegrity(page, ctx);
        allFindings.push(...errs);
      };

      // 1. / (Armador de Horarios)
      await page.goto('/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(350);
      await scan(`${vp.name}:/ (initial)`);

      for (const selectorText of [/Exportar/i, /Archivos|Subir|Datos/i, /Generador|Optimizar/i]) {
        const btn = page.locator('button', { hasText: selectorText }).first();
        if (await btn.isVisible().catch(() => false)) {
          if (await safeClick(btn, `${vp.name}:/ ${selectorText}`, allFindings)) {
            await page.waitForTimeout(250);
            await scan(`${vp.name}:/ (${selectorText})`);
            await page.keyboard.press('Escape');
            await page.waitForTimeout(200);
          }
        }
      }

      // 2. /cursos (AD2011 & HH2101)
      await page.goto('/cursos', { waitUntil: 'networkidle' });
      await page.waitForSelector('.course-finder-root .course-card', { timeout: 15000 });
      await scan(`${vp.name}:/cursos (grid)`);

      for (const courseCode of ['AD2011', 'HH2101']) {
        const searchIn = page.locator('.course-finder-root .course-filter-bar input.prof-search-input').first();
        await searchIn.fill(courseCode);
        await page.waitForTimeout(200);
        const card = page.locator('.course-finder-root .course-card', { hasText: courseCode }).first();
        if (await card.isVisible().catch(() => false)) {
          await safeClick(card.locator('.course-view-detail-btn'), `${vp.name}:/cursos/${courseCode} open`, allFindings);
          await page.waitForSelector('.course-modal-dialog', { timeout: 10000 });
          await page.waitForTimeout(250);
          await scan(`${vp.name}:/cursos/${courseCode} (Secciones)`);

          await safeClick(page.locator('.course-modal-tab-btn', { hasText: 'Malla Horaria' }), `${vp.name}:/cursos/${courseCode} MallaTab`, allFindings);
          await page.waitForSelector('.course-session-card', { timeout: 10000 });
          await page.waitForTimeout(250);
          await scan(`${vp.name}:/cursos/${courseCode} (Malla Matriz)`);
          await watchLayoutStability(page, `${vp.name}:/cursos/${courseCode} flicker check`, 1200, allFindings);

          const firstBlock = page.locator('.course-session-card').first();
          if (await safeClick(firstBlock, `${vp.name}:/cursos/${courseCode} firstBlock`, allFindings)) {
            await page.waitForTimeout(200);
            await scan(`${vp.name}:/cursos/${courseCode} (Inspector)`);
          }

          const zoomToggle = page.locator('.course-days-filter-pill').first();
          if (await zoomToggle.isVisible().catch(() => false)) {
            if (await safeClick(zoomToggle, `${vp.name}:/cursos/${courseCode} zoomToggle`, allFindings)) {
              await page.waitForTimeout(200);
              await scan(`${vp.name}:/cursos/${courseCode} (Zoom Mode)`);
              await safeClick(zoomToggle, `${vp.name}:/cursos/${courseCode} zoomToggleOff`, allFindings);
            }
          }

          const agendaBtn = page.locator('.course-timetable-toolbar button', { hasText: 'Agenda' }).first();
          if (await agendaBtn.isVisible().catch(() => false)) {
            if (await safeClick(agendaBtn, `${vp.name}:/cursos/${courseCode} agendaBtn`, allFindings)) {
              await page.waitForTimeout(200);
              await scan(`${vp.name}:/cursos/${courseCode} (Agenda)`);
            }
          }

          await safeClick(page.locator('.course-modal-close-btn'), `${vp.name}:/cursos/${courseCode} close`, allFindings);
          await page.waitForTimeout(250);
        }
      }

      // 3. /aulas (Verify Futsal is completely excluded + Modal + Inspector)
      await page.goto('/aulas', { waitUntil: 'networkidle' });
      await page.waitForSelector('.classroom-finder-root .classroom-card', { timeout: 15000 });
      await scan(`${vp.name}:/aulas (directory)`);

      await expect(page.locator('#room-card-FUTSAL')).toHaveCount(0);
      const aulasText = await page.locator('.classroom-finder-root').innerText();
      expect(aulasText).not.toMatch(/\bfutsal\b/i);

      const firstRoomCard = page.locator('.classroom-finder-root .classroom-card').first();
      if (await firstRoomCard.isVisible().catch(() => false)) {
        await safeClick(firstRoomCard, `${vp.name}:/aulas firstRoomCard`, allFindings);
        await page.waitForSelector('.classroom-modal', { timeout: 10000 });
        await page.waitForTimeout(250);
        await scan(`${vp.name}:/aulas (Modal)`);

        const modalDayTabs = page.locator('.classroom-modal .modal-day-tab');
        for (let t = 0; t < Math.min(await modalDayTabs.count(), 4); t++) {
          await safeClick(modalDayTabs.nth(t), `${vp.name}:/aulas dayTab${t}`, allFindings);
          await page.waitForTimeout(150);
          const occItem = page.locator('.classroom-modal .agenda-item--occupied').first();
          if (await occItem.isVisible().catch(() => false)) {
            await safeClick(occItem, `${vp.name}:/aulas occItem`, allFindings);
            await page.waitForTimeout(200);
            await scan(`${vp.name}:/aulas (Inspector)`);
            break;
          }
        }
        await safeClick(page.locator('.classroom-modal .modal-close-btn'), `${vp.name}:/aulas close`, allFindings);
        await page.waitForTimeout(250);
      }

      // 4. /profesores
      await page.goto('/profesores', { waitUntil: 'networkidle' });
      await page.waitForSelector('.professor-finder-root .professor-card, .prof-directory-root .professor-card', { timeout: 15000 });
      await scan(`${vp.name}:/profesores (directory)`);

      const firstProf = page.locator('.professor-finder-root .professor-card, .prof-directory-root .professor-card').first();
      if (await firstProf.isVisible().catch(() => false)) {
        await safeClick(firstProf, `${vp.name}:/profesores firstProf`, allFindings);
        await page.waitForSelector('.prof-modal', { timeout: 10000 });
        await page.waitForTimeout(250);
        await scan(`${vp.name}:/profesores (Modal)`);
        await watchLayoutStability(page, `${vp.name}:/profesores stability`, 1000, allFindings);
        await safeClick(page.locator('.prof-modal .modal-close-btn'), `${vp.name}:/profesores close`, allFindings);
        await page.waitForTimeout(250);
      }

      // 5. /mentores
      await page.goto('/mentores', { waitUntil: 'networkidle' });
      await page.waitForSelector('.mentor-finder-root .mentor-card, .mentor-directory-root .mentor-card', { timeout: 15000 });
      await scan(`${vp.name}:/mentores (directory)`);

      const firstMentor = page.locator('.mentor-finder-root .mentor-card, .mentor-directory-root .mentor-card').first();
      if (await firstMentor.isVisible().catch(() => false)) {
        await safeClick(firstMentor, `${vp.name}:/mentores firstMentor`, allFindings);
        await page.waitForSelector('.prof-modal', { timeout: 10000 });
        await page.waitForTimeout(250);
        await scan(`${vp.name}:/mentores (Modal)`);
        await safeClick(page.locator('.prof-modal .modal-close-btn'), `${vp.name}:/mentores close`, allFindings);
        await page.waitForTimeout(250);
      }

      // 6. /malla
      await page.goto('/malla', { waitUntil: 'networkidle' });
      await page.waitForSelector('.curricular-dag-root', { timeout: 15000 });
      await page.waitForTimeout(250);
      await scan(`${vp.name}:/malla (DAG)`);

      expect(pageErrors, `Page errors on ${vp.name}`).toEqual([]);
      expect(consoleErrors, `Console errors on ${vp.name}`).toEqual([]);
      expect(allFindings, `Visual/DOM defects found on ${vp.name}`).toEqual([]);
    });
  }
});
