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
      await page.goto('/', { waitUntil: 'networkidle' });

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
    await page.goto('/', { waitUntil: 'networkidle' });

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

  test('3. All 16 UTEC Careers 10-Cycle Verbatim 2026 Curricular DAG (200 Credits) & Matemáticas Discretas Verification', async ({
    page,
  }) => {
    const consoleErrors: string[] = [];
    page.on('pageerror', err => consoleErrors.push(err.message));
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/', { waitUntil: 'networkidle' });

    // Navigate to Malla & 16 Carreras view
    const mallaBtn = page.getByRole('button', { name: /Malla|Cursos|Carreras/i }).first();
    await mallaBtn.click();

    // Verify all 16 career buttons exist
    const careerButtons = page.locator('.dag-career-btn');
    await expect(careerButtons).toHaveCount(16);

    // Verify all 10 Cycle columns (Ciclo 1 to Ciclo 10) render
    const cycleColumns = page.locator('.dag-cycle-column');
    await expect(cycleColumns).toHaveCount(10);

    // Assert DAG nodes render BOTH course code AND full course name (never just code)
    const dagNodes = page.locator('[id^="dag-node-"]');
    const nodeCount = await dagNodes.count();
    expect(nodeCount).toBeGreaterThanOrEqual(55);

    for (let i = 0; i < Math.min(nodeCount, 8); i++) {
      const text = (await dagNodes.nth(i).innerText()).trim();
      expect(text.length).toBeGreaterThan(10); // Code (6 chars) + Full Course Name
    }

    // 1. Verify Administración y Negocios Digitales (200 cr: 21, 21, 21, 20, 21, 22, 22, 17, 17, 18)
    const andBtn = page.getByRole('button', { name: /Administración y Negocios Digitales/i }).first();
    await expect(andBtn).toBeVisible();
    await andBtn.click();
    await expect(page.locator('.dag-inspector-sub')).toContainText('10 Ciclos (200 cr)');
    const andCycleCredits = await page.locator('.dag-cycle-credits').allInnerTexts();
    expect(andCycleCredits).toEqual([
      '21 cr',
      '21 cr',
      '21 cr',
      '20 cr',
      '21 cr',
      '22 cr',
      '22 cr',
      '17 cr',
      '17 cr',
      '18 cr',
    ]);
    await expect(page.locator('#dag-node-AD1001')).toContainText(
      'Introducción a los Negocios y la Innovación Empresarial'
    );
    await expect(page.locator('#dag-node-GH1001')).toContainText(
      'Taller de Planeamiento y Estrategias de Aprendizaje'
    );
    await expect(page.locator('#dag-node-MA1000')).toContainText('Pensamiento Matemático');
    await expect(page.locator('#dag-node-AD5005')).toContainText(
      'Proyecto Final de Administración y Negocios Digitales'
    );
    // Ensure zero invented course names
    await expect(page.getByText(/Fintech & Blockchain Business/i)).toHaveCount(0);

    await page.screenshot({
      path: 'audit-screenshots/03c-curricular-dag-administracion-200cr.png',
      fullPage: true,
    });

    // 2. Select Ciencia de Datos e Inteligencia Artificial and verify CS1040 & CS1042
    const dsBtn = page.getByRole('button', { name: /Ciencia de Datos e Inteligencia Artificial/i }).first();
    await expect(dsBtn).toBeVisible();
    await dsBtn.click();
    await expect(page.locator('.dag-inspector-sub')).toContainText('10 Ciclos (200 cr)');

    await expect(page.locator('#dag-node-CS1040')).toContainText('Matemáticas Discretas I');
    await expect(page.locator('#dag-node-CS1042')).toContainText('Matemáticas Discretas II');
    await page.locator('#dag-node-CS1042').click();

    await page.screenshot({
      path: 'audit-screenshots/03a-curricular-dag-ciencia-datos.png',
      fullPage: true,
    });

    // 3. Iterate across ALL 16 UTEC Careers and verify 10 cycles + 200 cr on every single career
    const all16CareerNames = [
      'Administración y Negocios Digitales',
      'Business Analytics',
      'Ciencia de la Computación',
      'Ciencia de Datos e Inteligencia Artificial',
      'Sistemas de Información',
      'Ciberseguridad',
      'Ingeniería Industrial',
      'Bioingeniería',
      'Ingeniería de la Energía',
      'Ingeniería Mecánica',
      'Ingeniería Química',
      'Ingeniería Ambiental',
      'Ingeniería Civil',
      'Ingeniería Electrónica',
      'Ingeniería Mecatrónica',
      'Física',
    ];

    for (const careerName of all16CareerNames) {
      const careerBtn = page.locator('.dag-career-btn', { hasText: careerName }).first();
      await expect(careerBtn).toBeVisible();
      await careerBtn.click();
      await expect(cycleColumns).toHaveCount(10);
      await expect(page.locator('.dag-inspector-sub')).toContainText('10 Ciclos (200 cr)');
      const count = await dagNodes.count();
      expect(count).toBeGreaterThanOrEqual(54);
    }

    // 4. Verify SUPREME CURRICULAR GRAPH UX REMEDIATION (FIXES 1, 2, 3, 4) on Ciencia de la Computación
    await page.locator('.dag-career-btn', { hasText: 'Ciencia de la Computación' }).first().click();
    await page.locator('#dag-node-CS1042').click();
    await expect(page.locator('.dag-inspector-code')).toHaveText('CS1042');

    // FIX 1: Hovering intermediate cards (CS2014, CS2013) MUST NOT hijack the active course or change the Inspector
    await page.locator('#dag-node-CS2014').hover();
    await expect(page.locator('.dag-inspector-code')).toHaveText('CS1042');
    await page.locator('#dag-node-CS2013').hover();
    await expect(page.locator('.dag-inspector-code')).toHaveText('CS1042');

    // FIX 2: Switching between 2-row unlock pills (CS1042) and 1-row unlock pills (CS2014) produces 0px vertical layout jump (CLS = 0)
    const layoutWithCS1042 = await page.evaluate(() => {
      const canvas = document.querySelector('.dag-canvas-card') as HTMLElement;
      const inspector = document.querySelector('.dag-inspector-card') as HTMLElement;
      return {
        canvasOffsetTop: canvas.offsetTop,
        inspectorHeight: inspector.offsetHeight,
      };
    });
    await page.locator('#dag-node-CS2014').click();
    await expect(page.locator('.dag-inspector-code')).toHaveText('CS2014');
    const layoutWithCS2014 = await page.evaluate(() => {
      const canvas = document.querySelector('.dag-canvas-card') as HTMLElement;
      const inspector = document.querySelector('.dag-inspector-card') as HTMLElement;
      return {
        canvasOffsetTop: canvas.offsetTop,
        inspectorHeight: inspector.offsetHeight,
      };
    });
    expect(Math.abs(layoutWithCS2014.canvasOffsetTop - layoutWithCS1042.canvasOffsetTop)).toBe(0);
    expect(Math.abs(layoutWithCS2014.inspectorHeight - layoutWithCS1042.inspectorHeight)).toBe(0);

    // Select CS1042 again, reset horizontal scroll to 0, move mouse away, and wait for 160ms opacity transition to settle
    await page.evaluate(() => {
      const scroller = document.querySelector('.dag-scroll-container');
      if (scroller) scroller.scrollLeft = 0;
    });
    await page.locator('#dag-node-CS1042').click();
    await page.mouse.move(10, 10);
    await page.waitForTimeout(220);

    const lineageAudit = await page.evaluate(() => {
      const ghostCards = Array.from(document.querySelectorAll('.dag-node.is-ghosted'));
      const directUnlock = document.querySelector('#dag-node-CS2020');
      const transitiveUnlock = document.querySelector('#dag-node-CS3024');

      return {
        ghostCount: ghostCards.length,
        // Card containers themselves must be 100% opaque (#ECEAE4, opacity: 1, z-index: 10) to block SVG bleed-through
        ghostContainerOpacities: ghostCards.map(el => getComputedStyle(el).opacity),
        ghostContainerBgs: ghostCards.map(el => getComputedStyle(el).backgroundColor),
        ghostContainerZIndices: ghostCards.map(el => getComputedStyle(el).zIndex),
        // Inner children (> *) must carry the 0.35 ghosting opacity
        ghostChildOpacities: ghostCards.map(el =>
          el.firstElementChild ? parseFloat(getComputedStyle(el.firstElementChild).opacity) : 1
        ),
        selectedRoleText: document
          .querySelector('#dag-node-CS1042 .dag-role-badge')
          ?.textContent?.trim(),
        directUnlockDegree: directUnlock?.getAttribute('data-degree'),
        directUnlockBorderStyle: directUnlock ? getComputedStyle(directUnlock).borderTopStyle : null,
        directUnlockBadge: directUnlock?.querySelector('.dag-role-badge')?.textContent?.trim(),
        transitiveUnlockDegree: transitiveUnlock?.getAttribute('data-degree'),
        transitiveUnlockBorderStyle: transitiveUnlock
          ? getComputedStyle(transitiveUnlock).borderTopStyle
          : null,
        transitiveUnlockChildOpacity:
          transitiveUnlock && transitiveUnlock.firstElementChild
            ? parseFloat(getComputedStyle(transitiveUnlock.firstElementChild).opacity)
            : null,
        transitiveUnlockBadge: transitiveUnlock
          ?.querySelector('.dag-role-badge')
          ?.textContent?.trim(),
      };
    });

    expect(lineageAudit.ghostCount).toBeGreaterThanOrEqual(35);
    for (const op of lineageAudit.ghostContainerOpacities) {
      expect(op).toBe('1');
    }
    for (const bg of lineageAudit.ghostContainerBgs) {
      expect(bg).toBe('rgb(236, 234, 228)'); // #ECEAE4 opaque concrete
    }
    for (const z of lineageAudit.ghostContainerZIndices) {
      expect(z).toBe('10');
    }
    for (const childOp of lineageAudit.ghostChildOpacities) {
      expect(childOp).toBeCloseTo(0.35, 2);
    }
    expect(lineageAudit.selectedRoleText).toBe('Seleccionado');
    expect(lineageAudit.directUnlockDegree).toBe('1st-unlock');
    expect(lineageAudit.directUnlockBorderStyle).toBe('solid');
    expect(lineageAudit.directUnlockBadge).toBe('Se desbloquea');
    expect(lineageAudit.transitiveUnlockDegree).toBe('2nd-unlock');
    expect(lineageAudit.transitiveUnlockBorderStyle).toBe('dashed');
    expect(lineageAudit.transitiveUnlockChildOpacity).toBeCloseTo(0.78, 2);
    expect(lineageAudit.transitiveUnlockBadge).toBe('Ruta posterior');

    await page.screenshot({
      path: 'audit-screenshots/03-curricular-dag-16-careers.png',
      fullPage: true,
    });

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

    expect(consoleErrors).toEqual([]);
  });

  test('4. Peer Mentors, Docentes & Free Classrooms 15-Hour Swiss Timeline Audit (Desktop & Mobile)', async ({
    page,
  }) => {
    const consoleErrors: string[] = [];
    page.on('pageerror', err => consoleErrors.push(err.message));
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/', { waitUntil: 'networkidle' });

    // 1. Mentores View (1440x900 & 375x812)
    const mentorsBtn = page.getByRole('button', { name: /Mentores/i }).first();
    await mentorsBtn.click();
    await expect(page.locator('.mentor-card').first()).toBeVisible();
    await page.screenshot({ path: 'audit-screenshots/04-mentors-desktop.png', fullPage: true });

    await page.setViewportSize({ width: 375, height: 812 });
    await page.screenshot({ path: 'audit-screenshots/04b-mentors-mobile.png', fullPage: true });

    // 2. Docentes View (1440x900 & 375x812) — Verify 4-Column Swiss Orthogonal Metric Grid & Zero Dark Gray #6B7075 Box
    await page.setViewportSize({ width: 1440, height: 900 });
    const docentesTab = page.getByRole('button', { name: /^Docentes$/i }).first();
    await expect(docentesTab).toBeVisible();
    await docentesTab.click();
    await expect(page.locator('.professor-card').first()).toBeVisible();

    const profCardAudit = await page.evaluate(() => {
      const kpiBox = document.querySelector('.prof-card-kpis');
      const avatar = document.querySelector('.prof-card-avatar');
      if (!kpiBox || !avatar) return null;
      const kpiStyle = getComputedStyle(kpiBox);
      const avatarStyle = getComputedStyle(avatar);
      return {
        kpiBg: kpiStyle.backgroundColor,
        kpiRadius: kpiStyle.borderRadius,
        avatarBg: avatarStyle.backgroundColor,
        avatarRadius: avatarStyle.borderRadius,
      };
    });
    expect(profCardAudit).not.toBeNull();
    expect(profCardAudit?.kpiBg).toBe('rgb(220, 217, 210)'); // #DCD9D2 concrete (NOT dark gray #6B7075)
    expect(profCardAudit?.kpiRadius).toBe('0px');
    expect(profCardAudit?.avatarBg).toBe('rgb(220, 217, 210)');
    expect(profCardAudit?.avatarRadius).toBe('0px');

    await page.screenshot({ path: 'audit-screenshots/04c-docentes-desktop.png', fullPage: true });

    await page.setViewportSize({ width: 375, height: 812 });
    await page.screenshot({ path: 'audit-screenshots/04d-docentes-mobile.png', fullPage: true });

    // 3. Aulas Libres View (1440x900 & 375x812) — Verify 15-Hour Swiss Timeline & Single Structural Banner
    await page.setViewportSize({ width: 1440, height: 900 });
    const roomsBtn = page.getByRole('button', { name: /Aulas/i }).first();
    await roomsBtn.click();
    await expect(page.locator('.campus-floor-explorer')).toBeVisible();
    await expect(page.locator('.classroom-card').first()).toBeVisible();

    const classroomAudit = await page.evaluate(() => {
      const firstCard = document.querySelector('.classroom-card');
      if (!firstCard) return null;
      const cells = firstCard.querySelectorAll('.swiss-hour-cell');
      const track = firstCard.querySelector('.classroom-timeline-track');
      const innerBanner = firstCard.querySelector('.info-banner-content');
      const monogram = firstCard.querySelector('.classroom-code-monogram');
      return {
        hourCellsCount: cells.length,
        trackRadius: track ? getComputedStyle(track).borderRadius : null,
        innerBannerBorderWidth: innerBanner ? getComputedStyle(innerBanner).borderTopWidth : null,
        monogramBg: monogram ? getComputedStyle(monogram).backgroundColor : null,
        monogramRadius: monogram ? getComputedStyle(monogram).borderRadius : null,
      };
    });
    expect(classroomAudit).not.toBeNull();
    expect(classroomAudit?.hourCellsCount).toBe(15); // 15-hour strip (07:00 to 22:00)
    expect(classroomAudit?.trackRadius).toBe('0px');
    expect(classroomAudit?.innerBannerBorderWidth).toBe('0px'); // No double border!
    expect(classroomAudit?.monogramBg).toBe('rgb(220, 217, 210)'); // #DCD9D2 orthogonal monogram
    expect(classroomAudit?.monogramRadius).toBe('0px');

    await page.screenshot({ path: 'audit-screenshots/05-classrooms-desktop.png', fullPage: true });

    // Mobile (393x852) at /aulas: verify zero horizontal overflow & Grafton Swiss 0px floating button ("↑ Filtros y Pisos")
    await page.setViewportSize({ width: 393, height: 852 });
    await page.goto('/aulas', { waitUntil: 'networkidle' });
    await expect(page.locator('.classroom-card').first()).toBeVisible();

    const aulasMobileOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth <= window.innerWidth;
    });
    expect(aulasMobileOverflow).toBe(true);

    // Scroll down to trigger the floating "↑ Filtros y Pisos" button
    await page.evaluate(() => window.scrollTo(0, 620));
    const floatingBtn = page.locator('.mobile-floating-top-btn');
    await expect(floatingBtn).toBeVisible();

    const floatingBtnAudit = await floatingBtn.evaluate(el => {
      const s = getComputedStyle(el);
      const arrow = el.querySelector('.floating-top-arrow');
      return {
        borderRadius: s.borderRadius,
        backgroundColor: s.backgroundColor,
        backgroundImage: s.backgroundImage,
        borderTopColor: s.borderTopColor,
        borderTopWidth: s.borderTopWidth,
        boxShadow: s.boxShadow,
        text: el.textContent?.trim(),
        arrowColor: arrow ? getComputedStyle(arrow).color : null,
      };
    });

    expect(floatingBtnAudit.borderRadius).toBe('0px');
    expect(floatingBtnAudit.backgroundColor).toBe('rgb(242, 240, 236)'); // #F2F0EC concrete, NOT #2563EB royal blue
    expect(floatingBtnAudit.backgroundImage).toBe('none');
    expect(floatingBtnAudit.borderTopColor).toBe('rgb(0, 119, 158)'); // #00779E top beam
    expect(floatingBtnAudit.borderTopWidth).toBe('3px');
    expect(floatingBtnAudit.arrowColor).toBe('rgb(0, 119, 158)');

    await page.screenshot({
      path: 'audit-screenshots/05c-classrooms-mobile-floating-btn.png',
      fullPage: false,
    });
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: 'audit-screenshots/05b-classrooms-mobile.png', fullPage: true });

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
