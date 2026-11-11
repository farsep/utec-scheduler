const pw = require('/home/charmcast/.cache/ms-playwright-go/1.50.1/package');
const fs = require('fs');
const path = require('path');

const BASE_URL = process.env.BASE_URL || 'http://localhost:4325';

async function run() {
  const screenshotsDir = path.join(__dirname, '../audit-screenshots');
  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
  }

  console.log('Launching Chromium from cache...');
  const browser = await pw.chromium.launch({
    headless: true,
    executablePath: '/home/charmcast/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome'
  });

  try {
    // ----------------------------------------------------
    // TEST 1: Mobile (iPhone 17 393x852)
    // ----------------------------------------------------
    console.log('\n--- TEST 1: Mobile (iPhone 17: 393x852) ---');
    const mobilePage = await browser.newPage({ viewport: { width: 393, height: 852 } });
    await mobilePage.goto(`${BASE_URL}/aulas`);
    await mobilePage.waitForSelector('.live-time-controller', { timeout: 10000 });

    const card = mobilePage.locator('.live-time-controller');
    const title = card.locator('.live-time-title');
    const chip = card.locator('.live-time-chip');
    console.log('Card title visible:', await title.isVisible());
    console.log('Chip visible:', await chip.isVisible());

    const desktopBadge = card.locator('.live-time-desktop-badge');
    console.log('Desktop badge hidden on mobile:', !(await desktopBadge.isVisible()));

    const prevBtn = card.locator('.grafton-step-btn--prev');
    const nextBtn = card.locator('.grafton-step-btn--next');
    const timeBtn = card.locator('.live-time-stepper-btn');

    const prevBox = await prevBtn.boundingBox();
    const nextBox = await nextBtn.boundingBox();
    const timeBox = await timeBtn.boundingBox();

    console.log('[iPhone 17] -15m Button:', prevBox);
    console.log('[iPhone 17] Center Time Button:', timeBox);
    console.log('[iPhone 17] +15m Button:', nextBox);

    if (!prevBox || !nextBox || !timeBox) throw new Error('Buttons not found or bounding box null');

    if (Math.abs(prevBox.width - nextBox.width) > 1) {
      throw new Error(`Asymmetry detected: prev width ${prevBox.width} != next width ${nextBox.width}`);
    }

    const leftGap = timeBox.x - (prevBox.x + prevBox.width);
    const rightGap = nextBox.x - (timeBox.x + timeBox.width);
    console.log(`[iPhone 17] Symmetrical Gaps: Left = ${leftGap}px, Right = ${rightGap}px`);
    if (Math.abs(leftGap - rightGap) > 2) {
      throw new Error(`Asymmetrical gaps around center time button: leftGap ${leftGap}, rightGap ${rightGap}`);
    }

    await mobilePage.screenshot({ path: path.join(screenshotsDir, 'redesign-live-time-mobile.png') });
    console.log('Saved redesign-live-time-mobile.png');

    // Click timeBtn to verify popover opens centered without overflow
    await timeBtn.click();
    await mobilePage.waitForSelector('.grafton-time-picker-popover', { state: 'visible', timeout: 5000 });
    const popover = mobilePage.locator('.grafton-time-picker-popover').first();
    const popoverBox = await popover.boundingBox();
    console.log('[iPhone 17] Popover Bounding Box:', popoverBox);

    if (popoverBox.x < 0 || popoverBox.x + popoverBox.width > 393) {
      throw new Error(`Popover overflows mobile viewport: x=${popoverBox.x}, w=${popoverBox.width}`);
    }
    await mobilePage.screenshot({ path: path.join(screenshotsDir, 'redesign-live-time-mobile-popover.png') });
    console.log('Saved redesign-live-time-mobile-popover.png');
    await mobilePage.close();

    // ----------------------------------------------------
    // TEST 2: Tablet (iPad 768x1024)
    // ----------------------------------------------------
    console.log('\n--- TEST 2: Tablet (iPad: 768x1024) ---');
    const tabletPage = await browser.newPage({ viewport: { width: 768, height: 1024 } });
    await tabletPage.goto(`${BASE_URL}/aulas`);
    await tabletPage.waitForSelector('.live-time-controller', { timeout: 10000 });

    const tabletCard = tabletPage.locator('.live-time-controller');
    const tPrevBtn = tabletCard.locator('.grafton-step-btn--prev');
    const tNextBtn = tabletCard.locator('.grafton-step-btn--next');
    const tTimeBtn = tabletCard.locator('.live-time-stepper-btn');

    const tPrevBox = await tPrevBtn.boundingBox();
    const tNextBox = await tNextBtn.boundingBox();
    const tTimeBox = await tTimeBtn.boundingBox();

    console.log('[iPad] -15m Button:', tPrevBox);
    console.log('[iPad] Center Time Button:', tTimeBox);
    console.log('[iPad] +15m Button:', tNextBox);

    const tGap = tNextBox.x - (tTimeBox.x + tTimeBox.width);
    console.log(`[iPad] Stepper gap to +15m: ${tGap}px (tightly grouped, NOT stranded)`);
    if (tGap > 30) {
      throw new Error(`Tablet stepper is not tightly grouped: gap is ${tGap}px`);
    }

    await tabletPage.screenshot({ path: path.join(screenshotsDir, 'redesign-live-time-tablet.png') });
    console.log('Saved redesign-live-time-tablet.png');
    await tabletPage.close();

    // ----------------------------------------------------
    // TEST 3: Desktop (1280x800) - "A:" Button Left-Aligned Popover (Foto 3)
    // ----------------------------------------------------
    console.log('\n--- TEST 3: Desktop (1280x800) - "Buscar por Horario" Left-Aligned Popover ---');
    const desktopPage = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    await desktopPage.goto(`${BASE_URL}/aulas`);
    await desktopPage.waitForSelector('.mode-toggle-btn', { timeout: 10000 });

    // Switch to "Buscar por Horario"
    const customTimeBtn = desktopPage.locator('.mode-toggle-btn').filter({ hasText: 'Buscar por Horario' });
    await customTimeBtn.click();
    await desktopPage.waitForSelector('.time-inputs-container', { timeout: 5000 });

    // Click "A:" button
    const aBtn = desktopPage.locator('.time-inputs-container .grafton-time-trigger-btn').last();
    await aBtn.click();
    await desktopPage.waitForSelector('.grafton-time-picker-popover', { state: 'visible', timeout: 5000 });

    const aPopover = desktopPage.locator('.grafton-time-picker-popover').first();
    const aBtnBox = await aBtn.boundingBox();
    const aPopoverBox = await aPopover.boundingBox();

    console.log('[Desktop] A: Button Box:', aBtnBox);
    console.log('[Desktop] Popover Box:', aPopoverBox);

    const alignmentDiff = Math.abs(aPopoverBox.x - aBtnBox.x);
    console.log(`[Desktop] Left alignment diff: ${alignmentDiff}px (Foto 3 requirement: aligned to left edge of button)`);
    if (alignmentDiff > 2) {
      throw new Error(`Desktop "A:" popover is not left-aligned to button: diff is ${alignmentDiff}px`);
    }

    await desktopPage.screenshot({ path: path.join(screenshotsDir, 'redesign-desktop-a-picker-aligned-left.png') });
    console.log('Saved redesign-desktop-a-picker-aligned-left.png');
    await desktopPage.close();

    console.log('\n ALL 3 AUDIT TESTS PASSED WITH 100% SUCCESS!');
  } finally {
    await browser.close();
  }
}

run().catch((err) => {
  console.error('\n AUDIT FAILED:', err);
  process.exit(1);
});

