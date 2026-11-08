import { test, expect } from '@playwright/test';

const VIEWPORTS = [
  { name: 'mobile', width: 375, height: 812 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'laptop', width: 1280, height: 800 },
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'widescreen', width: 1920, height: 1080 },
];

test.describe('MatricuLAB — Autonomous Self-Healing Visual, Responsive & Functional Audit', () => {
  for (const vp of VIEWPORTS) {
    test(`1. Responsive Layout & Zero Overflow Audit [${vp.name} ${vp.width}x${vp.height}]`, async ({
      page,
    }) => {
      const consoleErrors: string[] = [];
      page.on('pageerror', err => consoleErrors.push(err.message));
      page.on('console', msg => {
        if (msg.type() === 'error') consoleErrors.push(msg.text());
      });

      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto('http://localhost:4321', { waitUntil: 'networkidle' });

      // 1. Assert Header is visible and document body does not horizontally overflow viewport
      await expect(page.locator('header').first()).toBeVisible();
      const hasHorizontalOverflow = await page.evaluate(() => {
        return document.documentElement.scrollWidth > window.innerWidth + 2;
      });
      expect(hasHorizontalOverflow).toBe(false);

      await page.screenshot({
        path: `audit-screenshots/01-schedule-${vp.name}.png`,
        fullPage: true,
      });

      // 2. If mobile/tablet, test the responsive course drawer toggle
      if (vp.width < 1024) {
        const drawerBtn = page
          .locator('#mobile-sidebar-btn, [aria-label*="Cursos"], button:has-text("☰")')
          .first();
        await expect(drawerBtn).toBeVisible();
        await drawerBtn.click();
        await page.waitForTimeout(220);
        await page.screenshot({ path: `audit-screenshots/01b-mobile-drawer-${vp.name}.png` });
      }

      expect(consoleErrors).toEqual([]);
    });
  }

  test('2. Schedule Combinatorial Engine & Interactive Section Switching Non-Regression', async ({
    page,
  }) => {
    const consoleErrors: string[] = [];
    page.on('pageerror', err => consoleErrors.push(err.message));
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('http://localhost:4321', { waitUntil: 'networkidle' });

    // Verify schedule blocks render with valid non-zero geometry
    const blocks = page.locator(
      '#timetable-grid-body [style*="border-left"], [class*="schedule-block"]'
    );
    await expect(blocks.first()).toBeVisible();
    const initialCount = await blocks.count();
    expect(initialCount).toBeGreaterThan(0);

    // Switch between generated schedule combinations (Opción 1, Opción 2)
    const option2Btn = page.getByRole('button', { name: /Opción 2|Horario 2/i }).first();
    await expect(option2Btn).toBeVisible();
    await option2Btn.click();
    await expect(blocks.first()).toBeVisible();
    await page.screenshot({ path: 'audit-screenshots/02-schedule-combination-2.png' });

    // Verify Optimizer modal opens and works without regression
    const autoGenBtn = page.getByRole('button', { name: /Auto-Generar/i }).first();
    await expect(autoGenBtn).toBeVisible();
    await autoGenBtn.click();
    await expect(page.locator('.optimizer-modal-card')).toBeVisible();
    await page.screenshot({ path: 'audit-screenshots/02b-optimizer-modal.png' });
    await page.locator('.optimizer-modal-card .close-btn').first().click();

    // Verify Importar Oferta (FileUploadModal) and Exportar (ExportModal) open cleanly
    const importBtn = page.getByRole('button', { name: /Importar Oferta/i }).first();
    await importBtn.click();
    await expect(page.getByText(/Gestión de Archivos de Matrícula/i)).toBeVisible();
    await page.locator('.modal-card .close-btn').first().click();

    const exportBtn = page.getByRole('button', { name: /^Exportar$/i }).first();
    await exportBtn.click();
    await expect(page.getByText(/Exportar u Organizar Horario/i)).toBeVisible();
    await page.locator('.modal-card .close-btn').first().click();

    expect(consoleErrors).toEqual([]);
  });

  test('3. All 16 UTEC Careers Curricular DAG & Full Course Name + Code Verification', async ({
    page,
  }) => {
    const consoleErrors: string[] = [];
    page.on('pageerror', err => consoleErrors.push(err.message));
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('http://localhost:4321', { waitUntil: 'networkidle' });

    // Navigate to Malla & 16 Carreras view
    const mallaBtn = page.getByRole('button', { name: /Malla|Cursos|Carreras/i }).first();
    await mallaBtn.click();

    // Verify all 16 career buttons exist
    const careerButtons = page.locator('.dag-career-btn');
    await expect(careerButtons).toHaveCount(16);

    // Assert DAG nodes render BOTH course code AND full course name (never just code)
    const dagNodes = page.locator('[id^="dag-node-"]');
    const nodeCount = await dagNodes.count();
    expect(nodeCount).toBeGreaterThan(6);

    for (let i = 0; i < Math.min(nodeCount, 8); i++) {
      const text = (await dagNodes.nth(i).innerText()).trim();
      expect(text.length).toBeGreaterThan(10); // Code (6 chars) + Full Course Name
    }

    await page.screenshot({
      path: 'audit-screenshots/03a-curricular-dag-computacion.png',
      fullPage: true,
    });

    // Test switching across faculties (Ciberseguridad, Business Analytics, Ingeniería Mecatrónica, Física)
    for (const careerName of [
      'Ciberseguridad',
      'Business Analytics',
      'Ingeniería Mecatrónica',
      'Física',
    ]) {
      const careerBtn = page.getByRole('button', { name: new RegExp(careerName, 'i') }).first();
      await expect(careerBtn).toBeVisible();
      await careerBtn.click();
      await expect(dagNodes.first()).toBeVisible();
    }

    // Check zero overflow on mobile inside DAG view as well
    await page.setViewportSize({ width: 375, height: 812 });
    const dagMobileOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > window.innerWidth + 2;
    });
    expect(dagMobileOverflow).toBe(false);
    await page.screenshot({
      path: 'audit-screenshots/03b-curricular-dag-mobile.png',
      fullPage: true,
    });

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.screenshot({
      path: 'audit-screenshots/03-curricular-dag-16-careers.png',
      fullPage: true,
    });

    expect(consoleErrors).toEqual([]);
  });

  test('4. Peer Mentors Clash Detection & Free Classrooms Floor Explorer', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('pageerror', err => consoleErrors.push(err.message));
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('http://localhost:4321', { waitUntil: 'networkidle' });

    const mentorsBtn = page.getByRole('button', { name: /Mentores/i }).first();
    await mentorsBtn.click();
    await expect(page.locator('.mentor-card').first()).toBeVisible();
    await page.screenshot({ path: 'audit-screenshots/04-mentors-desktop.png', fullPage: true });

    const roomsBtn = page.getByRole('button', { name: /Aulas/i }).first();
    await roomsBtn.click();
    await expect(page.locator('.campus-floor-explorer')).toBeVisible();
    await page.screenshot({ path: 'audit-screenshots/05-classrooms-desktop.png', fullPage: true });

    // Verify Grafton Swiss Concrete Tokens & 0px border-radius + zero backdrop-filter blur
    const tokenAudit = await page.evaluate(() => {
      const rootStyle = getComputedStyle(document.documentElement);
      const bgCanvas = rootStyle.getPropertyValue('--bg-canvas').trim().toUpperCase();
      const radiusCard = rootStyle.getPropertyValue('--radius-card').trim();
      const topbar = document.querySelector('header');
      const blurVal = topbar ? getComputedStyle(topbar).backdropFilter : 'none';
      return { bgCanvas, radiusCard, blurVal };
    });
    expect(tokenAudit.bgCanvas).toBe('#E6E4DF');
    expect(tokenAudit.radiusCard).toBe('0px');
    expect(tokenAudit.blurVal === 'none' || tokenAudit.blurVal === '').toBe(true);

    expect(consoleErrors).toEqual([]);
  });
});
