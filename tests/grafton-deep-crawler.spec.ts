import { test, expect, type Page } from '@playwright/test';

/**
 * Helper that inspects an open modal container in the DOM to assert:
 * 1. Zero dark-navy/dark-slate backgrounds (luminance < 0.28 on containers > 260px wide)
 * 2. Zero unreadable dark-on-dark or white-on-pale-yellow text elements
 */
async function assertZeroDarkContainersOrUnreadableText(page: Page, modalSelector: string) {
  const report = await page.evaluate((sel) => {
    const root = document.querySelector(sel);
    if (!root) return { foundRoot: false, darkContainers: [] as string[], unreadableTexts: [] as string[] };

    const parseRgb = (str: string): [number, number, number, number] | null => {
      const m = str.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
      if (!m) return null;
      return [Number(m[1]), Number(m[2]), Number(m[3]), m[4] !== undefined ? Number(m[4]) : 1];
    };

    const relLuminance = ([r, g, b]: [number, number, number]) => {
      const toLinear = (c: number) => {
        const s = c / 255;
        return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
      };
      return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
    };

    const getEffectiveBg = (el: Element | null): [number, number, number] => {
      let cur: Element | null = el;
      while (cur) {
        const bg = getComputedStyle(cur).backgroundColor;
        const parsed = parseRgb(bg);
        if (parsed && parsed[3] > 0.15) {
          return [parsed[0], parsed[1], parsed[2]];
        }
        cur = cur.parentElement;
      }
      return [242, 240, 236]; // #F2F0EC default
    };

    const darkContainers: string[] = [];
    const unreadableTexts: string[] = [];

    const allElements = [root, ...Array.from(root.querySelectorAll('*'))];
    for (const el of allElements) {
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;

      const style = getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) continue;

      const bgParsed = parseRgb(style.backgroundColor);
      if (bgParsed && bgParsed[3] > 0.2 && rect.width > 260 && el.tagName !== 'BUTTON') {
        const lum = relLuminance([bgParsed[0], bgParsed[1], bgParsed[2]]);
        if (lum < 0.28) {
          darkContainers.push(
            `${el.tagName.toLowerCase()}.${(el.className || '').toString().slice(0, 50)} (${Math.round(rect.width)}x${Math.round(rect.height)} bg=${style.backgroundColor} lum=${lum.toFixed(3)})`
          );
        }
      }

      // Check direct text nodes for readability against effective background
      const hasDirectText = Array.from(el.childNodes).some(
        n => n.nodeType === Node.TEXT_NODE && (n.textContent || '').trim().length > 1
      );
      if (hasDirectText) {
        const fgParsed = parseRgb(style.color);
        if (fgParsed) {
          const effBg = getEffectiveBg(el);
          const fgLum = relLuminance([fgParsed[0], fgParsed[1], fgParsed[2]]);
          const bgLum = relLuminance(effBg);
          const ratio = (Math.max(fgLum, bgLum) + 0.05) / (Math.min(fgLum, bgLum) + 0.05);
          if (ratio < 2.2) {
            unreadableTexts.push(
              `${el.tagName.toLowerCase()}.${(el.className || '').toString().slice(0, 40)} text="${(el.textContent || '').trim().slice(0, 25)}" fg=${style.color} bg=rgb(${effBg.join(',')}) ratio=${ratio.toFixed(2)}`
            );
          }
        }
      }
    }

    return { foundRoot: true, darkContainers, unreadableTexts };
  }, modalSelector);

  expect(report.foundRoot).toBe(true);
  expect(report.darkContainers).toEqual([]);
  expect(report.unreadableTexts).toEqual([]);
}

