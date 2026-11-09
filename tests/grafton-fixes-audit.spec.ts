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
});

