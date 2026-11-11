import { test, expect } from '@playwright/test';

test.describe('Grafton Mobile KPI High-Density Band Audit', () => {
  test.use({ viewport: { width: 430, height: 932 } });

  test('Aulas Libres KPI Band matches 3-column industrial Swiss design with 0px radius', async ({ page }) => {
    await page.goto('/aulas');
    await page.waitForSelector('.grafton-mobile-kpi-band', { state: 'visible', timeout: 8000 });

    const kpiBand = page.locator('.grafton-mobile-kpi-band');
    await expect(kpiBand).toBeVisible();

    // 1. Assert borderRadius === 0px
    const borderRadius = await kpiBand.evaluate(el => window.getComputedStyle(el).borderRadius);
    expect(borderRadius).toBe('0px');

    // 2. Assert display matches 3-column split grid
    const grid = kpiBand.locator('.grafton-kpi-grid');
    const gridDisplay = await grid.evaluate(el => window.getComputedStyle(el).display);
    expect(gridDisplay).toBe('grid');

    const compartments = kpiBand.locator('.grafton-kpi-compartment');
    await expect(compartments).toHaveCount(3);

    // 3. Assert text labels render EXACTLY only "AULAS LIBRES", "ESPACIOS", and "PISOS UTEC"
    const labels = await kpiBand.locator('.grafton-kpi-label').allTextContents();
    const cleanLabels = labels.map(l => l.trim());
    expect(cleanLabels).toEqual(['AULAS LIBRES', 'ESPACIOS', 'PISOS UTEC']);

    // Check that no leftover technical variables like [9px] or [#5A5852] are visible in the labels
    for (const label of cleanLabels) {
      expect(label).not.toContain('[');
      expect(label).not.toContain(']');
      expect(label).not.toContain('px');
      expect(label).not.toContain('#');
    }

    // 4. Confirm horizontal panel does NOT trigger parent horizontal page overflow
    const bodyScrollWidth = await page.evaluate(() => document.body.scrollWidth);
    const bodyClientWidth = await page.evaluate(() => document.body.clientWidth);
    expect(bodyScrollWidth).toBeLessThanOrEqual(bodyClientWidth + 1);

    // 5. Take snapshot
    await page.screenshot({ path: 'audit-screenshots/mobile-reimagined-kpis.png' });
  });

  test('All other listing pages render the 3-column high-density KPI band on mobile', async ({ page }) => {
    // /profesores
    await page.goto('/profesores');
    await page.waitForSelector('.grafton-mobile-kpi-band', { state: 'visible', timeout: 8000 });
    const profLabels = await page.locator('.grafton-mobile-kpi-band .grafton-kpi-label').allTextContents();
    expect(profLabels.map(l => l.trim())).toEqual(['DICTANDO AHORA', 'DOCENTES', 'CURSOS']);

    // /cursos
    await page.goto('/cursos');
    await page.waitForSelector('.grafton-mobile-kpi-band', { state: 'visible', timeout: 8000 });
    const cursoLabels = await page.locator('.grafton-mobile-kpi-band .grafton-kpi-label').allTextContents();
    expect(cursoLabels.map(l => l.trim())).toEqual(['EN VIVO', 'CURSOS', 'SECCIONES']);

    // /mentores
    await page.goto('/mentores');
    await page.waitForSelector('.grafton-mobile-kpi-band', { state: 'visible', timeout: 8000 });
    const mentorLabels = await page.locator('.grafton-mobile-kpi-band .grafton-kpi-label').allTextContents();
    expect(mentorLabels.map(l => l.trim())).toEqual(['SIN CRUCE', 'MENTORES', 'PRESENCIALES']);
  });
});