test.describe('SUPREME SELF-HEALING DEEP MODAL & CALENDAR GRID CRAWLER (BUGS 1 - 6)', () => {
  test('BUG 1: Main ScheduleGrid & Auto-Generator "Calendario de Bloqueos" Vertical Lines + 0px Blocked Slots', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/', { waitUntil: 'networkidle' });

    // 1. Verify vertical day lines on main ScheduleGrid
    const mainGridBorders = await page.evaluate(() => {
      const headers = Array.from(document.querySelectorAll('.day-col-header'));
      const cols = Array.from(document.querySelectorAll('.day-column-canvas'));
      return {
        headerCount: headers.length,
        colCount: cols.length,
        headerRightBorders: headers.map(h => parseFloat(getComputedStyle(h).borderRightWidth || '0')),
        colRightBorders: cols.map(c => parseFloat(getComputedStyle(c).borderRightWidth || '0')),
      };
    });
    expect(mainGridBorders.headerCount).toBeGreaterThanOrEqual(6);
    expect(mainGridBorders.headerRightBorders.every(w => w >= 1)).toBe(true);
    expect(mainGridBorders.colRightBorders.every(w => w >= 1)).toBe(true);

    // 2. Open Generador Automático de Horarios -> Armador de Semestre (Modo Avanzado) -> Calendario de Bloqueos
    const autoGenBtn = page.getByRole('button', { name: /Auto-Generar/i }).first();
    await expect(autoGenBtn).toBeVisible();
    await autoGenBtn.click();
    await page.waitForTimeout(300);

    const advModeToggle = page.getByText(/Armador de Semestre \(Modo Avanzado\)/i).first();
    await expect(advModeToggle).toBeVisible();
    await advModeToggle.click();
    await page.waitForTimeout(300);

    await expect(page.getByText(/Calendario de Bloqueos/i).first()).toBeVisible();

    // Click a slot cell in TimeBlockerGrid to create a blocked slot and verify 0px Swiss styling
    const firstSlotCell = page.locator('.tbg-slot-cell').nth(6);
    await firstSlotCell.dispatchEvent('mousedown');
    await firstSlotCell.dispatchEvent('mouseup');
    await page.waitForTimeout(200);

    await page.screenshot({ path: 'audit-screenshots/06a-modal-autogenerator-bloqueos.png' });

    const blockerAudit = await page.evaluate(() => {
      const dayHeaders = Array.from(document.querySelectorAll('.tbg-day-header'));
      const dayCols = Array.from(document.querySelectorAll('.tbg-day-column'));
      const slotCells = Array.from(document.querySelectorAll('.tbg-slot-cell')).slice(0, 12);
      const blockedSlot = document.querySelector('.tbg-blocked-slot');
      const blockedStyle = blockedSlot ? getComputedStyle(blockedSlot) : null;
      return {
        dayHeaderCount: dayHeaders.length,
        dayColCount: dayCols.length,
        headerBordersOk: dayHeaders.every(h => parseFloat(getComputedStyle(h).borderRightWidth || '0') >= 1),
        colBordersOk: dayCols.every(c => parseFloat(getComputedStyle(c).borderRightWidth || '0') >= 1),
        slotBordersOk: slotCells.every(s => parseFloat(getComputedStyle(s).borderRightWidth || '0') >= 1),
        blockedRadius: blockedStyle ? blockedStyle.borderRadius : null,
        blockedBg: blockedStyle ? blockedStyle.backgroundColor : null,
        blockedBorderLeft: blockedStyle ? parseFloat(blockedStyle.borderLeftWidth || '0') : 0,
      };
    });

    expect(blockerAudit.dayHeaderCount).toBe(6);
    expect(blockerAudit.dayColCount).toBe(6);
    expect(blockerAudit.headerBordersOk).toBe(true);
    expect(blockerAudit.colBordersOk).toBe(true);
    expect(blockerAudit.slotBordersOk).toBe(true);
    expect(blockerAudit.blockedRadius).toBe('0px');
    expect(blockerAudit.blockedBg).toBe('rgb(244, 224, 226)'); // #F4E0E2
    expect(blockerAudit.blockedBorderLeft).toBeGreaterThanOrEqual(3);

    await assertZeroDarkContainersOrUnreadableText(page, '.optimizer-modal-card');
  });

  test('BUG 2: Course Detail Modal (/cursos -> "Ver Horarios y Aulas >") Visitor Banner, Section Cards & Visual Timetable', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/cursos', { waitUntil: 'networkidle' });

    // Switch to Catálogo Ofertado 2026-2 to inspect course cards & open CourseDetailModal
    const catalogBtn = page.getByRole('button', { name: /Catálogo Ofertado 2026-2/i }).first();
    await expect(catalogBtn).toBeVisible();
    await catalogBtn.click();
    await page.waitForTimeout(300);

    const viewDetailBtn = page.locator('.course-view-detail-btn').first();
    await expect(viewDetailBtn).toBeVisible();

    // Verify "Ver Horarios y Aulas >" button is 0px orthogonal #DCD9D2 button
    const btnAudit = await viewDetailBtn.evaluate(el => {
      const s = getComputedStyle(el);
      return { radius: s.borderRadius, bg: s.backgroundColor, color: s.color };
    });
    expect(btnAudit.radius).toBe('0px');
    expect(btnAudit.bg).toBe('rgb(220, 217, 210)'); // #DCD9D2

    // Open CourseDetailModal
    await viewDetailBtn.click();
    await page.waitForTimeout(300);
    await expect(page.locator('.course-modal-dialog')).toBeVisible();

    await page.screenshot({ path: 'audit-screenshots/06b-modal-course-detail.png' });

    const courseModalAudit = await page.evaluate(() => {
      const dialog = document.querySelector('.course-modal-dialog');
      const banner = document.querySelector('.course-modal-visitor-banner');
      const bannerTitle = document.querySelector('.visitor-banner-title');
      const bannerDesc = document.querySelector('.visitor-banner-desc');
      const bannerBtns = Array.from(document.querySelectorAll('.visitor-action-btn'));
      const secCard = document.querySelector('.course-section-card');
      const sessPill = document.querySelector('.course-session-pill');

      return {
        dialogBg: dialog ? getComputedStyle(dialog).backgroundColor : null,
        dialogRadius: dialog ? getComputedStyle(dialog).borderRadius : null,
        bannerBg: banner ? getComputedStyle(banner).backgroundColor : null,
        bannerRadius: banner ? getComputedStyle(banner).borderRadius : null,
        bannerTitleColor: bannerTitle ? getComputedStyle(bannerTitle).color : null,
        bannerDescColor: bannerDesc ? getComputedStyle(bannerDesc).color : null,
        bannerBtnsRadiusOk: bannerBtns.every(b => getComputedStyle(b).borderRadius === '0px'),
        secCardBg: secCard ? getComputedStyle(secCard).backgroundColor : null,
        secCardRadius: secCard ? getComputedStyle(secCard).borderRadius : null,
        sessPillBg: sessPill ? getComputedStyle(sessPill).backgroundColor : null,
        sessPillRadius: sessPill ? getComputedStyle(sessPill).borderRadius : null,
      };
    });

    expect(courseModalAudit.dialogBg).toBe('rgb(242, 240, 236)'); // #F2F0EC
    expect(courseModalAudit.dialogRadius).toBe('0px');
    expect(courseModalAudit.bannerBg).toBe('rgb(245, 232, 211)'); // #F5E8D3
    expect(courseModalAudit.bannerRadius).toBe('0px');
    expect(courseModalAudit.bannerTitleColor).toBe('rgb(77, 38, 0)'); // #4D2600
    expect(courseModalAudit.bannerDescColor).toBe('rgb(20, 20, 22)'); // #141416
    expect(courseModalAudit.bannerBtnsRadiusOk).toBe(true);
    expect(courseModalAudit.secCardBg).toBe('rgb(220, 217, 210)'); // #DCD9D2
    expect(courseModalAudit.secCardRadius).toBe('0px');
    expect(courseModalAudit.sessPillBg).toBe('rgb(242, 240, 236)'); // #F2F0EC
    expect(courseModalAudit.sessPillRadius).toBe('0px');

    await assertZeroDarkContainersOrUnreadableText(page, '.course-modal-dialog');

    // Switch to Horario Visual tab inside CourseDetailModal and verify vertical lines & zero dark blocks
    const visualTabBtn = page.locator('.course-modal-tab-btn').nth(1);
    await visualTabBtn.click();
    await page.waitForTimeout(300);
    await page.screenshot({ path: 'audit-screenshots/06b2-modal-course-timetable.png' });

    const timetableAudit = await page.evaluate(() => {
      const cols = Array.from(document.querySelectorAll('.course-modal-dialog .prof-timetable-day-column'));
      return {
        colCount: cols.length,
        verticalBordersOk: cols.every(c => parseFloat(getComputedStyle(c).borderRightWidth || '0') >= 1),
      };
    });
    expect(timetableAudit.colCount).toBeGreaterThanOrEqual(1);
    expect(timetableAudit.verticalBordersOk).toBe(true);
    await assertZeroDarkContainersOrUnreadableText(page, '.course-modal-dialog');
  });

  test('BUG 3: Mentor Detail Modal (/mentores -> "Ver detalle >") Grafton Swiss Concrete Audit', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/mentores', { waitUntil: 'networkidle' });

    const mentorDetailBtn = page.locator('.mentor-view-btn').first();
    await expect(mentorDetailBtn).toBeVisible();
    await mentorDetailBtn.click();
    await page.waitForTimeout(300);

    const modal = page.locator('.mentor-modal');
    await expect(modal).toBeVisible();
    await page.screenshot({ path: 'audit-screenshots/06c-modal-mentor-detail.png' });

    const mentorModalAudit = await page.evaluate(() => {
      const m = document.querySelector('.mentor-modal');
      const avatar = document.querySelector('.mentor-modal .prof-modal-avatar');
      const metrics = Array.from(document.querySelectorAll('.mentor-modal-metrics .metric-box'));
      const dayCols = Array.from(document.querySelectorAll('.mentor-modal .mentor-day-col'));
      const sessionBlock = document.querySelector('.mentor-modal .mentor-session-block');

      return {
        modalBg: m ? getComputedStyle(m).backgroundColor : null,
        modalRadius: m ? getComputedStyle(m).borderRadius : null,
        avatarBg: avatar ? getComputedStyle(avatar).backgroundColor : null,
        avatarRadius: avatar ? getComputedStyle(avatar).borderRadius : null,
        metricsCount: metrics.length,
        metricsBgOk: metrics.every(b => getComputedStyle(b).backgroundColor === 'rgb(220, 217, 210)'),
        metricsRadiusOk: metrics.every(b => getComputedStyle(b).borderRadius === '0px'),
        dayColsCount: dayCols.length,
        dayColsVerticalBordersOk: dayCols.every(
          c => parseFloat(getComputedStyle(c).borderRightWidth || '0') >= 1
        ),
        sessionBlockBg: sessionBlock ? getComputedStyle(sessionBlock).backgroundColor : null,
        sessionBlockRadius: sessionBlock ? getComputedStyle(sessionBlock).borderRadius : null,
      };
    });

    expect(mentorModalAudit.modalBg).toBe('rgb(242, 240, 236)'); // #F2F0EC
    expect(mentorModalAudit.modalRadius).toBe('0px');
    expect(mentorModalAudit.avatarBg).toBe('rgb(220, 217, 210)'); // #DCD9D2
    expect(mentorModalAudit.avatarRadius).toBe('0px');
    expect(mentorModalAudit.metricsCount).toBe(4);
    expect(mentorModalAudit.metricsBgOk).toBe(true);
    expect(mentorModalAudit.metricsRadiusOk).toBe(true);
    expect(mentorModalAudit.dayColsCount).toBe(6);
    expect(mentorModalAudit.dayColsVerticalBordersOk).toBe(true);
    expect(mentorModalAudit.sessionBlockBg).toBe('rgb(224, 235, 245)'); // #E0EBF5
    expect(mentorModalAudit.sessionBlockRadius).toBe('0px');

    await assertZeroDarkContainersOrUnreadableText(page, '.mentor-modal');
  });

  test('BUG 4: Classroom Detail Modal (/aulas -> "Ver Horario >") Grafton Swiss Concrete Audit', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/aulas', { waitUntil: 'networkidle' });

    // Open a classroom detail modal from the visible classroom cards
    const viewScheduleBtn = page
      .locator('.classroom-card .btn-view-schedule')
      .first();
    await expect(viewScheduleBtn).toBeVisible();
    await viewScheduleBtn.click();
    await page.waitForTimeout(300);

    const modal = page.locator('.classroom-modal');
    await expect(modal).toBeVisible();
    await page.screenshot({ path: 'audit-screenshots/06d-modal-classroom-detail.png' });

    const classroomModalAudit = await page.evaluate(() => {
      const m = document.querySelector('.classroom-modal');
      const iconBox = document.querySelector('.classroom-modal .classroom-type-icon--large');
      const kpis = Array.from(document.querySelectorAll('.classroom-modal .modal-kpi-card'));
      const activeDayTab = document.querySelector('.classroom-modal .modal-day-tab.active');
      const freeCard = document.querySelector('.classroom-modal .agenda-card--free');
      const occCard = document.querySelector('.classroom-modal .agenda-card--occupied');

      return {
        modalBg: m ? getComputedStyle(m).backgroundColor : null,
        modalRadius: m ? getComputedStyle(m).borderRadius : null,
        iconBg: iconBox ? getComputedStyle(iconBox).backgroundColor : null,
        iconRadius: iconBox ? getComputedStyle(iconBox).borderRadius : null,
        kpisCount: kpis.length,
        kpisBgOk: kpis.every(k => getComputedStyle(k).backgroundColor === 'rgb(220, 217, 210)'),
        kpisRadiusOk: kpis.every(k => getComputedStyle(k).borderRadius === '0px'),
        activeDayBg: activeDayTab ? getComputedStyle(activeDayTab).backgroundColor : null,
        activeDayColor: activeDayTab ? getComputedStyle(activeDayTab).color : null,
        activeDayRadius: activeDayTab ? getComputedStyle(activeDayTab).borderRadius : null,
        freeCardBg: freeCard ? getComputedStyle(freeCard).backgroundColor : null,
        freeCardRadius: freeCard ? getComputedStyle(freeCard).borderRadius : null,
        occCardBg: occCard ? getComputedStyle(occCard).backgroundColor : 'rgb(255, 255, 255)',
      };
    });

    expect(classroomModalAudit.modalBg).toBe('rgb(242, 240, 236)'); // #F2F0EC
    expect(classroomModalAudit.modalRadius).toBe('0px');
    expect(classroomModalAudit.iconBg).toBe('rgb(220, 217, 210)'); // #DCD9D2
    expect(classroomModalAudit.iconRadius).toBe('0px');
    expect(classroomModalAudit.kpisCount).toBe(3);
    expect(classroomModalAudit.kpisBgOk).toBe(true);
    expect(classroomModalAudit.kpisRadiusOk).toBe(true);
    expect(classroomModalAudit.activeDayBg).toBe('rgb(0, 119, 158)'); // #00779E
    expect(classroomModalAudit.activeDayColor).toBe('rgb(255, 255, 255)');
    expect(classroomModalAudit.activeDayRadius).toBe('0px');
    if (classroomModalAudit.freeCardBg) {
      expect(classroomModalAudit.freeCardBg).toBe('rgb(220, 238, 230)'); // #DCEEE6
      expect(classroomModalAudit.freeCardRadius).toBe('0px');
    }
    expect(classroomModalAudit.occCardBg).toBe('rgb(255, 255, 255)'); // #FFFFFF

    await assertZeroDarkContainersOrUnreadableText(page, '.classroom-modal');
  });

  test('BUG 5: Professor Detail Modal (/profesores -> "Ver Horario Completo >") Grafton Swiss Concrete Audit', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/profesores', { waitUntil: 'networkidle' });

    const profDetailBtn = page.locator('.prof-view-detail-btn').first();
    await expect(profDetailBtn).toBeVisible();
    await profDetailBtn.click();
    await page.waitForTimeout(300);

    const modal = page.locator('.prof-modal');
    await expect(modal).toBeVisible();
    await page.screenshot({ path: 'audit-screenshots/06e-modal-professor-detail.png' });

    const profModalAudit = await page.evaluate(() => {
      const m = document.querySelector('.prof-modal');
      const avatar = document.querySelector('.prof-modal .prof-modal-avatar');
      const kpis = Array.from(document.querySelectorAll('.prof-modal .modal-kpi-card'));
      const timetable = document.querySelector('.prof-modal .prof-timetable-container');
      const dayCols = Array.from(document.querySelectorAll('.prof-modal .prof-timetable-day-column'));
      const hourLines = Array.from(document.querySelectorAll('.prof-modal .prof-grid-hour-line'));
      const sessionBlock = document.querySelector('.prof-modal .prof-session-block');

      return {
        modalBg: m ? getComputedStyle(m).backgroundColor : null,
        modalRadius: m ? getComputedStyle(m).borderRadius : null,
        avatarBg: avatar ? getComputedStyle(avatar).backgroundColor : null,
        avatarRadius: avatar ? getComputedStyle(avatar).borderRadius : null,
        kpisCount: kpis.length,
        kpisBgOk: kpis.every(k => getComputedStyle(k).backgroundColor === 'rgb(220, 217, 210)'),
        timetableBg: timetable ? getComputedStyle(timetable).backgroundColor : null,
        dayColsCount: dayCols.length,
        dayColsVerticalBordersOk: dayCols.every(
          c => parseFloat(getComputedStyle(c).borderRightWidth || '0') >= 1
        ),
        hourLinesBordersOk: hourLines.every(
          h => parseFloat(getComputedStyle(h).borderBottomWidth || '0') >= 1
        ),
        sessionBlockBg: sessionBlock ? getComputedStyle(sessionBlock).backgroundColor : null,
        sessionBlockRadius: sessionBlock ? getComputedStyle(sessionBlock).borderRadius : null,
      };
    });

    expect(profModalAudit.modalBg).toBe('rgb(242, 240, 236)'); // #F2F0EC
    expect(profModalAudit.modalRadius).toBe('0px');
    expect(profModalAudit.avatarBg).toBe('rgb(220, 217, 210)'); // #DCD9D2
    expect(profModalAudit.avatarRadius).toBe('0px');
    expect(profModalAudit.kpisCount).toBe(4);
    expect(profModalAudit.kpisBgOk).toBe(true);
    expect(profModalAudit.timetableBg).toBe('rgb(242, 240, 236)'); // #F2F0EC
    expect(profModalAudit.dayColsCount).toBeGreaterThanOrEqual(1);
    expect(profModalAudit.dayColsVerticalBordersOk).toBe(true);
    expect(profModalAudit.hourLinesBordersOk).toBe(true);
    expect(profModalAudit.sessionBlockBg).toBe('rgb(224, 235, 245)'); // #E0EBF5
    expect(profModalAudit.sessionBlockRadius).toBe('0px');

    await assertZeroDarkContainersOrUnreadableText(page, '.prof-modal');
  });

  test('LEVEL-2 NESTED MODAL: Solicitud de Asistencia como Visitante / Oyente (Pedir Permiso) Grafton Swiss Audit', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/cursos', { waitUntil: 'networkidle' });

    // Switch to Catálogo Ofertado 2026-2 tab
    const catalogBtn = page.getByRole('button', { name: /Catálogo Ofertado 2026-2/i }).first();
    await expect(catalogBtn).toBeVisible();
    await catalogBtn.click();
    await page.waitForTimeout(300);

    // Open Level-1 Course Modal
    const detailBtn = page.locator('.course-view-detail-btn').first();
    await expect(detailBtn).toBeVisible();
    await detailBtn.click();
    await page.waitForTimeout(300);

    const courseModal = page.locator('.course-modal-dialog');
    await expect(courseModal).toBeVisible();

    // Click "Pedir Permiso" button to open Level-2 Visitor Email Modal
    const pedirPermisoBtn = page.locator('button:has-text("Pedir Permiso")').first();
    await expect(pedirPermisoBtn).toBeVisible();
    await pedirPermisoBtn.click();
    await page.waitForTimeout(400);

    const visitorModal = page.locator('.visitor-modal-dialog');
    await expect(visitorModal).toBeVisible();

    // Capture screenshot
    await page.screenshot({ path: 'audit-screenshots/modal-oyente-pedir-permiso.png' });

    // Evaluate styles and contents inside Level-2 modal
    const auditResult = await page.evaluate(() => {
      const dialog = document.querySelector('.visitor-modal-dialog');
      if (!dialog) return { found: false };

      const parseRgb = (str: string): [number, number, number] => {
        const m = str.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
        if (!m) return [0, 0, 0];
        return [Number(m[1]), Number(m[2]), Number(m[3])];
      };

      const relLuminance = ([r, g, b]: [number, number, number]) => {
        const toLinear = (c: number) => {
          const s = c / 255;
          return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
        };
        return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
      };

      const emailPreview = document.querySelector('.visitor-email-preview-container');
      const emailHeader = document.querySelector('.email-preview-header');
      const emailBody = document.querySelector('.email-preview-body');
      const emailText = document.querySelector('.email-body-text');
      const profCard = document.querySelector('.visitor-prof-card');
      const profAvatar = document.querySelector('.visitor-prof-avatar');
      const adviceBanner = document.querySelector('.visitor-advice-alert');
      const iconBadge = document.querySelector('.visitor-modal-icon-badge');
      const codeBadge = document.querySelector('.visitor-course-code-badge');
      const copyBtn = document.querySelector('.visitor-copy-btn');
      const sendBtn = document.querySelector('.visitor-send-btn');
      const selectTrigger = document.querySelector('.visitor-meta-section .custom-select-trigger');

      // Check all elements for 0px border radius
      const allElements = [dialog, ...Array.from(dialog.querySelectorAll('*'))];
      const nonZeroRadiusEls: string[] = [];
      for (const el of allElements) {
        const rect = el.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) continue;
        const r = getComputedStyle(el).borderRadius;
        if (r && r !== '0px') {
          nonZeroRadiusEls.push(`${el.tagName.toLowerCase()}.${el.className} (r=${r})`);
        }
      }

      // Check email body background & text luminance
      const bodyBg = emailBody ? getComputedStyle(emailBody).backgroundColor : '';
      const textCol = emailText ? getComputedStyle(emailText).color : '';
      const bodyBgLum = relLuminance(parseRgb(bodyBg));
      const textColLum = relLuminance(parseRgb(textCol));

      return {
        found: true,
        dialogBg: getComputedStyle(dialog).backgroundColor,
        dialogRadius: getComputedStyle(dialog).borderRadius,
        nonZeroRadiusEls,
        bodyBg,
        bodyBgLum,
        textCol,
        textColLum,
        emailHeaderBg: emailHeader ? getComputedStyle(emailHeader).backgroundColor : '',
        profCardBg: profCard ? getComputedStyle(profCard).backgroundColor : '',
        profAvatarWidth: profAvatar ? getComputedStyle(profAvatar).width : '',
        profAvatarHeight: profAvatar ? getComputedStyle(profAvatar).height : '',
        adviceBannerBg: adviceBanner ? getComputedStyle(adviceBanner).backgroundColor : '',
        iconBadgeWidth: iconBadge ? getComputedStyle(iconBadge).width : '',
        iconBadgeHeight: iconBadge ? getComputedStyle(iconBadge).height : '',
        codeBadgeBg: codeBadge ? getComputedStyle(codeBadge).backgroundColor : '',
        copyBtnRadius: copyBtn ? getComputedStyle(copyBtn).borderRadius : '',
        sendBtnRadius: sendBtn ? getComputedStyle(sendBtn).borderRadius : '',
        triggerText: selectTrigger ? selectTrigger.textContent || '' : '',
      };
    });

    expect(auditResult.found).toBe(true);
    // All elements strictly 0px
    expect(auditResult.nonZeroRadiusEls).toEqual([]);
    expect(auditResult.dialogRadius).toBe('0px');

    // Email body has light paper background (lum > 0.85) and dark text (lum < 0.20)
    expect(auditResult.bodyBgLum).toBeGreaterThan(0.85);
    expect(auditResult.textColLum).toBeLessThan(0.2);

    // Section dropdown trigger text contains separator before Sección
    if (auditResult.triggerText.includes('Sección')) {
      expect(auditResult.triggerText).toMatch(/(^Sección|·\s*Sección|\s+Sección)/);
      expect(auditResult.triggerText).not.toMatch(/[a-zA-ZáéíóúÁÉÍÓÚ]Sección/); // Never glued without space/separator
    }

    // Modal Header and Badges
    expect(auditResult.profAvatarWidth).toBe('36px');
    expect(auditResult.profAvatarHeight).toBe('36px');
    expect(auditResult.iconBadgeWidth).toBe('36px');
    expect(auditResult.iconBadgeHeight).toBe('36px');
    expect(auditResult.copyBtnRadius).toBe('0px');
    expect(auditResult.sendBtnRadius).toBe('0px');
  });
});

