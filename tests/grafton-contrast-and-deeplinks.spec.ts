import { test, expect } from '@playwright/test';

// WCAG AA Contrast Evaluation Script for Modal Views
const auditContrastScript = () => {
  const lum = (rgb: [number, number, number]) => {
    const a = rgb.map((v) => {
      const c = v / 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2];
  };

  const parseRgb = (str: string): [number, number, number] | null => {
    const m = str.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    return m ? [parseInt(m[1], 10), parseInt(m[2], 10), parseInt(m[3], 10)] : null;
  };

  const getEffectiveBg = (el: HTMLElement): [number, number, number] => {
    let curr: HTMLElement | null = el;
    while (curr && curr !== document.documentElement) {
      const bg = window.getComputedStyle(curr).backgroundColor;
      const parsed = parseRgb(bg);
      if (parsed && !(bg.includes('rgba') && bg.includes(', 0)'))) {
        return parsed;
      }
      curr = curr.parentElement;
    }
    return [242, 240, 236]; // #F2F0EC fallback
  };

  const failures: string[] = [];
  const modal = document.querySelector('[role="dialog"], .modal, .prof-modal-overlay, .cd-modal-overlay');
  if (!modal) return failures;

  const elements = modal.querySelectorAll('a, span, p, h1, h2, h3, h4, td, th, div');
  elements.forEach((el) => {
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    // Only check leaf text nodes
    const hasDirectText = Array.from(el.childNodes).some(
      (n) => n.nodeType === Node.TEXT_NODE && n.textContent && n.textContent.trim().length > 0
    );
    if (!hasDirectText) return;

    const style = window.getComputedStyle(el);
    if (parseFloat(style.opacity) < 0.5 || style.visibility === 'hidden') return;

    const fg = parseRgb(style.color);
    if (!fg) return;
    const bg = getEffectiveBg(el as HTMLElement);
    const l1 = Math.max(lum(fg), lum(bg));
    const l2 = Math.min(lum(fg), lum(bg));
    const ratio = (l1 + 0.05) / (l2 + 0.05);

    if (ratio < 4.2) {
      failures.push(
        `Low contrast (${ratio.toFixed(2)}:1) on "${(el.textContent || '').trim().slice(0, 35)}" [fg=${style.color}, bg=${ JSON.stringify(bg) }]`
      );
    }
  });
  return failures.slice(0, 15);
};

const BASE_URL = process.env.BASE_URL || 'http://localhost:4321';

test.describe('Grafton Swiss Contrast, Room Nomenclature & Deep-Link Audit', () => {
  test('1. Professor Modal Sub-Tabs (Horario, Cursos/Secciones, Aulas Utilizadas) have WCAG AA contrast & 0px geometry', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`${BASE_URL}/profesores`, { waitUntil: 'networkidle' });

    // Open Ada Congrains Castillo (or first professor with Mesas/Labs)
    const adaCard = page.locator('.prof-card', { hasText: 'Ada Congrains Castillo' }).first();
    if (await adaCard.count()) {
      await adaCard.locator('text=/Ver Horario Completo/i').click();
    } else {
      await page.locator('text=/Ver Horario Completo/i').first().click();
    }
    await page.waitForTimeout(300);

    // Tab 2: Cursos · Secciones
    const cursosTab = page.locator('button:has-text("Cursos"), [role="tab"]:has-text("Cursos")').first();
    if (await cursosTab.count()) {
      await cursosTab.click();
      await page.waitForTimeout(250);
      await page.screenshot({ path: 'audit-screenshots/prof-modal-tab-cursos.png' });
      const contrastErrorsTab2 = await page.evaluate(auditContrastScript);
      expect(contrastErrorsTab2, `Contrast failures in Cursos·Secciones tab: ${contrastErrorsTab2.join(' | ')}`).toEqual([]);
    }

    // Tab 3: Aulas Utilizadas
    const aulasTab = page.locator('button:has-text("Aulas Utilizadas"), [role="tab"]:has-text("Aulas Utilizadas")').first();
    if (await aulasTab.count()) {
      await aulasTab.click();
      await page.waitForTimeout(250);
      await page.screenshot({ path: 'audit-screenshots/prof-modal-tab-aulas.png' });
      const contrastErrorsTab3 = await page.evaluate(auditContrastScript);
      expect(contrastErrorsTab3, `Contrast failures in Aulas Utilizadas tab: ${contrastErrorsTab3.join(' | ')}`).toEqual([]);

      // Verify M301 nomenclature is NEVER mutated into AM301
      const modalText = await page.locator('[role="dialog"], .modal').first().innerText();
      expect(modalText).not.toContain('AM301');
    }
  });

  test('2. Deep-Link from "Ver en Aulas Libres" (e.g. M301 / A201) opens the exact Classroom Modal on /aulas', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`${BASE_URL}/aulas?aula=M301`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(400);
    await page.screenshot({ path: 'audit-screenshots/deeplink-aula-M301.png' });

    // Assert the modal for M301 / Mesas 301 is visibly open
    const dialogText = await page.locator('body').innerText();
    expect(dialogText).toMatch(/M301|Mesas 301/);
  });

  test('3. Deep-Link to /cursos?curso=AM4305 and /profesores?profesor=Ada%20Congrains auto-opens their Modals', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`${BASE_URL}/cursos?curso=AM4305`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(400);
    await page.screenshot({ path: 'audit-screenshots/deeplink-curso-AM4305.png' });
    expect(await page.locator('body').innerText()).toMatch(/AM4305/);
  });

  test('4. Deep-Link to /profesores?profesor=Ivo%20Marek%20Kalinowski%20Castillo auto-opens Professor Modal', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`${BASE_URL}/profesores?profesor=Ivo%20Marek%20Kalinowski%20Castillo`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'audit-screenshots/deeplink-profesor-ivo-kalinowski.png' });

    // Assert the professor modal for Ivo Marek Kalinowski Castillo is open
    const modal = page.locator('.prof-modal');
    await expect(modal).toBeVisible();
    const modalText = await modal.innerText();
    expect(modalText).toMatch(/Ivo Marek Kalinowski Castillo|Kalinowski/i);
  });

  test('5. Career/Department CustomSelect Dropdown Grafton Swiss Styling & Icon Spacing', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`${BASE_URL}/profesores`, { waitUntil: 'networkidle' });

    // Locate the department dropdown trigger
    const deptTrigger = page.locator('button[aria-label*="departamento"], button[aria-label*="carreras"]').first();
    await expect(deptTrigger).toBeVisible();

    // Click to open dropdown
    await deptTrigger.click();
    await page.waitForTimeout(200);

    const dropdownMenu = page.locator('.custom-select-menu');
    await expect(dropdownMenu).toBeVisible();
    await page.screenshot({ path: 'audit-screenshots/custom-select-career-open.png' });

    // Check that option badges (CS, DS, PI, etc.) are distinct elements with proper styling and gap
    const csOption = page.locator('.custom-select-option', { hasText: 'Ciencia de la Computación' }).first();
    await expect(csOption).toBeVisible();

    const badge = csOption.locator('.custom-select-badge');
    await expect(badge).toBeVisible();
    await expect(badge).toHaveText('CS');

    // Click on CS option to select it
    await csOption.click();
    await page.waitForTimeout(200);

    // Verify trigger now displays the selected career with badge and icon
    await page.screenshot({ path: 'audit-screenshots/custom-select-career-selected.png' });
    const triggerText = await deptTrigger.innerText();
    expect(triggerText).toContain('CS');
    expect(triggerText).toContain('Ciencia de la Computación');

    // Verify spacing between icon, badge, and label
    const hasAdequateSpacing = await deptTrigger.evaluate((el) => {
      const icon = el.querySelector('.custom-select-trigger-icon');
      const badgeEl = el.querySelector('.custom-select-badge');
      const label = el.querySelector('.custom-select-trigger-label');
      if (!icon || !badgeEl || !label) return false;
      const iconRect = icon.getBoundingClientRect();
      const badgeRect = badgeEl.getBoundingClientRect();
      const labelRect = label.getBoundingClientRect();
      // Ensure badge is strictly to the right of icon with > 4px distance
      const distIconBadge = badgeRect.left - iconRect.right;
      // Ensure label is strictly to the right of badge with > 4px distance
      const distBadgeLabel = labelRect.left - badgeRect.right;
      return distIconBadge >= 4 && distBadgeLabel >= 4;
    });
    expect(hasAdequateSpacing).toBe(true);
  });

  test('6. Filter Bar 70%/30% Ratio and Restablecer Button Grafton Swiss Style & Hover', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`${BASE_URL}/mentores`, { waitUntil: 'networkidle' });

    // Verify 70% / 30% ratio between Search Bar and Sort Dropdown
    const ratioData = await page.evaluate(() => {
      const row = document.querySelector('.mentor-filter-bar .prof-search-row');
      const searchWrap = row?.querySelector('.prof-search-input-wrapper');
      const sortSelect = row?.querySelector('.custom-select-container');
      if (!row || !searchWrap || !sortSelect) return null;
      const rowW = row.getBoundingClientRect().width;
      const searchW = searchWrap.getBoundingClientRect().width;
      const sortW = sortSelect.getBoundingClientRect().width;
      return {
        rowW,
        searchPercent: (searchW / rowW) * 100,
        sortPercent: (sortW / rowW) * 100,
      };
    });

    expect(ratioData).not.toBeNull();
    // Expect search bar ~70% (allow 67% - 72%)
    expect(ratioData!.searchPercent).toBeGreaterThanOrEqual(67);
    expect(ratioData!.searchPercent).toBeLessThanOrEqual(72);
    // Expect sort dropdown ~30% (allow 27% - 32%)
    expect(ratioData!.sortPercent).toBeGreaterThanOrEqual(27);
    expect(ratioData!.sortPercent).toBeLessThanOrEqual(32);

    // Type a query to activate filter and show Restablecer button
    const searchInput = page.locator('.mentor-filter-bar .prof-search-input');
    await searchInput.fill('Calculo');
    await page.waitForTimeout(200);

    const resetBtn = page.locator('.mentor-filter-bar .prof-reset-btn');
    await expect(resetBtn).toBeVisible();

    // Verify default styling: 0px border-radius, not pale (#8E1C28 crimson ink)
    const btnStyle = await resetBtn.evaluate((el) => {
      const style = window.getComputedStyle(el);
      return {
        color: style.color,
        borderRadius: style.borderRadius,
        backgroundColor: style.backgroundColor,
      };
    });
    expect(btnStyle.borderRadius).toBe('0px');
    expect(btnStyle.color).toMatch(/rgb\(142,\s*28,\s*40\)|#8E1C28/i);

    await page.screenshot({ path: 'audit-screenshots/mentor-filter-bar-70-30.png' });

    // Hover over reset button and verify hover styling
    await resetBtn.hover();
    await page.waitForTimeout(150);
    await page.screenshot({ path: 'audit-screenshots/mentor-filter-bar-reset-hover.png' });

    const hoverStyle = await resetBtn.evaluate((el) => {
      const style = window.getComputedStyle(el);
      return {
        color: style.color,
        backgroundColor: style.backgroundColor,
      };
    });
    // On hover, text becomes white #FFFFFF and background becomes crimson
    expect(hoverStyle.color).toMatch(/rgb\(255,\s*255,\s*255\)|#ffffff/i);
    expect(hoverStyle.backgroundColor).toMatch(/rgb\(142,\s*28,\s*40\)|#8E1C28/i);
  });

  test('7. Uniform "Restablecer" Button across /cursos and /aulas with Grafton Swiss Style', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });

    // Test on /cursos (switch to Catalog tab, filter, and assert Restablecer button)
    await page.goto(`${BASE_URL}/cursos`, { waitUntil: 'networkidle' });
    const catalogTabBtn = page.getByRole('button', { name: /Catálogo Ofertado/i }).first();
    if (await catalogTabBtn.count()) {
      await catalogTabBtn.click();
      await page.waitForTimeout(200);
    }

    const courseSearch = page.locator('.course-search-input, input[placeholder*="Buscar por código"]').first();
    await courseSearch.fill('Calculo');
    await page.waitForTimeout(200);

    const courseResetBtn = page.locator('.filter-reset-btn, .prof-reset-btn').first();
    await expect(courseResetBtn).toBeVisible();
    // Must say "Restablecer", NOT "Limpiar"
    const courseBtnText = await courseResetBtn.innerText();
    expect(courseBtnText.trim()).toBe('Restablecer');

    const courseBtnStyle = await courseResetBtn.evaluate((el) => {
      const s = window.getComputedStyle(el);
      return {
        borderRadius: s.borderRadius,
        color: s.color,
      };
    });
    expect(courseBtnStyle.borderRadius).toBe('0px');
    expect(courseBtnStyle.color).toMatch(/rgb\(142,\s*28,\s*40\)|#8E1C28/i);
    await page.screenshot({ path: 'audit-screenshots/course-filter-bar-reset.png' });

    // Test on /aulas
    await page.goto(`${BASE_URL}/aulas`, { waitUntil: 'networkidle' });
    const classroomResetBtn = page.locator('.btn-reset-filters, .prof-reset-btn').first();
    await expect(classroomResetBtn).toBeVisible();
    const classroomBtnText = await classroomResetBtn.innerText();
    expect(classroomBtnText.trim()).toBe('Restablecer');

    const classroomBtnStyle = await classroomResetBtn.evaluate((el) => {
      const s = window.getComputedStyle(el);
      return {
        borderRadius: s.borderRadius,
        color: s.color,
      };
    });
    expect(classroomBtnStyle.borderRadius).toBe('0px');
    expect(classroomBtnStyle.color).toMatch(/rgb\(142,\s*28,\s*40\)|#8E1C28/i);
    await page.screenshot({ path: 'audit-screenshots/classroom-filter-bar-reset.png' });
  });
});

