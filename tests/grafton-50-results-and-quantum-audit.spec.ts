import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const VIEWPORTS = [
  { name: 'desktop-1440x900', width: 1440, height: 900, isMobile: false, hasTouch: false },
  { name: 'tablet-mdpi-800x1280', width: 800, height: 1280, isMobile: false, hasTouch: true },
  { name: 'mobile-iphone-375x812', width: 375, height: 812, isMobile: true, hasTouch: true },
];

const SCREENSHOTS_DIR = path.join(process.cwd(), 'audit-screenshots');

test.describe('Grafton Swiss 50 Results + Quantum Visualizer Multi-Viewport Audit', () => {
  test.beforeAll(() => {
    if (!fs.existsSync(SCREENSHOTS_DIR)) {
      fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
    }
  });

  for (const vp of VIEWPORTS) {
    test(`[${vp.name}] Verify Quantum Animation, Zero Clipping, Zero Emojis, and Full 50-Result Flow`, async ({
      browser,
    }) => {
      const context = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        isMobile: vp.isMobile,
        hasTouch: vp.hasTouch,
      });
      const page = await context.newPage();
      const consoleErrors: string[] = [];
      page.on('pageerror', (err) => consoleErrors.push(err.message));
      page.on('dialog', async (d) => {
        consoleErrors.push(`DIALOG: ${d.message()}`);
        await d.dismiss();
      });

      await page.goto('/', { waitUntil: 'networkidle' });

      // Wait until initial sample courses finish booting
      const genTrigger = page
        .locator('button:has-text("Auto-Generar"), button[title*="Generador combinatorio"]')
        .first();
      await expect(genTrigger).toBeVisible({ timeout: 15000 });
      await genTrigger.click();

      const dialog = page.locator('[role="dialog"]').first();
      await expect(dialog).toBeVisible({ timeout: 5000 });

      // Enable Armador de Semestre (Modo Avanzado) and ensure >= 7 courses in pool so all 50 optimal combinations are produced
      const advToggle = dialog.getByText('Armador de Semestre (Modo Avanzado)');
      await expect(advToggle).toBeVisible();
      await advToggle.click();

      const unselectedItems = dialog.locator('.optimizer-course-item:not(.selected)');
      const availCount = await unselectedItems.count();
      const extraToPick = Math.min(4, availCount);
      for (let i = 0; i < extraToPick; i++) {
        await unselectedItems.first().click();
      }

      const genSubmit = dialog.locator('button:has-text("Generar Horarios")').first();
      await expect(genSubmit).toBeVisible();
      await expect(genSubmit).toBeEnabled();

      // Verify Braun/Teenage Engineering tactile active preference toggle & Tier 2 Generate button
      const configChromaticReport = await page.evaluate(() => {
        const activePref = document.querySelector('[role="dialog"] .pref-pill.active') as HTMLElement | null;
        const genBtn = document.querySelector('[role="dialog"] .optimizer-generate-btn') as HTMLElement | null;
        return {
          prefBg: activePref ? getComputedStyle(activePref).backgroundColor : null,
          genBg: genBtn ? getComputedStyle(genBtn).backgroundColor : null,
        };
      });
      expect(configChromaticReport.prefBg).toBe('rgb(0, 90, 140)');
      expect(configChromaticReport.genBg).toBe('rgb(0, 102, 140)');

      // Trigger generation and immediately capture Live Quantum Combinatorial Engine
      await genSubmit.click();

      const quantumVisualizer = dialog.locator('[data-testid="quantum-engine-visualizer"]');
      await expect(quantumVisualizer).toBeVisible({ timeout: 2000 });
      await expect(dialog.getByText(/MOTOR COMBINATORIO CUÁNTICO/i)).toBeVisible();

      // Screenshot while Quantum Combinatorial Engine animation is active
      await page.screenshot({
        path: path.join(SCREENSHOTS_DIR, `01-${vp.name}-quantum-engine.png`),
      });

      // Wait for Results View (Opción 1)
      expect(consoleErrors, 'No page errors or alert dialogs during optimization').toEqual([]);
      await expect(dialog.locator('text=Opción 1').first()).toBeVisible({ timeout: 25000 });

      // 1. Assert zero forbidden emojis anywhere inside modal dialog
      const modalText = (await dialog.textContent()) || '';
      expect(modalText).not.toMatch(/[🥇🥈🥉🎯⚡🌅🌇]/);

      // 2. Assert <1024px Full-Width View Switching
      if (vp.width < 1024) {
        const backBtn = dialog.locator('button:has-text("Configurar Cursos y Filtros")');
        await expect(backBtn).toBeVisible();
        await expect(dialog.locator('.optimizer-optimal-count-badge')).toBeVisible();

        const configVisible = await dialog.locator('.optimizer-config-panel').isVisible();
        expect(configVisible).toBe(false);

        const rightBox = await dialog.locator('.optimizer-right-panel').boundingBox();
        const dialogBox = await dialog.boundingBox();
        expect(rightBox).not.toBeNull();
        expect(dialogBox).not.toBeNull();
        expect(rightBox!.width).toBeGreaterThanOrEqual(dialogBox!.width * 0.94);
      }

      await page.screenshot({
        path: path.join(SCREENSHOTS_DIR, `02-${vp.name}-50-results-top.png`),
      });

      // 3. Bounding-box & Polychrome Swiss Chromatic Audit across ALL 50 cards (NO right-edge clipping, NO black button clones!)
      const fullAuditReport = await page.evaluate(() => {
        const d = document.querySelector('[role="dialog"]');
        if (!d) return { issues: ['Missing dialog'], checkedCards: 0 };
        const dRect = d.getBoundingClientRect();
        const issues: string[] = [];

        const parseRgb = (rgbStr: string): [number, number, number] => {
          const m = rgbStr.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
          return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : [0, 0, 0];
        };
        const luminance = ([r, g, b]: [number, number, number]) => {
          const a = [r, g, b].map((v) => {
            const s = v / 255;
            return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
          });
          return 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2];
        };
        const contrastRatio = (fg: string, bg: string) => {
          const l1 = luminance(parseRgb(fg));
          const l2 = luminance(parseRgb(bg));
          const lighter = Math.max(l1, l2);
          const darker = Math.min(l1, l2);
          return (lighter + 0.05) / (darker + 0.05);
        };

        const cards = Array.from(d.querySelectorAll('.optimizer-swiss-card'));
        if (cards.length !== 50) {
          issues.push(`Expected 50 cards, got ${cards.length}`);
        }

        const expectedFacultyCodeBgs = new Set([
          'rgb(0, 90, 140)',
          'rgb(184, 51, 42)',
          'rgb(184, 98, 0)',
          'rgb(61, 52, 139)',
        ]);

        cards.forEach((card, cIdx) => {
          const cRect = card.getBoundingClientRect();
          if (cRect.width > 0 && (cRect.right > dRect.right + 1 || cRect.right > window.innerWidth + 1)) {
            issues.push(`Card #${cIdx + 1} right=${Math.round(cRect.right)} > dialogRight=${Math.round(dRect.right)}`);
          }

          const previewBtn = card.querySelector('.btn-preview') as HTMLElement | null;
          const newTabBtn = card.querySelector('.btn-new-tab') as HTMLElement | null;
          const applyBtn = card.querySelector('.btn-apply') as HTMLElement | null;

          if (!previewBtn || !newTabBtn || !applyBtn) {
            issues.push(`Card #${cIdx + 1} missing one of the 3 action buttons`);
            return;
          }

          [previewBtn, newTabBtn, applyBtn].forEach((btn) => {
            const r = btn.getBoundingClientRect();
            if (r.width === 0 || r.height === 0) return;
            if (r.right > dRect.right + 1 || r.right > window.innerWidth + 1 || r.left < dRect.left - 1) {
              issues.push(
                `Card #${cIdx + 1} button "${(btn.textContent || '').trim()}" clipped: [${Math.round(r.left)}, ${Math.round(r.right)}] vs dialogRight=${Math.round(dRect.right)}`
              );
            }
          });

          const pBg = getComputedStyle(previewBtn).backgroundColor;
          const nBg = getComputedStyle(newTabBtn).backgroundColor;
          const aBg = getComputedStyle(applyBtn).backgroundColor;

          if (pBg !== 'rgb(224, 235, 245)') issues.push(`Card #${cIdx + 1} preview bg=${pBg}, expected rgb(224, 235, 245)`);
          if (nBg !== 'rgb(245, 232, 211)') issues.push(`Card #${cIdx + 1} new-tab bg=${nBg}, expected rgb(245, 232, 211)`);
          if (aBg !== 'rgb(13, 122, 78)') issues.push(`Card #${cIdx + 1} apply bg=${aBg}, expected rgb(13, 122, 78)`);
          if (new Set([pBg, nBg, aBg]).size !== 3 || [pBg, nBg, aBg].includes('rgb(24, 24, 26)')) {
            issues.push(`Card #${cIdx + 1} buttons lack 3 distinct non-black backgrounds: ${pBg}, ${nBg}, ${aBg}`);
          }
        });

        // Verify Zone A tier bands on #01, #02, #04
        const z1 = cards[0]?.querySelector('.optimizer-card-zone-a') as HTMLElement | null;
        const z2 = cards[1]?.querySelector('.optimizer-card-zone-a') as HTMLElement | null;
        const z4 = cards[3]?.querySelector('.optimizer-card-zone-a') as HTMLElement | null;
        if (z1 && getComputedStyle(z1).backgroundColor !== 'rgb(220, 238, 230)') {
          issues.push(`Option 1 Zone A bg=${getComputedStyle(z1).backgroundColor}`);
        }
        if (z2 && getComputedStyle(z2).backgroundColor !== 'rgb(224, 235, 245)') {
          issues.push(`Option 2 Zone A bg=${getComputedStyle(z2).backgroundColor}`);
        }
        if (z4 && getComputedStyle(z4).backgroundColor !== 'rgb(234, 231, 225)') {
          issues.push(`Option 4 Zone A bg=${getComputedStyle(z4).backgroundColor}`);
        }

        // Verify telemetry pill colors on Option 1
        const scorePill = cards[0]?.querySelector('.pill-score') as HTMLElement | null;
        const daysPill = cards[0]?.querySelector('.pill-days') as HTMLElement | null;
        const gapsPill = cards[0]?.querySelector('.pill-gaps') as HTMLElement | null;
        if (scorePill && getComputedStyle(scorePill).backgroundColor !== 'rgb(224, 235, 245)') {
          issues.push(`Score pill bg=${getComputedStyle(scorePill).backgroundColor}`);
        }
        if (daysPill && getComputedStyle(daysPill).backgroundColor !== 'rgb(234, 232, 245)') {
          issues.push(`Days pill bg=${getComputedStyle(daysPill).backgroundColor}`);
        }
        if (gapsPill && !['rgb(220, 238, 230)', 'rgb(245, 232, 211)'].includes(getComputedStyle(gapsPill).backgroundColor)) {
          issues.push(`Gaps pill bg=${getComputedStyle(gapsPill).backgroundColor}`);
        }

        // Verify Faculty Course Chips colors & WCAG AA contrast
        const codeEls = Array.from(d.querySelectorAll('.result-course-chip__code')).slice(0, 25) as HTMLElement[];
        const secEls = Array.from(d.querySelectorAll('.result-course-chip__sec')).slice(0, 25) as HTMLElement[];
        if (codeEls.length === 0 || secEls.length === 0) {
          issues.push('Missing .result-course-chip__code or .result-course-chip__sec');
        }
        codeEls.forEach((el, idx) => {
          const st = getComputedStyle(el);
          if (!expectedFacultyCodeBgs.has(st.backgroundColor)) {
            issues.push(`Chip code #${idx} unexpected bg=${st.backgroundColor}`);
          }
          const cr = contrastRatio(st.color, st.backgroundColor);
          if (cr < 4.35) {
            issues.push(`Chip code #${idx} contrast=${cr.toFixed(2)} < 4.35 (${st.color} on ${st.backgroundColor})`);
          }
        });
        secEls.forEach((el, idx) => {
          const st = getComputedStyle(el);
          const cr = contrastRatio(st.color, st.backgroundColor);
          if (cr < 7.0) {
            issues.push(`Chip sec #${idx} contrast=${cr.toFixed(2)} < 7.0 (${st.color} on ${st.backgroundColor})`);
          }
        });

        // Verify TopBar / MobileDock active module accent
        if (window.innerWidth >= 1024) {
          const activeNav = document.querySelector('.grafton-nav-btn.is-active') as HTMLElement | null;
          if (!activeNav || getComputedStyle(activeNav).backgroundColor !== 'rgb(224, 235, 245)') {
            issues.push(`Desktop active nav bg=${activeNav ? getComputedStyle(activeNav).backgroundColor : 'missing'}`);
          }
        } else {
          const dockSlider = document.querySelector('.grafton-mobile-dock[data-active-dock="schedule"] .grafton-dock-slider') as HTMLElement | null;
          if (!dockSlider || getComputedStyle(dockSlider).backgroundColor !== 'rgb(224, 235, 245)') {
            issues.push(`Mobile dock active slider bg=${dockSlider ? getComputedStyle(dockSlider).backgroundColor : 'missing'}`);
          }
        }

        return { issues, checkedCards: cards.length };
      });
      expect(fullAuditReport.checkedCards).toBe(50);
      expect(fullAuditReport.issues, `Chromatic/bounding issues on ${vp.name}`).toEqual([]);

      // 4. Scroll all the way down to the bottom option (up to Opción 50)
      const resultsContainer = dialog.locator('.optimizer-results-scroll.overflow-y-auto').last();
      await resultsContainer.evaluate((el) => {
        el.scrollTop = el.scrollHeight;
      });
      await page.waitForTimeout(250);

      const cardCount = await dialog.locator('.optimizer-swiss-card').count();
      expect(cardCount).toBe(50);
      await expect(dialog.locator('.optimizer-swiss-card .swiss-option-title', { hasText: 'Opción 50' })).toBeVisible();
      await expect(dialog.getByText('50 OPCIONES ÓPTIMAS', { exact: true })).toBeVisible();

      await page.screenshot({
        path: path.join(SCREENSHOTS_DIR, `03-${vp.name}-50-results-bottom.png`),
      });

      // Scroll back to top and verify Vista Previa toggle + Mobile/Tablet switch back to config
      await resultsContainer.evaluate((el) => {
        el.scrollTop = 0;
      });

      if (vp.width < 1024) {
        await dialog.locator('button:has-text("Configurar Cursos y Filtros")').click();
        await expect(dialog.locator('.optimizer-config-panel')).toBeVisible();
        await dialog.locator('.optimizer-mobile-back-results-btn').click();
        await expect(dialog.locator('.optimizer-results-scroll')).toBeVisible();
      }

      // Click Vista Previa on Option 1 then return
      await dialog.locator('.swiss-action-btn.btn-preview').first().click();
      await expect(dialog.getByText('Vista Previa del Horario')).toBeVisible();
      await dialog.locator('button:has-text("Volver a resultados")').click();

      // 5. Click Aplicar on Option 1 and verify modal closes cleanly
      const applyBtn = dialog.locator('.swiss-action-btn.btn-apply').first();
      await applyBtn.scrollIntoViewIfNeeded();
      await applyBtn.click();
      await expect(dialog).toBeHidden({ timeout: 5000 });

      await context.close();
    });
  }
});
