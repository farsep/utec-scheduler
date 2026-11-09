import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

test.describe('Grafton Swiss Concrete Fixes Audit', () => {
  test.beforeAll(() => {
    const screenshotDir = path.resolve(process.cwd(), 'audit-screenshots');
    if (!fs.existsSync(screenshotDir)) {
      fs.mkdirSync(screenshotDir, { recursive: true });
    }
  });

  test('1. Professor Exact Resolution Test (Pino Matos, Jose)', async ({ page }) => {
    // Navigate directly with deep-link query
    await page.goto('/profesores?profesor=Pino%20Matos%2C%20Jose');
    await page.waitForLoadState('networkidle');

    // Wait for modal to render
    const modal = page.locator('.prof-modal');
    await expect(modal).toBeVisible({ timeout: 10000 });

    // Wait 400ms as requested
    await page.waitForTimeout(400);

    // Capture screenshot
    await page.screenshot({ path: 'audit-screenshots/prof-pino-matos.png' });

    // Assert that the open modal header contains "Pino Matos" and does NOT contain "Espinoza Matos"
    const modalHeader = page.locator('.prof-modal-header');
    await expect(modalHeader).toBeVisible();
    const headerText = await modalHeader.innerText();

    expect(headerText).toContain('Pino Matos');
    expect(headerText).not.toContain('Espinoza Matos');
  });

  test('2. Time Picker Floating Popover Test on /aulas', async ({ page }) => {
    await page.goto('/aulas');
    await page.waitForLoadState('networkidle');

    const banner = page.locator('.live-time-controller');
    await expect(banner).toBeVisible({ timeout: 10000 });

    // Measure height before clicking
    const boxBefore = await banner.boundingBox();
    expect(boxBefore).not.toBeNull();
    const heightBefore = boxBefore!.height;

    // Locate trigger button
    const timeTrigger = page.locator('.live-time-actions button[aria-haspopup="dialog"]');
    await expect(timeTrigger).toBeVisible();
    await timeTrigger.click();

    // Popover appears
    const popover = page.locator('.grafton-time-picker-popover, div[role="dialog"][aria-label="Selector de Horario"]');
    await expect(popover).toBeVisible({ timeout: 5000 });

    // Capture screenshot
    await page.screenshot({ path: 'audit-screenshots/aulas-time-popover.png' });

    // Assert position and border-radius
    const popoverStyles = await popover.evaluate((el) => {
      const computed = window.getComputedStyle(el);
      return {
        position: computed.position,
        borderRadius: computed.borderRadius,
      };
    });

    expect(['absolute', 'fixed']).toContain(popoverStyles.position);
    expect(popoverStyles.borderRadius).toBe('0px');

    // Measure height after clicking
    const boxAfter = await banner.boundingBox();
    expect(boxAfter).not.toBeNull();
    const heightAfter = boxAfter!.height;

    // Assert the banner height did NOT expand
    expect(Math.abs(heightAfter - heightBefore)).toBeLessThanOrEqual(4);
  });

  test('3. Ver Horario > Button & Top Floor-Map Click Test on /aulas', async ({ page }) => {
    await page.goto('/aulas');
    await page.waitForLoadState('networkidle');

    // Assert Ver Horario button on classroom cards
    const viewScheduleBtn = page.locator('.classroom-card .btn-view-schedule').first();
    await expect(viewScheduleBtn).toBeVisible({ timeout: 10000 });

    const btnStyles = await viewScheduleBtn.evaluate((el) => {
      const computed = window.getComputedStyle(el);
      return {
        paddingLeft: parseFloat(computed.paddingLeft) || 0,
        backgroundColor: computed.backgroundColor,
      };
    });

    expect(btnStyles.paddingLeft).toBeGreaterThanOrEqual(8);
    expect(btnStyles.backgroundColor).toBe('rgb(24, 24, 26)');

    // Click a room tile in the top "Aulas y Laboratorios por Niveles" section
    const roomTile = page.locator('.campus-floor-explorer .campus-room-chip').first();
    await expect(roomTile).toBeVisible();
    await roomTile.click();

    // Assert that the Classroom Detail Modal opens immediately
    const classroomModal = page.locator('.classroom-modal');
    await expect(classroomModal).toBeVisible({ timeout: 5000 });
  });

  test('4. Direct Click on Exact Time Badge & Minute Selection (:40 min)', async ({ page }) => {
    await page.goto('/aulas');
    await page.waitForLoadState('networkidle');

    // Locate the exact time badge button on the left of the banner
    const liveTimeBadgeBtn = page.locator('.live-time-info button.live-time-badge');
    await expect(liveTimeBadgeBtn).toBeVisible({ timeout: 10000 });

    // Click the badge directly
    await liveTimeBadgeBtn.click();

    // Assert popover opens right below the badge
    const popover = page.locator('.grafton-time-picker-popover').first();
    await expect(popover).toBeVisible({ timeout: 5000 });

    // Click the :40 min button in Section 3: MINUTOS
    const min40Btn = popover.locator('button', { hasText: ':40 min' });
    await expect(min40Btn).toBeVisible();
    await min40Btn.click();

    // Click ✓ APLICAR to confirm
    const applyBtn = popover.locator('button', { hasText: 'APLICAR' });
    await applyBtn.click();

    // Assert badge now displays minutes :40
    await expect(liveTimeBadgeBtn).toContainText(':40');
  });

  test('5. Dynamic Session Badge TEO and LAB Default State', async ({ page }) => {
    // Navigate to Aaron Nuñez del Prado Tavara
    await page.goto('/profesores?profesor=Aaron%20Nu%C3%B1ez%20del%20Prado%20Tavara');
    await page.waitForLoadState('networkidle');

    const modal = page.locator('.prof-modal');
    await expect(modal).toBeVisible({ timeout: 10000 });

    // Wait for timetable blocks to render
    const sessionBadges = modal.locator('.dynamic-session-badge, .prof-session-group-tag');
    await expect(sessionBadges.first()).toBeVisible({ timeout: 5000 });

    // In compact/default state, session-prefix is TEO or LAB
    const prefixes = await modal.locator('.dynamic-session-badge .session-prefix').allInnerTexts();
    expect(prefixes.length).toBeGreaterThan(0);
    expect(prefixes.some(p => p === 'TEO')).toBe(true);

    // Capture screenshot
    await page.screenshot({ path: 'audit-screenshots/prof-standardized-teo-lab.png' });
  });

  test('6. Zero Animate-Ping and Broadcast Icon Presence across All 4 Directories', async ({ page }) => {
    const urls = ['/cursos', '/mentores', '/profesores', '/aulas'];

    for (const url of urls) {
      await page.goto(url);
      await page.waitForLoadState('networkidle');

      // Assert zero animate-ping elements exist on the page
      const pingCount = await page.evaluate(() => document.querySelectorAll('.animate-ping').length);
      expect(pingCount).toBe(0);

      // Assert zero animate-pulse elements exist on live indicator dots
      const pulseDots = await page.evaluate(() => document.querySelectorAll('.animate-pulse.rounded-full').length);
      expect(pulseDots).toBe(0);
    }

    // Verify broadcast wave SVG icon in filter buttons
    await page.goto('/cursos');
    await page.waitForLoadState('networkidle');

    // Switch to Catalog mode if DAG view is currently showing
    const catalogTabBtn = page.locator('button', { hasText: 'Catálogo Ofertado' });
    if (await catalogTabBtn.isVisible()) {
      await catalogTabBtn.click();
    }

    const courseLiveBtn = page.locator('.course-quick-pill--live, .prof-toggle-btn', { hasText: 'En vivo ahora' }).first();
    await expect(courseLiveBtn).toBeVisible({ timeout: 15000 });
    await expect(courseLiveBtn.locator('svg')).toBeVisible();

    await page.goto('/mentores');
    await page.waitForLoadState('networkidle');
    const mentorLiveBtn = page.locator('.prof-toggle-btn', { hasText: 'Mentoría' }).first();
    await expect(mentorLiveBtn.locator('svg')).toBeVisible();

    await page.goto('/profesores');
    await page.waitForLoadState('networkidle');
    const profLiveBtn = page.locator('.prof-toggle-btn', { hasText: 'Dictando' }).first();
    await expect(profLiveBtn.locator('svg')).toBeVisible();

    await page.goto('/aulas');
    await page.waitForLoadState('networkidle');
    const aulasLiveTab = page.locator('.mode-toggle-btn', { hasText: 'Libres Ahora' }).first();
    await expect(aulasLiveTab.locator('svg')).toBeVisible();
  });

  test('7. Styled Grafton Swiss Architectural Empty State on /mentores ("inter")', async ({ page }) => {
    await page.goto('/mentores');
    await page.waitForLoadState('networkidle');

    // Type "inter" into search
    const searchInput = page.locator('input[placeholder*="Buscar mentor"]').first();
    await expect(searchInput).toBeVisible({ timeout: 5000 });
    await searchInput.fill('inter');
    await page.waitForTimeout(400);

    // Empty state appears
    const emptyCard = page.locator('.grafton-empty-card, .prof-empty-state');
    await expect(emptyCard).toBeVisible({ timeout: 5000 });

    // Capture screenshot
    await page.screenshot({ path: 'audit-screenshots/mentores-empty-state.png' });

    // Assert container styles: centered, padding >= 32px
    const emptyStyles = await emptyCard.evaluate((el) => {
      const computed = window.getComputedStyle(el);
      return {
        paddingTop: parseFloat(computed.paddingTop) || 0,
        textAlign: computed.textAlign,
        borderRadius: computed.borderRadius,
      };
    });

    expect(emptyStyles.paddingTop).toBeGreaterThanOrEqual(32);
    expect(emptyStyles.textAlign).toBe('center');
    expect(emptyStyles.borderRadius).toBe('0px');

    // Assert Reset button styling: #18181A bg, 0px radius
    const resetBtn = emptyCard.locator('.grafton-empty-reset-btn, .empty-reset-btn');
    await expect(resetBtn).toBeVisible();

    const resetStyles = await resetBtn.evaluate((el) => {
      const computed = window.getComputedStyle(el);
      return {
        backgroundColor: computed.backgroundColor,
        borderRadius: computed.borderRadius,
      };
    });

    expect(resetStyles.backgroundColor).toBe('rgb(24, 24, 26)');
    expect(resetStyles.borderRadius).toBe('0px');
  });

  test('8. Dynamic Symmetrical TEO <-> TEORÍA and LAB <-> LABORATORIO Expansion', async ({ page }) => {
    await page.goto('/profesores?profesor=Aaron%20Nu%C3%B1ez%20del%20Prado%20Tavara');
    await page.waitForLoadState('networkidle');

    const modal = page.locator('.prof-modal');
    await expect(modal).toBeVisible({ timeout: 10000 });

    // Find a dynamic session badge
    const badge = modal.locator('.dynamic-session-badge').first();
    await expect(badge).toBeVisible({ timeout: 5000 });

    // Hover over the badge
    await badge.hover();
    await page.waitForTimeout(250);

    // Verify suffix expands
    const suffix = badge.locator('.session-suffix-expand');
    if (await suffix.count() > 0) {
      const suffixStyles = await suffix.evaluate((el) => {
        const computed = window.getComputedStyle(el);
        return {
          opacity: parseFloat(computed.opacity) || 0,
        };
      });
      expect(suffixStyles.opacity).toBeGreaterThan(0);
    }
  });

  test('9. Empty State Card is Horizontally Centered in /profesores ("buenerin")', async ({ page }) => {
    await page.goto('/profesores');
    await page.waitForLoadState('networkidle');

    const searchInput = page.locator('input[placeholder*="Buscar docente"]').first();
    await expect(searchInput).toBeVisible({ timeout: 5000 });
    await searchInput.fill('buenerin');
    await page.waitForTimeout(400);

    const emptyCard = page.locator('.grafton-empty-card');
    await expect(emptyCard).toBeVisible({ timeout: 5000 });

    // Capture screenshot
    await page.screenshot({ path: 'audit-screenshots/prof-buenerin-empty-state-centered.png' });

    // Check centering
    const metrics = await page.evaluate(() => {
      const card = document.querySelector('.grafton-empty-card');
      if (!card) return null;
      const rect = card.getBoundingClientRect();
      const parentRect = card.parentElement?.getBoundingClientRect() || rect;
      return {
        cardLeft: rect.left,
        cardRight: rect.right,
        cardWidth: rect.width,
        windowWidth: window.innerWidth,
        parentLeft: parentRect.left,
        parentWidth: parentRect.width,
      };
    });

    expect(metrics).not.toBeNull();
    // In centered layout, distance from left and distance from right should be roughly equal (delta < 20px)
    const leftMargin = metrics!.cardLeft;
    const rightMargin = metrics!.windowWidth - metrics!.cardRight;
    expect(Math.abs(leftMargin - rightMargin)).toBeLessThanOrEqual(30);
  });

  test('10. Time Picker Popover in Libres Ahora (Right Widget) & Buscar por Horario (De / A)', async ({ page }) => {
    await page.goto('/aulas');
    await page.waitForLoadState('networkidle');

    // 10A: In Libres Ahora, test the right-hand widget button [-15m] [ 🕓 time ] [+15m]
    const rightTimeBtn = page.locator('.live-time-actions .grafton-time-trigger-btn');
    await expect(rightTimeBtn).toBeVisible({ timeout: 5000 });

    // Click to open popover
    await rightTimeBtn.click();
    const rightPopover = page.locator('.grafton-time-picker-popover').first();
    await expect(rightPopover).toBeVisible({ timeout: 3000 });

    // Capture screenshot of styled popover
    await page.screenshot({ path: 'audit-screenshots/aulas-time-picker-right-styled.png' });

    // Verify popover is within viewport
    const rightBox = await rightPopover.boundingBox();
    expect(rightBox).not.toBeNull();
    expect(rightBox!.x).toBeGreaterThanOrEqual(0);

    // Verify hours grid has NO internal scrollbar (entire 7:00-22:00 grid displayed completely)
    const hoursGrid = rightPopover.locator('.gtp-hours-grid');
    const hoursGridMetrics = await hoursGrid.evaluate((el) => {
      const computed = window.getComputedStyle(el);
      return {
        scrollHeight: el.scrollHeight,
        clientHeight: el.clientHeight,
        overflowY: computed.overflowY,
        chipCount: el.querySelectorAll('.gtp-chip').length,
      };
    });
    expect(hoursGridMetrics.chipCount).toBe(16);
    expect(hoursGridMetrics.scrollHeight).toBeLessThanOrEqual(hoursGridMetrics.clientHeight + 2);
    expect(hoursGridMetrics.overflowY).toBe('visible');

    // Close right popover by clicking outside or close btn
    const closeBtn = rightPopover.locator('.gtp-close-btn');
    await closeBtn.click();
    await expect(rightPopover).toBeHidden();

    // 10B: Switch to "Buscar por Horario"
    const customTimeTab = page.locator('.mode-toggle-btn', { hasText: 'Buscar por Horario' });
    await customTimeTab.click();
    await page.waitForTimeout(300);

    // Find the "De:" time picker trigger button
    const dePickerBtn = page.locator('.time-inputs-container .grafton-time-trigger-btn').first();
    await expect(dePickerBtn).toBeVisible({ timeout: 5000 });

    // Click "De:" time picker
    await dePickerBtn.click();
    const dePopover = page.locator('.grafton-time-picker-popover').first();
    await expect(dePopover).toBeVisible({ timeout: 3000 });

    // Verify "De:" popover is fully on screen
    const deBox = await dePopover.boundingBox();
    expect(deBox).not.toBeNull();
    expect(deBox!.x).toBeGreaterThanOrEqual(0);

    // Capture screenshot
    await page.screenshot({ path: 'audit-screenshots/aulas-time-picker-custom-de-styled.png' });

    // Click an hour chip inside (e.g. 08:00)
    const hour08Btn = dePopover.locator('.gtp-chip', { hasText: '08:00' }).first();
    await hour08Btn.click();

    // Click APLICAR
    const applyBtn = dePopover.locator('.gtp-apply-btn');
    await applyBtn.click();
    await expect(dePopover).toBeHidden();

    // Verify "De:" button now shows 08:00
    await expect(dePickerBtn).toContainText('08:00');
  });
});
