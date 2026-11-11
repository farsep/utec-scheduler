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

    // In Jose Pino Matos's timetable (media_1794250950829_fc308faf.png), all classes are 2h (07-09, 11-13, 15-17)
    // They must display full "Teoría" / "Laboratorio"
    const pinoBadges = await modal.locator('.prof-session-footer .dynamic-session-badge').allInnerTexts();
    expect(pinoBadges.length).toBeGreaterThan(0);
    expect(pinoBadges.some(b => b.includes('Teoría') || b.includes('Laboratorio'))).toBe(true);
    expect(pinoBadges.some(b => b.includes('TEO1') || b.includes('LAB11'))).toBe(false);
  });

  test('1B. Exact Timetable Verification for Cerda Hernandez, Jose Javier', async ({ page }) => {
    await page.goto('/profesores?profesor=Cerda%20Hernandez%2C%20Jose%20Javier');
    await page.waitForLoadState('networkidle');

    const modal = page.locator('.prof-modal');
    await expect(modal).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(400);

    // Capture screenshot matching fc308faf.png
    await page.screenshot({ path: 'audit-screenshots/prof-cerda-hernandez-2h-badges.png' });

    // Assert that badges for 2h sessions display complete "Teoría"
    const badges = await modal.locator('.prof-session-footer .dynamic-session-badge').allInnerTexts();
    expect(badges.length).toBeGreaterThan(0);
    expect(badges.some(b => b.includes('Teoría') && b.includes('1'))).toBe(true);
  });

  test('1C. 2-Hour Laboratory Session Displays Complete "Laboratorio" (Romero Calla)', async ({ page }) => {
    await page.goto('/profesores?profesor=Romero%20Calla%2C%20Luciano%20Arnaldo');
    await page.waitForLoadState('networkidle');

    const modal = page.locator('.prof-modal');
    await expect(modal).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(400);

    // Capture screenshot of Luciano Romero Calla's timetable
    await page.screenshot({ path: 'audit-screenshots/prof-romero-calla-lab-badges.png' });

    // Assert that 2h laboratory session displays complete "Laboratorio"
    const badges = await modal.locator('.prof-session-footer .dynamic-session-badge').allInnerTexts();
    expect(badges.length).toBeGreaterThan(0);
    expect(badges.some(b => b.includes('Laboratorio'))).toBe(true);
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

  test('3. Ver Horario > Button Uniformity & Click Action across /aulas, /profesores, /cursos, /mentores', async ({ page }) => {
    // 3A: /aulas
    await page.goto('/aulas');
    await page.waitForLoadState('networkidle');

    const aulasBtn = page.locator('.classroom-card .btn-view-schedule').first();
    await expect(aulasBtn).toBeVisible({ timeout: 10000 });
    const aulasStyles = await aulasBtn.evaluate((el) => {
      const cs = window.getComputedStyle(el);
      return {
        bg: cs.backgroundColor,
        color: cs.color,
        radius: cs.borderRadius,
        textTransform: cs.textTransform,
      };
    });
    expect(aulasStyles.bg).toBe('rgb(24, 24, 26)');
    expect(aulasStyles.radius).toBe('0px');
    expect(aulasStyles.textTransform).toBe('uppercase');

    // Click "Ver Horario" on Classroom card and verify modal opens
    await aulasBtn.click();
    const classroomModal = page.locator('.classroom-modal');
    await expect(classroomModal).toBeVisible({ timeout: 5000 });
    await page.keyboard.press('Escape');
    await expect(classroomModal).toBeHidden({ timeout: 3000 });

    // Switch to "Campus Vertical" view to verify floor map tile opens modal
    const floorTab = page.locator('.classroom-submode-btn, .dag-submode-btn').filter({ hasText: /Campus Vertical|Pisos/i });
    if (await floorTab.isVisible()) {
      await floorTab.click();
    }
    const roomTile = page.locator('.campus-floor-explorer .campus-room-chip').first();
    await expect(roomTile).toBeVisible();
    await roomTile.click();
    await expect(classroomModal).toBeVisible({ timeout: 5000 });
    await page.keyboard.press('Escape');
    await expect(classroomModal).toBeHidden({ timeout: 3000 });

    // Switch back to directory tab
    const dirTab = page.locator('.classroom-submode-btn, .dag-submode-btn').filter({ hasText: /Directorio|Disponibilidad/i });
    if (await dirTab.isVisible()) {
      await dirTab.click();
    }

    // 3B: /profesores
    await page.goto('/profesores');
    await page.waitForLoadState('networkidle');
    const profBtn = page.locator('.professor-card .btn-view-schedule, .professor-card .prof-view-detail-btn').first();
    await expect(profBtn).toBeVisible({ timeout: 10000 });
    const profStyles = await profBtn.evaluate((el) => {
      const cs = window.getComputedStyle(el);
      return {
        bg: cs.backgroundColor,
        color: cs.color,
        radius: cs.borderRadius,
        textTransform: cs.textTransform,
      };
    });
    expect(profStyles.bg).toBe('rgb(24, 24, 26)');
    expect(profStyles.radius).toBe('0px');
    expect(profStyles.textTransform).toBe('uppercase');

    // Capture screenshot of Professor Card with uniform black button
    await profBtn.scrollIntoViewIfNeeded();
    await page.waitForTimeout(200);
    await page.screenshot({ path: 'audit-screenshots/prof-card-ver-horario-button.png' });

    // Click "Ver Horario" on Professor card and verify Professor Modal opens
    await profBtn.click();
    const profModal = page.locator('.prof-modal');
    await expect(profModal).toBeVisible({ timeout: 5000 });
    await page.keyboard.press('Escape');
    await expect(profModal).toBeHidden({ timeout: 3000 });

    // 3C: /cursos
    await page.goto('/cursos');
    await page.waitForLoadState('networkidle');
    // Switch to Catalog mode if DAG view is currently showing
    const catalogTabBtn = page.locator('button', { hasText: 'Catálogo Ofertado' });
    if (await catalogTabBtn.isVisible()) {
      await catalogTabBtn.click();
      await page.waitForTimeout(300);
    }
    const courseBtn = page.locator('.course-card .btn-view-schedule, .course-card .course-view-detail-btn').first();
    await expect(courseBtn).toBeVisible({ timeout: 10000 });
    const courseStyles = await courseBtn.evaluate((el) => {
      const cs = window.getComputedStyle(el);
      return {
        bg: cs.backgroundColor,
        color: cs.color,
        radius: cs.borderRadius,
        textTransform: cs.textTransform,
      };
    });
    expect(courseStyles.bg).toBe('rgb(24, 24, 26)');
    expect(courseStyles.radius).toBe('0px');
    expect(courseStyles.textTransform).toBe('uppercase');

    // Click "Ver Horario" on Course card and verify Course Modal dialog opens
    await courseBtn.click();
    const courseModal = page.locator('.course-modal-dialog');
    await expect(courseModal).toBeVisible({ timeout: 5000 });
    await page.keyboard.press('Escape');
    await expect(courseModal).toBeHidden({ timeout: 3000 });

    // 3D: /mentores
    await page.goto('/mentores');
    await page.waitForLoadState('networkidle');
    const mentorBtn = page.locator('.mentor-card .btn-view-schedule, .mentor-card .mentor-view-btn').first();
    await expect(mentorBtn).toBeVisible({ timeout: 10000 });
    const mentorStyles = await mentorBtn.evaluate((el) => {
      const cs = window.getComputedStyle(el);
      return {
        bg: cs.backgroundColor,
        color: cs.color,
        radius: cs.borderRadius,
        textTransform: cs.textTransform,
      };
    });
    expect(mentorStyles.bg).toBe('rgb(24, 24, 26)');
    expect(mentorStyles.radius).toBe('0px');
    expect(mentorStyles.textTransform).toBe('uppercase');

    // Click "Ver Horario" on Mentor card and verify Mentor Modal opens
    await mentorBtn.click();
    const mentorModal = page.locator('.mentor-modal');
    await expect(mentorModal).toBeVisible({ timeout: 5000 });
    await page.keyboard.press('Escape');
    await expect(mentorModal).toBeHidden({ timeout: 3000 });
  });

  test('3E. Ver Horario > Hover Effect ONLY when hovering button itself (NOT card)', async ({ page }) => {
    // 3E-1: /cursos
    await page.goto('/cursos');
    await page.waitForLoadState('networkidle');
    const catalogTabBtn = page.locator('button', { hasText: 'Catálogo Ofertado' });
    await expect(catalogTabBtn).toBeVisible({ timeout: 10000 });
    await catalogTabBtn.click();
    await page.waitForTimeout(400);

    const courseCard = page.locator('.courses-cards-grid .course-card').first();
    await expect(courseCard).toBeVisible({ timeout: 15000 });
    const courseBtn = courseCard.locator('.btn-view-schedule');
    await expect(courseBtn).toBeVisible({ timeout: 10000 });

    // Initial state: not hovered -> #18181A
    await page.mouse.move(0, 0);
    await page.waitForTimeout(100);
    let bg = await courseBtn.evaluate((el) => window.getComputedStyle(el).backgroundColor);
    expect(bg).toBe('rgb(24, 24, 26)');

    // Hover on card (NOT on the button) -> button MUST REMAIN #18181A (NO hover effect on card hover)
    await courseCard.hover({ position: { x: 20, y: 20 } });
    await page.waitForTimeout(150);
    bg = await courseBtn.evaluate((el) => window.getComputedStyle(el).backgroundColor);
    expect(bg).toBe('rgb(24, 24, 26)');
    await courseCard.screenshot({ path: 'audit-screenshots/course-card-not-hovered-button.png' });

    // Hover DIRECTLY on button -> button TURNS #00779E
    await courseBtn.hover();
    await page.waitForTimeout(150);
    bg = await courseBtn.evaluate((el) => window.getComputedStyle(el).backgroundColor);
    expect(bg).toBe('rgb(0, 119, 158)');
    await courseCard.screenshot({ path: 'audit-screenshots/course-card-hovered-button.png' });

    // Move away -> back to #18181A
    await page.mouse.move(0, 0);
    await page.waitForTimeout(250);
    bg = await courseBtn.evaluate((el) => window.getComputedStyle(el).backgroundColor);
    expect(bg).toBe('rgb(24, 24, 26)');

    // 3E-2: /aulas
    await page.goto('/aulas');
    await page.waitForLoadState('networkidle');
    const classroomCard = page.locator('.classroom-card').first();
    const aulasBtn = classroomCard.locator('.btn-view-schedule');
    await expect(aulasBtn).toBeVisible({ timeout: 10000 });

    // Initial state -> #18181A
    await page.mouse.move(0, 0);
    await page.waitForTimeout(100);
    bg = await aulasBtn.evaluate((el) => window.getComputedStyle(el).backgroundColor);
    expect(bg).toBe('rgb(24, 24, 26)');

    // Hover on classroom card -> button MUST REMAIN #18181A
    await classroomCard.hover({ position: { x: 20, y: 20 } });
    await page.waitForTimeout(150);
    bg = await aulasBtn.evaluate((el) => window.getComputedStyle(el).backgroundColor);
    expect(bg).toBe('rgb(24, 24, 26)');

    // Hover DIRECTLY on button -> #00779E
    await aulasBtn.hover();
    await page.waitForTimeout(150);
    bg = await aulasBtn.evaluate((el) => window.getComputedStyle(el).backgroundColor);
    expect(bg).toBe('rgb(0, 119, 158)');
    await classroomCard.screenshot({ path: 'audit-screenshots/classroom-card-hovered-button.png' });

    // Move away -> #18181A
    await page.mouse.move(0, 0);
    await page.waitForTimeout(250);
    bg = await aulasBtn.evaluate((el) => window.getComputedStyle(el).backgroundColor);
    expect(bg).toBe('rgb(24, 24, 26)');

    // 3E-3: /profesores
    await page.goto('/profesores');
    await page.waitForLoadState('networkidle');
    const profCard = page.locator('.professor-card').first();
    const profBtn = profCard.locator('.btn-view-schedule');
    await expect(profBtn).toBeVisible({ timeout: 10000 });

    // Hover on prof card -> button MUST REMAIN #18181A
    await profCard.hover({ position: { x: 20, y: 20 } });
    await page.waitForTimeout(150);
    bg = await profBtn.evaluate((el) => window.getComputedStyle(el).backgroundColor);
    expect(bg).toBe('rgb(24, 24, 26)');

    // Hover DIRECTLY on button -> #00779E
    await profBtn.hover();
    await page.waitForTimeout(150);
    bg = await profBtn.evaluate((el) => window.getComputedStyle(el).backgroundColor);
    expect(bg).toBe('rgb(0, 119, 158)');
    await profCard.screenshot({ path: 'audit-screenshots/prof-card-hovered-button.png' });

    // Move away -> #18181A
    await page.mouse.move(0, 0);
    await page.waitForTimeout(250);
    bg = await profBtn.evaluate((el) => window.getComputedStyle(el).backgroundColor);
    expect(bg).toBe('rgb(24, 24, 26)');

    // 3E-4: /mentores
    await page.goto('/mentores');
    await page.waitForLoadState('networkidle');
    const mentorCard = page.locator('.mentor-card').first();
    const mentorBtn = mentorCard.locator('.btn-view-schedule');
    await expect(mentorBtn).toBeVisible({ timeout: 10000 });

    // Hover on mentor card -> button MUST REMAIN #18181A
    await mentorCard.hover({ position: { x: 20, y: 20 } });
    await page.waitForTimeout(150);
    bg = await mentorBtn.evaluate((el) => window.getComputedStyle(el).backgroundColor);
    expect(bg).toBe('rgb(24, 24, 26)');

    // Hover DIRECTLY on button -> #00779E
    await mentorBtn.hover();
    await page.waitForTimeout(150);
    bg = await mentorBtn.evaluate((el) => window.getComputedStyle(el).backgroundColor);
    expect(bg).toBe('rgb(0, 119, 158)');
    await mentorCard.screenshot({ path: 'audit-screenshots/mentor-card-hovered-button.png' });

    // Move away -> #18181A
    await page.mouse.move(0, 0);
    await page.waitForTimeout(250);
    bg = await mentorBtn.evaluate((el) => window.getComputedStyle(el).backgroundColor);
    expect(bg).toBe('rgb(24, 24, 26)');
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

    // In Aaron Nuñez's timetable:
    // Short 1h sessions display abbreviated "Teo", while 2h+ sessions display full "Teoría" / "Laboratorio"
    const prefixes = await modal.locator('.dynamic-session-badge .session-prefix').allInnerTexts();
    expect(prefixes.length).toBeGreaterThan(0);
    expect(prefixes.some(p => p.toUpperCase() === 'TEO' || p === 'Teo')).toBe(true);
    expect(prefixes.some(p => p === 'Teoría' || p === 'Laboratorio')).toBe(true);

    // Verify badge styling matches location tag styling (border, background, font-size, 0px radius)
    const sessionBadge = modal.locator('.dynamic-session-badge').first();
    const roomTag = modal.locator('.prof-session-room-tag').first();
    await expect(sessionBadge).toBeVisible();
    await expect(roomTag).toBeVisible();

    const badgeStyles = await sessionBadge.evaluate(el => {
      const cs = window.getComputedStyle(el);
      return {
        borderRadius: cs.borderRadius,
        borderWidth: cs.borderWidth,
        borderStyle: cs.borderStyle,
        borderColor: cs.borderColor,
        backgroundColor: cs.backgroundColor,
        fontSize: cs.fontSize,
      };
    });

    const roomStyles = await roomTag.evaluate(el => {
      const cs = window.getComputedStyle(el);
      return {
        borderRadius: cs.borderRadius,
        borderWidth: cs.borderWidth,
        borderStyle: cs.borderStyle,
        borderColor: cs.borderColor,
        backgroundColor: cs.backgroundColor,
        fontSize: cs.fontSize,
      };
    });

    expect(badgeStyles.borderRadius).toBe('0px');
    expect(badgeStyles.borderRadius).toBe(roomStyles.borderRadius);
    expect(badgeStyles.borderColor).toBe(roomStyles.borderColor);
    expect(badgeStyles.backgroundColor).toBe(roomStyles.backgroundColor);
    expect(badgeStyles.fontSize).toBe(roomStyles.fontSize);

    // Verify short block (1h session) pill top and bottom borders are rendered completely without clipping
    const shortPill = modal.locator('.prof-session-short-bottom-content .dynamic-session-badge').first();
    if (await shortPill.isVisible()) {
      const shortPillStyles = await shortPill.evaluate((el) => {
        const cs = window.getComputedStyle(el);
        const rect = el.getBoundingClientRect();
        return {
          height: rect.height,
          borderTopStyle: cs.borderTopStyle,
          borderBottomStyle: cs.borderBottomStyle,
          borderTopWidth: cs.borderTopWidth,
          borderBottomWidth: cs.borderBottomWidth,
        };
      });
      expect(shortPillStyles.borderTopStyle).toBe('solid');
      expect(shortPillStyles.borderBottomStyle).toBe('solid');
      expect(parseFloat(shortPillStyles.borderTopWidth)).toBeGreaterThanOrEqual(1);
      expect(parseFloat(shortPillStyles.borderBottomWidth)).toBeGreaterThanOrEqual(1);
      expect(shortPillStyles.height).toBeGreaterThanOrEqual(14);
    }

    const shortSessionBlock = modal.locator('.prof-session-block--short').first();
    if (await shortSessionBlock.isVisible()) {
      await shortSessionBlock.screenshot({ path: 'audit-screenshots/short-session-pill-borders.png' });
    }

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

  test('8. Static Session Labels: Teo and Lab Do NOT Expand on Hover', async ({ page }) => {
    await page.goto('/profesores?profesor=Aaron%20Nu%C3%B1ez%20del%20Prado%20Tavara');
    await page.waitForLoadState('networkidle');

    const modal = page.locator('.prof-modal');
    await expect(modal).toBeVisible({ timeout: 10000 });

    // Find a dynamic session badge with exact prefix "Teo"
    const teoBadge = modal.locator('.dynamic-session-badge').filter({
      has: page.locator('.session-prefix', { hasText: /^Teo$/ })
    }).first();
    await expect(teoBadge).toBeVisible({ timeout: 5000 });

    const textBefore = (await teoBadge.innerText()).trim();

    // Hover over the badge
    await teoBadge.hover();
    await page.waitForTimeout(250);

    const textAfter = (await teoBadge.innerText()).trim();

    // Text must remain strictly identical: "Teo" does not turn into "Teoría" on hover
    expect(textAfter).toBe(textBefore);
    expect(textAfter).not.toContain('Teoría');

    // Suffix expand element must not exist
    const suffixCount = await teoBadge.locator('.session-suffix-expand').count();
    expect(suffixCount).toBe(0);
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
