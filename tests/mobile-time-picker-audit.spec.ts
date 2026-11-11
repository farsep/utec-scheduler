import { test, expect } from '@playwright/test';

const VIEWPORTS = [
  { name: 'iPhone-17', width: 393, height: 852 },
  { name: 'iPhone-14', width: 390, height: 844 },
  { name: 'iPhone-SE', width: 375, height: 667 },
  { name: 'Galaxy-S8', width: 360, height: 800 },
  { name: 'Small-Mobile', width: 320, height: 568 },
];

test.describe('Mobile Classroom Time Pickers Audit', () => {
  for (const vp of VIEWPORTS) {
    test(`Verify "De:" and "A:" popovers in ${vp.name} (${vp.width}x${vp.height})`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto('http://localhost:4325/aulas');

      // Click on "Buscar por Horario"
      const customTimeBtn = page.locator('.mode-toggle-btn').filter({ hasText: 'Buscar por Horario' });
      await expect(customTimeBtn).toBeVisible({ timeout: 10000 });
      await customTimeBtn.click();

      const timeContainer = page.locator('.time-inputs-container');
      await expect(timeContainer).toBeVisible();
      console.log(`[${vp.name}] timeContainer:`, await timeContainer.boundingBox());

      const deBtn = timeContainer.locator('.grafton-time-trigger-btn').first();
      const aBtn = timeContainer.locator('.grafton-time-trigger-btn').last();

      // 1. Test "De:" (Start Time)
      await deBtn.click();
      const dePopover = page.locator('.grafton-time-picker-popover');
      await expect(dePopover).toBeVisible();

      const deBox = (await dePopover.boundingBox())!;
      console.log(`[${vp.name}] De Popover:`, deBox);

      // Verify De popover is within screen bounds
      expect(deBox.x).toBeGreaterThanOrEqual(0);
      expect(deBox.x + deBox.width).toBeLessThanOrEqual(vp.width);

      // Close De popover
      await page.keyboard.press('Escape');
      await expect(dePopover).not.toBeVisible();

      // 2. Test "A:" (End Time)
      await aBtn.click();
      const aPopover = page.locator('.grafton-time-picker-popover');
      await expect(aPopover).toBeVisible();

      const aBox = (await aPopover.boundingBox())!;
      console.log(`[${vp.name}] A Popover:`, aBox);

      // Verify A popover is within screen bounds
      expect(aBox.x).toBeGreaterThanOrEqual(0);
      expect(aBox.x + aBox.width).toBeLessThanOrEqual(vp.width);
      expect(aBox.x).toBe(deBox.x); // Must be perfectly harmoniously aligned
    });
  }
});
