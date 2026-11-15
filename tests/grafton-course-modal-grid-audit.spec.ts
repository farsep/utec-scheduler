import { test, expect } from '@playwright/test';

test.describe('Grafton Course Modal Timetable & Session Inspector Audit (HH2101)', () => {
  test('HH2101 desktop (1440x900): sticky day headers, crisp multi-col blocks, dark SEC 02 inspector, zero overflow', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/cursos', { waitUntil: 'networkidle' });

    const searchInput = page.locator('.course-filter-bar input.prof-search-input').first();
    await searchInput.waitFor({ state: 'visible', timeout: 15000 });
    await searchInput.fill('HH2101');

    const hhCard = page.locator('.course-finder-root .course-card', { hasText: 'HH2101' }).first();
    await hhCard.waitFor({ state: 'visible', timeout: 10000 });
    await hhCard.locator('.course-view-detail-btn').click();

    await page.waitForSelector('.course-modal-dialog', { state: 'visible', timeout: 10000 });
    await page.locator('.course-modal-tab-btn', { hasText: 'Malla Horaria' }).click();

    await page.waitForSelector('.course-timetable-container .prof-timetable-days-header-row', { state: 'visible', timeout: 10000 });
    await page.waitForSelector('.course-session-card', { state: 'visible', timeout: 10000 });

    // Capture full 10-section grid initial view before selecting a session
    await page.screenshot({ path: 'audit-screenshots/hh2101-malla-semanal-initial.png' });

    // Assert section filter strip contains TODAS (10) and S2
    const filterStrip = page.locator('.course-sec-pills-strip');
    await expect(filterStrip).toBeVisible();
    await expect(filterStrip.locator('.course-sec-filter-pill', { hasText: 'TODAS' })).toBeVisible();
    const s2Pill = filterStrip.locator('.course-sec-filter-pill', { hasText: /^S2$/ });
    await expect(s2Pill).toBeVisible();

    // Click Sec. 2 (Lun 18:00 - 19:00, A701)
    const sec2LunBlock = page.locator('.course-session-card', { hasText: 'S02 · TEO 2' }).first();
    await sec2LunBlock.click();

    const inspector = page.locator('.course-swiss-inspector');
    await expect(inspector).toBeVisible({ timeout: 5000 });
    // Let scrollIntoView smooth scroll settle
    await page.waitForTimeout(400);

    // 1. Assert Day Header Row is sticky AND remains visible inside modal scroll viewport
    const stickyMetrics = await page.evaluate(() => {
      const body = document.querySelector('.course-modal-body--timetable') as HTMLElement | null;
      const header = document.querySelector('.course-timetable-container .prof-timetable-days-header-row') as HTMLElement | null;
      if (!body || !header) return null;
      const bRect = body.getBoundingClientRect();
      const hRect = header.getBoundingClientRect();
      const style = window.getComputedStyle(header);
      return {
        position: style.position,
        height: hRect.height,
        topDiffFromBody: hRect.top - bRect.top,
        bottomWithinBody: hRect.bottom <= bRect.bottom,
        headerText: header.innerText.trim(),
      };
    });
    expect(stickyMetrics).not.toBeNull();
    expect(stickyMetrics!.position).toBe('sticky');
    expect(stickyMetrics!.height).toBeGreaterThan(28);
    expect(stickyMetrics!.topDiffFromBody).toBeGreaterThanOrEqual(-2);
    expect(stickyMetrics!.bottomWithinBody).toBeTruthy();

    // 2. Assert selected inspector SEC 02 badge is NOT mint green and uses dark 0px Swiss styling
    const secBadge = inspector.locator('.inspector-sec-badge');
    await expect(secBadge).toBeVisible();
    await expect(secBadge).toHaveText('SEC 02');
    const secBadgeStyles = await secBadge.evaluate(el => {
      const cs = window.getComputedStyle(el);
      return {
        bg: cs.backgroundColor,
        color: cs.color,
        radius: cs.borderRadius,
        borderLeftWidth: cs.borderLeftWidth,
        borderLeftColor: cs.borderLeftColor,
      };
    });
    expect(secBadgeStyles.bg).toBe('rgb(24, 24, 26)');
    expect(secBadgeStyles.color).toBe('rgb(242, 240, 236)');
    expect(secBadgeStyles.radius).toBe('0px');
    expect(secBadgeStyles.borderLeftColor).not.toBe('rgb(24, 24, 26)');
    expect(secBadgeStyles.bg).not.toContain('16, 185, 129');
    expect(secBadgeStyles.bg).not.toContain('110, 231, 183');

    // Type compartment should NOT repeat "(Teoría)"
    const typeBadgeText = (await inspector.locator('.course-inspector-type-badge').innerText()).trim();
    expect(typeBadgeText).toBe('TEORÍA 2');
    expect(typeBadgeText).not.toContain('(');

    // Room & Prof links use high-contrast dark charcoal ink (NO pastel green or purple)
    const linkColors = await inspector.evaluate(() => {
      const room = document.querySelector('.course-inspector-room-link');
      const prof = document.querySelector('.course-inspector-prof-link');
      return {
        roomColor: room ? window.getComputedStyle(room).color : null,
        profColor: prof ? window.getComputedStyle(prof).color : null,
      };
    });
    expect(linkColors.roomColor).toBe('rgb(20, 20, 22)');
    expect(linkColors.profColor).toBe('rgb(20, 20, 22)');

    // 3. Assert no block text overflows vertically inside its bounding box & section code never truncates
    const blockChecks = await page.evaluate(() => {
      const blocks = Array.from(document.querySelectorAll('.course-session-card')) as HTMLElement[];
      const verticalOverflows = blocks
        .filter(el => el.scrollHeight > el.clientHeight + 2)
        .map(el => ({ text: el.innerText, scrollH: el.scrollHeight, clientH: el.clientHeight }));
      const clippedSecCodes = Array.from(document.querySelectorAll('.course-session-card .course-card-block-sec'))
        .filter(el => el.scrollWidth > el.clientWidth + 2)
        .map(el => ({ text: (el as HTMLElement).innerText, scrollW: el.scrollWidth, clientW: el.clientWidth }));
      const truncatedTimeTexts = blocks
        .map(el => el.innerText)
        .filter(t => /13:00\s*-\s*1\b|-\s*1\.\.\./.test(t));
      return { total: blocks.length, verticalOverflows, clippedSecCodes, truncatedTimeTexts };
    });
    expect(blockChecks.total).toBeGreaterThan(5);
    expect(blockChecks.verticalOverflows).toEqual([]);
    expect(blockChecks.clippedSecCodes).toEqual([]);
    expect(blockChecks.truncatedTimeTexts).toEqual([]);

    // Save main audit screenshot
    await page.screenshot({ path: 'audit-screenshots/hh2101-malla-semanal-fixed.png' });

    // 4. Test section filter ribbon isolation ([ S2 ])
    await s2Pill.click();
    await page.waitForTimeout(250);
    const pillActiveBg = await s2Pill.evaluate(el => window.getComputedStyle(el).backgroundColor);
    expect(pillActiveBg).toBe('rgb(24, 24, 26)');
    const visibleBlockCountAfterS2 = await page.locator('.course-session-card').count();
    expect(visibleBlockCountAfterS2).toBe(2); // Lun + Sab for Sec. 2
    await page.screenshot({ path: 'audit-screenshots/hh2101-sec2-isolated.png' });
  });

  test('HH2101 mobile (393x852): 1-col inspector metadata strip and zero block vertical overflow', async ({ page }) => {
    await page.setViewportSize({ width: 393, height: 852 });
    await page.goto('/cursos', { waitUntil: 'networkidle' });

    const searchInput = page.locator('.course-filter-bar input.prof-search-input').first();
    await searchInput.waitFor({ state: 'visible', timeout: 15000 });
    await searchInput.fill('HH2101');

    const hhCard = page.locator('.course-finder-root .course-card', { hasText: 'HH2101' }).first();
    await hhCard.waitFor({ state: 'visible', timeout: 10000 });
    await hhCard.locator('.course-view-detail-btn').click();

    await page.waitForSelector('.course-modal-dialog', { state: 'visible', timeout: 10000 });
    await page.locator('.course-modal-tab-btn', { hasText: 'Malla Horaria' }).click();
    await page.waitForSelector('.course-session-card', { state: 'visible', timeout: 10000 });

    await page.locator('.course-session-card', { hasText: 'S02' }).first().click();
    const inspector = page.locator('.course-swiss-inspector');
    await expect(inspector).toBeVisible({ timeout: 5000 });
    await page.waitForTimeout(350);

    const mobileChecks = await page.evaluate(() => {
      const blocks = Array.from(document.querySelectorAll('.course-session-card')) as HTMLElement[];
      const verticalOverflows = blocks.filter(el => el.scrollHeight > el.clientHeight + 2).length;
      const clippedLabels = Array.from(
        document.querySelectorAll('.course-session-card .course-card-block-sec, .course-session-card .course-card-mobile-sub')
      ).filter(el => el.scrollWidth > el.clientWidth).length;
      const visibleNowPills = Array.from(document.querySelectorAll('.course-timetable-container .prof-now-line-pill'))
        .filter(el => window.getComputedStyle(el).display !== 'none').length;
      const gridContainer = document.querySelector('.course-timetable-container') as HTMLElement | null;
      const gridOverflowX = gridContainer ? gridContainer.scrollWidth > gridContainer.clientWidth + 2 : false;
      const strip = document.querySelector('.course-inspector-meta-strip') as HTMLElement | null;
      const cols = strip ? window.getComputedStyle(strip).gridTemplateColumns.split(/\s+/).length : 0;
      const horizOverflow = document.documentElement.scrollWidth > document.documentElement.clientWidth + 1;
      return { verticalOverflows, clippedLabels, visibleNowPills, gridOverflowX, cols, horizOverflow };
    });
    expect(mobileChecks.verticalOverflows).toBe(0);
    expect(mobileChecks.clippedLabels).toBe(0);
    expect(mobileChecks.visibleNowPills).toBe(0);
    expect(mobileChecks.gridOverflowX).toBe(false);
    expect(mobileChecks.cols).toBe(1);
    expect(mobileChecks.horizOverflow).toBe(false);

    await page.screenshot({ path: 'audit-screenshots/hh2101-malla-mobile-393.png' });
  });
});
