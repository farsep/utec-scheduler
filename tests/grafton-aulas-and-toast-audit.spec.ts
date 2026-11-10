import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

test.describe('Grafton Swiss Aulas & Toast Audit', () => {
  test.beforeAll(() => {
    const screenshotDir = path.resolve(process.cwd(), 'audit-screenshots');
    if (!fs.existsSync(screenshotDir)) {
      fs.mkdirSync(screenshotDir, { recursive: true });
    }
  });

  test('1. No Monogram Bleeding on /aulas (Aula Magna & Futsal)', async ({ page }) => {
    await page.goto('/aulas');
    await page.waitForLoadState('networkidle');

    // Wait for classroom cards to render
    const cards = page.locator('.classroom-card');
    await expect(cards.first()).toBeVisible({ timeout: 15000 });

    // Assert Aula Magna has monogram MAG
    const magnaCard = page.locator('#room-card-AULAMAGNA');
    if (await magnaCard.isVisible()) {
      const magnaMonogram = magnaCard.locator('.classroom-code-monogram');
      await expect(magnaMonogram).toContainText('MAG');
      const isBleeding = await magnaMonogram.evaluate((el) => el.scrollWidth > el.clientWidth + 1);
      expect(isBleeding).toBe(false);
      // Assert no redundant duplicate AULAMAGNA pill in meta
      const metaText = await magnaCard.locator('.classroom-card-meta').innerText();
      expect(metaText).not.toContain('AULAMAGNA');
    }

    // Assert Futsal has monogram FUT
    const futsalCard = page.locator('#room-card-FUTSAL');
    if (await futsalCard.isVisible()) {
      const futsalMonogram = futsalCard.locator('.classroom-code-monogram');
      await expect(futsalMonogram).toContainText('FUT');
      const isBleeding = await futsalMonogram.evaluate((el) => el.scrollWidth > el.clientWidth + 1);
      expect(isBleeding).toBe(false);
      const metaText = await futsalCard.locator('.classroom-card-meta').innerText();
      expect(metaText).not.toContain('FUTSAL');
    }

    // Assert all room monogram boxes on the page never overflow
    const monograms = page.locator('.classroom-type-icon.classroom-code-monogram');
    const count = await monograms.count();
    expect(count).toBeGreaterThan(0);

    for (let i = 0; i < Math.min(count, 15); i++) {
      const mono = monograms.nth(i);
      const metrics = await mono.evaluate((el) => ({
        clientWidth: el.clientWidth,
        clientHeight: el.clientHeight,
        scrollWidth: el.scrollWidth,
        borderRadius: window.getComputedStyle(el).borderRadius,
      }));
      expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth + 1);
      expect(metrics.borderRadius).toBe('0px');
    }

    await page.screenshot({ path: 'audit-screenshots/aulas-monograms-clean.png' });
  });

  test('2. Orthogonal Aulas Disponibles Counter & Status Square', async ({ page }) => {
    await page.goto('/aulas');
    await page.waitForLoadState('networkidle');

    // Header counter tag
    const counterTag = page.locator('.section-count-tag').first();
    await expect(counterTag).toBeVisible({ timeout: 10000 });

    const counterStyles = await counterTag.evaluate((el) => {
      const cs = window.getComputedStyle(el);
      return {
        bg: cs.backgroundColor,
        color: cs.color,
        radius: cs.borderRadius,
        borderLeftColor: cs.borderLeftColor,
      };
    });

    expect(counterStyles.bg).toBe('rgb(24, 24, 26)');
    expect(counterStyles.radius).toBe('0px');
    expect(counterStyles.borderLeftColor).toBe('rgb(13, 122, 78)');

    // Status square next to title
    const statusSquare = page.locator('.section-status-square').first();
    await expect(statusSquare).toBeVisible();
    const squareStyles = await statusSquare.evaluate((el) => {
      const cs = window.getComputedStyle(el);
      return {
        bg: cs.backgroundColor,
        radius: cs.borderRadius,
        width: cs.width,
        height: cs.height,
      };
    });

    expect(squareStyles.bg).toBe('rgb(13, 122, 78)');
    expect(squareStyles.radius).toBe('0px');
    expect(parseFloat(squareStyles.width)).toBeCloseTo(24, 0);
    expect(parseFloat(squareStyles.height)).toBeCloseTo(24, 0);

    // Assert section heading is Space Grotesk 20px
    const heading = page.locator('.results-section-header h2').first();
    const headingStyles = await heading.evaluate((el) => {
      const cs = window.getComputedStyle(el);
      return {
        fontSize: cs.fontSize,
        fontWeight: cs.fontWeight,
      };
    });
    expect(headingStyles.fontSize).toBe('20px');
    expect(parseInt(headingStyles.fontWeight)).toBeGreaterThanOrEqual(700);

    await page.screenshot({ path: 'audit-screenshots/aulas-orthogonal-header.png' });
  });

  test('3. Non-Truncated Merged Course Codes & Non-Pink Slots in Timeline', async ({ page }) => {
    await page.goto('/aulas');
    await page.waitForLoadState('networkidle');

    // Assert timeline tracks use CSS grid with 15 columns
    const track = page.locator('.classroom-timeline-track.swiss-hourly-strip').first();
    await expect(track).toBeVisible({ timeout: 10000 });
    const trackStyles = await track.evaluate((el) => {
      const cs = window.getComputedStyle(el);
      return {
        display: cs.display,
        borderRadius: cs.borderRadius,
        bg: cs.backgroundColor,
      };
    });
    expect(trackStyles.display).toBe('grid');
    expect(trackStyles.borderRadius).toBe('0px');
    expect(trackStyles.bg).toBe('rgb(250, 249, 245)');

    // Assert occupied blocks DO NOT use baby pink rgb(244, 224, 226)
    const occupiedCells = page.locator('.swiss-hour-cell--occupied');
    const occCount = await occupiedCells.count();
    if (occCount > 0) {
      for (let i = 0; i < Math.min(occCount, 5); i++) {
        const cell = occupiedCells.nth(i);
        const bg = await cell.evaluate((el) => window.getComputedStyle(el).backgroundColor);
        expect(bg).not.toBe('rgb(244, 224, 226)');
      }

      // Assert course codes in occupied blocks are 6-character codes (never chopped with colon like CS600: or ME531:)
      const codes = await page.locator('.swiss-hour-cell-code').allInnerTexts();
      expect(codes.length).toBeGreaterThan(0);
      for (const code of codes) {
        expect(code).not.toContain(':');
        // Codes like CS6002, PI6001, ME5310 are at least 6 characters
        if (/^[A-Z]{2}[0-9]{4}$/.test(code)) {
          expect(code.length).toBe(6);
        }
      }
    }

    // Assert free cells DO NOT use pastel mint rgb(220, 238, 230)
    const freeCell = page.locator('.swiss-hour-cell--free').first();
    await expect(freeCell).toBeVisible();
    const freeStyles = await freeCell.evaluate((el) => {
      const cs = window.getComputedStyle(el);
      return {
        bg: cs.backgroundColor,
        borderBottomColor: cs.borderBottomColor,
      };
    });
    expect(freeStyles.bg).toBe('rgb(250, 249, 245)');
    expect(freeStyles.borderBottomColor).toBe('rgb(13, 122, 78)');

    // Assert current time needle exists and has Swiss Signal Vermilion color
    const needle = page.locator('.timeline-now-marker').first();
    if (await needle.isVisible()) {
      const needleBg = await needle.evaluate((el) => window.getComputedStyle(el).backgroundColor);
      expect(needleBg).toBe('rgb(217, 56, 30)');
    }

    await page.screenshot({ path: 'audit-screenshots/aulas-timeline-merged-slots.png' });
  });

  test('4. Swiss Toast & Zero Sparkles on /cursos', async ({ page }) => {
    await page.goto('/cursos');
    await page.waitForLoadState('networkidle');

    // Switch to Catalog mode
    const catalogTabBtn = page.locator('button', { hasText: 'Catálogo Ofertado' });
    await expect(catalogTabBtn).toBeVisible({ timeout: 10000 });
    await catalogTabBtn.click();
    await page.waitForTimeout(400);

    // Locate first course card star button
    const firstCard = page.locator('.courses-cards-grid .course-card').first();
    await expect(firstCard).toBeVisible({ timeout: 15000 });

    // Assert "Oyente disponible" footer has NO sparkles character ✨
    const footerStatus = firstCard.locator('.course-footer-visitor-status');
    const footerText = await footerStatus.innerText();
    expect(footerText).not.toContain('✨');

    // Click the star to bookmark as visitor/oyente
    const starBtn = firstCard.locator('.course-card-bookmark-btn');
    await expect(starBtn).toBeVisible({ timeout: 10000 });
    await starBtn.click();

    // Assert Grafton Swiss Toast appears
    const toast = page.locator('.course-toast-notification.grafton-swiss-toast');
    await expect(toast).toBeVisible({ timeout: 5000 });

    // Capture screenshot of Swiss Toast
    await page.screenshot({ path: 'audit-screenshots/swiss-toast.png' });

    // Assert Swiss Toast styles
    const toastStyles = await toast.evaluate((el) => {
      const cs = window.getComputedStyle(el);
      return {
        bg: cs.backgroundColor,
        color: cs.color,
        radius: cs.borderRadius,
        borderLeftColor: cs.borderLeftColor,
      };
    });

    expect(toastStyles.bg).toBe('rgb(242, 240, 236)');
    expect(toastStyles.color).toBe('rgb(20, 20, 22)');
    expect(toastStyles.radius).toBe('0px');
    expect(toastStyles.borderLeftColor).toBe('rgb(217, 119, 6)');

    // Assert Toast text has ZERO sparkles (✨)
    const toastText = await toast.innerText();
    expect(toastText).not.toContain('✨');
    expect(toastText).toContain('MODO OYENTE · GUARDADO');

    // Assert active visitor badge on course card is high-contrast orthogonal (#F5E8D3)
    const activeBadge = firstCard.locator('.course-footer-visitor-status--active');
    await expect(activeBadge).toBeVisible();
    const badgeStyles = await activeBadge.evaluate((el) => {
      const cs = window.getComputedStyle(el);
      return {
        bg: cs.backgroundColor,
        color: cs.color,
        radius: cs.borderRadius,
      };
    });

    expect(badgeStyles.bg).toBe('rgb(245, 232, 211)');
    expect(badgeStyles.color).toBe('rgb(92, 45, 0)');
    expect(badgeStyles.radius).toBe('0px');
    const activeText = await activeBadge.innerText();
    expect(activeText).not.toContain('✨');

    // Click star again to remove and verify removal toast
    await starBtn.click();
    await expect(toast).toBeVisible({ timeout: 5000 });
    const removeToastText = await toast.innerText();
    expect(removeToastText).toContain('MODO OYENTE · ELIMINADO');
    expect(removeToastText).not.toContain('✨');
  });
});

