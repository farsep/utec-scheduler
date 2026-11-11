import { test, expect } from '@playwright/test';

const ROUTES = [
  { path: '/', expectedIndex: 0, label: 'HORARIOS' },
  { path: '/cursos', expectedIndex: 1, label: 'CURSOS' },
  { path: '/aulas', expectedIndex: 2, label: 'AULAS' },
  { path: '/profesores', expectedIndex: 3, label: 'DOCENTES' },
  { path: '/mentores', expectedIndex: 4, label: 'MENTORES' },
];

test.describe('Grafton Mobile Dock & Swipe System', () => {
  test.use({ viewport: { width: 393, height: 852 } });

  for (const { path, expectedIndex, label } of ROUTES) {
    test(`Mobile Dock on ${path} should have slider at index ${expectedIndex} (${label})`, async ({ page }) => {
      await page.goto(path);
      await page.waitForSelector('.grafton-mobile-dock', { state: 'visible', timeout: 8000 });

      const dock = page.locator('.grafton-mobile-dock');
      await expect(dock).toBeVisible();

      // Check 5 canonical tabs
      const items = dock.locator('.grafton-dock-item');
      await expect(items).toHaveCount(5);

      // Verify active tab index
      const activeItem = items.nth(expectedIndex);
      await expect(activeItem).toHaveClass(/is-active/);

      // Check dock position is fixed at bottom
      const dockBox = await dock.boundingBox();
      expect(dockBox).not.toBeNull();
      expect(Math.round(dockBox!.y + dockBox!.height)).toBe(852);

      // Verify top navigation links are hidden on mobile
      const topSwitcher = page.locator('.grafton-topbar__switcher');
      await expect(topSwitcher).toBeHidden();

      // Verify slider position matches index * 20%
      const slider = page.locator('.grafton-dock-slider');
      await expect(slider).toBeVisible();
      const sliderBox = await slider.boundingBox();
      expect(sliderBox).not.toBeNull();

      const expectedSliderX = (dockBox!.width / 5) * expectedIndex;
      expect(Math.abs(sliderBox!.x - expectedSliderX)).toBeLessThan(5);

      // Check floating button clearance on /aulas
      if (path === '/aulas') {
        const floatingBtn = page.locator('.mobile-floating-top-btn');
        if (await floatingBtn.isVisible()) {
          const btnBox = await floatingBtn.boundingBox();
          expect(btnBox).not.toBeNull();
          expect(btnBox!.y + btnBox!.height).toBeLessThanOrEqual(dockBox!.y - 6);
        }
      }
    });
  }

  test('Tapping a dock tab switches route and moves slider cleanly', async ({ page }) => {
    await page.goto('/aulas');
    await page.waitForSelector('.grafton-mobile-dock', { state: 'visible', timeout: 8000 });

    const dock = page.locator('.grafton-mobile-dock');
    const items = dock.locator('.grafton-dock-item');

    // Click Cursos tab (index 1)
    await items.nth(1).click();
    await page.waitForURL('**/cursos');

    const slider = page.locator('.grafton-dock-slider');
    const dockBox = await dock.boundingBox();
    const sliderBox = await slider.boundingBox();
    const expectedX = (dockBox!.width / 5) * 1;
    expect(Math.abs(sliderBox!.x - expectedX)).toBeLessThan(5);
  });
});

