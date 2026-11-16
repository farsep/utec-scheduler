import { test, expect } from '@playwright/test';

test.describe('CC Department, No (0 reservas), & Section/Subsection Hierarchy Audit', () => {
  test('1. /aulas hides (0 reservas) while showing Intranet UTEC en Vivo', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/aulas', { waitUntil: 'networkidle' });

    const hero = page.locator('.classroom-hero-banner');
    await expect(hero).toBeVisible();
    await expect(hero).not.toContainText(/\d+\s*reservas/i);
    await expect(hero).toContainText('Intranet UTEC en Vivo');
    await hero.screenshot({ path: 'audit-screenshots/aulas-hero-no-reservas.png' });
  });

  test('2. /cursos CC1103 shows Ciencias department and differentiates 7 Lab Subsections inside Sec. 1', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/cursos', { waitUntil: 'networkidle' });

    const searchInput = page.locator('.course-filter-bar input.prof-search-input').first();
    await searchInput.waitFor({ state: 'visible', timeout: 15000 });
    await searchInput.fill('CC1103');

    const ccCard = page.locator('.course-finder-root .course-card', { hasText: 'CC1103' }).first();
    await ccCard.waitFor({ state: 'visible', timeout: 10000 });
    await expect(ccCard.locator('.course-card-dept-tag')).toHaveText('Ciencias');
    await expect(ccCard).not.toContainText('Computación y Sistemas');
    await expect(ccCard).toContainText('SUBSECS (S1)');

    await ccCard.locator('.course-view-detail-btn').click();
    await page.waitForSelector('.course-modal-dialog', { state: 'visible', timeout: 10000 });
    await expect(page.locator('.course-modal-dept-badge')).toHaveText('Ciencias');

    await page.locator('.course-modal-tab-btn', { hasText: 'Malla Horaria' }).click();
    await page.waitForSelector('.course-session-card', { state: 'visible', timeout: 10000 });

    const strip = page.locator('.course-sec-pills-strip--sub');
    await expect(strip).toBeVisible();
    await expect(strip).toContainText('SEC. 1 · SUBSECCIONES:');
    await expect(strip.locator('.course-subsec-filter-pill', { hasText: 'Lab 11' })).toBeVisible();
    await expect(strip.locator('.course-subsec-filter-pill', { hasText: 'Lab 17' })).toBeVisible();
    // Ensure old identical "S1" pills are gone
    expect(await strip.locator('.course-sec-filter-pill', { hasText: /^S1$/ }).count()).toBe(0);

    await page.screenshot({ path: 'audit-screenshots/cc1103-malla-subsections.png' });

    // Click Lab 13 to isolate TEORÍA 1 + LABORATORIO 13
    await strip.locator('.course-subsec-filter-pill', { hasText: 'Lab 13' }).click();
    await expect(page.locator('.course-session-card')).toHaveCount(2);
    await expect(page.locator('.course-session-card', { hasText: 'S01·L13' })).toHaveCount(2);
  });

  test('3. /cursos CC1143 shows 2-level Section -> Subsection hierarchy across Sections 1 and 2', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/cursos', { waitUntil: 'networkidle' });

    const searchInput = page.locator('.course-filter-bar input.prof-search-input').first();
    await searchInput.waitFor({ state: 'visible', timeout: 15000 });
    await searchInput.fill('CC1143');

    const ccCard = page.locator('.course-finder-root .course-card', { hasText: 'CC1143' }).first();
    await ccCard.waitFor({ state: 'visible', timeout: 10000 });
    await expect(ccCard.locator('.course-card-dept-tag')).toHaveText('Ciencias');
    await expect(ccCard).toContainText('SUBSECS (2S)');

    await ccCard.locator('.course-view-detail-btn').click();
    await page.waitForSelector('.course-modal-dialog', { state: 'visible', timeout: 10000 });
    await expect(page.locator('.course-section-card .section-sub-pill').first()).toContainText('Subsec.');
    await page.screenshot({ path: 'audit-screenshots/cc1143-secciones-hierarchy.png' });

    await page.locator('.course-modal-tab-btn', { hasText: 'Malla Horaria' }).click();
    await page.waitForSelector('.course-session-card', { state: 'visible', timeout: 10000 });

    const hierarchyWrap = page.locator('.course-sec-hierarchy-wrap');
    await expect(hierarchyWrap).toBeVisible();
    await expect(hierarchyWrap).toContainText('Sec. 1');
    await expect(hierarchyWrap).toContainText('4 sub');
    await expect(hierarchyWrap).toContainText('Sec. 2');
    await expect(hierarchyWrap).toContainText('Teo 11');
    await expect(hierarchyWrap).toContainText('Teo 24');
    await page.screenshot({ path: 'audit-screenshots/cc1143-malla-hierarchy.png' });

    // Select Main Section 1 only
    await hierarchyWrap.locator('.course-sec-filter-pill', { hasText: 'Sec. 1' }).click();
    await expect(page.locator('.course-subsec-pills-strip')).toContainText('SUBSECCIONES SEC. 1:');
    await expect(page.locator('.course-subsec-pills-strip')).toContainText('Todas S1 (4)');
    await expect(page.locator('.course-subsec-pills-strip')).not.toContainText('Teo 21');
  });

  test('4. /profesores shows Ciencias instead of Computación y Sistemas for CC courses', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/profesores', { waitUntil: 'networkidle' });

    await expect(page.locator('.professor-finder-root')).not.toContainText('Computación y Sistemas');
    const searchInput = page.locator('.prof-search-input').first();
    await searchInput.fill('Anco Blas');
    const profCard = page.locator('.professor-card', { hasText: 'Edith' }).first();
    await profCard.waitFor({ state: 'visible', timeout: 10000 });
    await expect(profCard).toContainText('Ciencias');
  });
});
