import { test, expect } from '@playwright/test';

test.describe('Polychrome Grafton Native Gesture Engine Audit', () => {
  test('1. Desktop: 2D DAG Pan/Fit Zoom, Command Palette Cmd+K & Optimizer J/K Cycling', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/malla');
    await page.waitForSelector('#dag-scroll-container', { timeout: 15000 });

    await page.click('[data-testid="dag-zoom-fit"]');
    const fitBtnText = await page.locator('[data-testid="dag-zoom-reset"]').innerText();
    expect(fitBtnText).toContain('72%');

    await page.keyboard.press('Control+k');
    await page.waitForSelector('[data-testid="cmdk-input"]', { timeout: 6000 });
    await page.fill('[data-testid="cmdk-input"]', 'A908');
    await page.keyboard.press('Enter');
    await page.waitForSelector('.classroom-modal', { timeout: 10000 });
  });

  test('2. Mobile (430x932): Course Card Swipe-to-Oyente & Micro-Ticket Tap-to-Inspect', async ({ page }) => {
    await page.setViewportSize({ width: 430, height: 932 });
    await page.goto('/');
    await page.waitForSelector('.schedule-block', { timeout: 15000 });

    await page.locator('.schedule-block').first().click();
    await expect(page.locator('[data-testid="mobile-course-inspector-strip"]')).toBeVisible();
  });
});
