import { test, expect } from '@playwright/test';

test.describe('Live Time Card Redesign & Desktop Hour Picker Alignment Audit', () => {
  // Test 1: Mobile (iPhone 17 393x852)
  test('1. Mobile (iPhone 17) - Symmetrical & Clean Live Time Card', async ({ page }) => {
    await page.setViewportSize({ width: 393, height: 852 });
    await page.goto('/aulas');
    await page.waitForLoadState('domcontentloaded');

    const card = page.locator('.live-time-controller');
    await expect(card).toBeVisible({ timeout: 10000 });

    // Verify title and status chip are present
    const title = card.locator('.live-time-title');
    await expect(title).toBeVisible();
    const chip = card.locator('.live-time-chip');
    await expect(chip).toBeVisible();

    // Verify desktop badge is NOT visible on mobile
    const desktopBadge = card.locator('.live-time-desktop-badge');
    await expect(desktopBadge).not.toBeVisible();

    // Symmetrical Stepper: -15m, Time Trigger, +15m
    const prevBtn = card.locator('.grafton-step-btn--prev');
    const nextBtn = card.locator('.grafton-step-btn--next');
    const timeBtn = card.locator('.live-time-stepper-btn');

    await expect(prevBtn).toBeVisible();
    await expect(nextBtn).toBeVisible();
    await expect(timeBtn).toBeVisible();

    const prevBox = (await prevBtn.boundingBox())!;
    const nextBox = (await nextBtn.boundingBox())!;
    const timeBox = (await timeBtn.boundingBox())!;

    console.log('[iPhone 17] Prev Button:', prevBox);
    console.log('[iPhone 17] Time Button:', timeBox);
    console.log('[iPhone 17] Next Button:', nextBox);

    // Assert symmetry: prevBtn and nextBtn have exact equal width
    expect(prevBox.width).toBe(nextBox.width);
    // Assert timeBtn is centered between them
    const leftGap = timeBox.x - (prevBox.x + prevBox.width);
    const rightGap = nextBox.x - (timeBox.x + timeBox.width);
    expect(Math.abs(leftGap - rightGap)).toBeLessThanOrEqual(2);

    await page.screenshot({ path: 'audit-screenshots/redesign-live-time-mobile.png' });

    // Click timeBtn to verify popover opens centered and within screen
    await timeBtn.click();
    const popover = page.locator('.grafton-time-picker-popover').first();
    await expect(popover).toBeVisible({ timeout: 5000 });

    const popoverBox = (await popover.boundingBox())!;
    console.log('[iPhone 17] Popover Box:', popoverBox);
    expect(popoverBox.x).toBeGreaterThanOrEqual(0);
    expect(popoverBox.x + popoverBox.width).toBeLessThanOrEqual(393);

    await page.screenshot({ path: 'audit-screenshots/redesign-live-time-mobile-popover.png' });
  });

  // Test 2: Tablet (iPad 768x1024)
  test('2. Tablet (iPad 768x1024) - Harmonious & Grouped Stepper', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/aulas');
    await page.waitForLoadState('domcontentloaded');

    const card = page.locator('.live-time-controller');
    await expect(card).toBeVisible({ timeout: 10000 });

    const prevBtn = card.locator('.grafton-step-btn--prev');
    const nextBtn = card.locator('.grafton-step-btn--next');
    const timeBtn = card.locator('.live-time-stepper-btn');

    await expect(prevBtn).toBeVisible();
    await expect(nextBtn).toBeVisible();
    await expect(timeBtn).toBeVisible();

    const prevBox = (await prevBtn.boundingBox())!;
    const nextBox = (await nextBtn.boundingBox())!;
    const timeBox = (await timeBtn.boundingBox())!;

    console.log('[iPad] Prev Button:', prevBox);
    console.log('[iPad] Time Button:', timeBox);
    console.log('[iPad] Next Button:', nextBox);

    // Verify distance between timeBtn and nextBtn is small and tight (NOT stranded at 700px)
    const gap = nextBox.x - (timeBox.x + timeBox.width);
    expect(gap).toBeLessThanOrEqual(20);

    await page.screenshot({ path: 'audit-screenshots/redesign-live-time-tablet.png' });
  });

  // Test 3: Desktop (1280x800) - Hour Picker Alignment in "Buscar por Horario" (Foto 3)
  test('3. Desktop (1280x800) - Hour Picker Aligned to Left of Button as in Foto 3', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/aulas');
    await page.waitForLoadState('domcontentloaded');

    // Switch to "Buscar por Horario"
    const customTimeBtn = page.locator('.mode-toggle-btn').filter({ hasText: 'Buscar por Horario' });
    await expect(customTimeBtn).toBeVisible({ timeout: 10000 });
    await customTimeBtn.click();

    const timeContainer = page.locator('.time-inputs-container');
    await expect(timeContainer).toBeVisible();

    // Click "A:" button
    const aBtn = timeContainer.locator('.grafton-time-trigger-btn').last();
    await aBtn.click();

    const popover = page.locator('.grafton-time-picker-popover').first();
    await expect(popover).toBeVisible({ timeout: 5000 });

    const aBtnBox = (await aBtn.boundingBox())!;
    const popoverBox = (await popover.boundingBox())!;

    console.log('[Desktop] A: Button Box:', aBtnBox);
    console.log('[Desktop] Popover Box:', popoverBox);

    // Assert popover is aligned to the LEFT of the A: button (Foto 3 behavior)
    // popover.x should equal aBtn.x (within 2px)
    expect(Math.abs(popoverBox.x - aBtnBox.x)).toBeLessThanOrEqual(2);

    await page.screenshot({ path: 'audit-screenshots/redesign-desktop-a-picker-aligned-left.png' });
  });
});
