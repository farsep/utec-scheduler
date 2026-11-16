/**
 * MatrícuLAB 2.0 — Exhaustive 8-Minute Interactive Tour & Gesture Recorder
 *
 * Records comprehensive ~480s (8m00s) high-FPS H.264 MP4 walkthrough videos
 * for Mobile (412x915), Tablet (800x1280), and Desktop (1440x900),
 * testing EVERY route, menu, drawer, modal, sub-modal, tab, filter, dropdown
 * (CustomSelect), time picker (GlassTimePicker / CustomTimePicker), slider,
 * paint grid, swipe, pinch-to-zoom, bottom-sheet drag-to-dismiss, drag-and-drop,
 * keyboard shortcuts, Command Palette (Cmd+K), deep links, and legal pages.
 *
 * Usage:
 *   node tests/record-full-8min-tours.cjs --device=mobile  --port=4351
 *   node tests/record-full-8min-tours.cjs --device=tablet  --port=4352
 *   node tests/record-full-8min-tours.cjs --device=desktop --port=4353
 */

const fs = require('fs');
const path = require('path');
const http = require('http');
const { execFileSync } = require('child_process');

const PLAYWRIGHT_PATH = '/home/charmcast/.npm/_npx/420ff84f11983ee5/node_modules/playwright';
const { chromium } = require(PLAYWRIGHT_PATH);

const CHROMIUM_EXECUTABLE = '/home/charmcast/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome';
const ROOT_DIR = path.resolve(__dirname, '..');
const DIST_DIR = path.join(ROOT_DIR, 'dist');
const SAMPLE_XLSX_PATH = path.join(ROOT_DIR, 'public', 'samples', 'Consulta_Horario.xlsx');
const TOUR_VIDEOS_DIR = path.join(ROOT_DIR, 'tour-videos');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.wasm': 'application/wasm',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.pdf': 'application/pdf',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

const DEVICE_CONFIGS = {
  mobile: {
    id: 'mobile',
    outName: '01-mobile-9min-full-tour.mp4',
    defaultPort: 4351,
    hudLabel: 'MOBILE · 412×915 · TOUCH GESTURES',
    scaleSize: '540:1200',
    contextOptions: {
      viewport: { width: 412, height: 915 },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
      recordVideoSize: { width: 412, height: 915 },
    },
  },
  tablet: {
    id: 'tablet',
    outName: '02-tablet-9min-full-tour.mp4',
    defaultPort: 4352,
    hudLabel: 'TABLET · 800×1280 · TOUCH + HYBRIDS',
    contextOptions: {
      viewport: { width: 800, height: 1280 },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
      recordVideoSize: { width: 800, height: 1280 },
    },
  },
  desktop: {
    id: 'desktop',
    outName: '03-desktop-9min-full-tour.mp4',
    defaultPort: 4353,
    hudLabel: 'DESKTOP · 1440×900 · MOUSE + KEYBOARD',
    contextOptions: {
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 1,
      isMobile: false,
      hasTouch: false,
      recordVideoSize: { width: 1440, height: 900 },
    },
  },
};

function parseArgs() {
  const args = process.argv.slice(2);
  let device = 'desktop';
  let port = null;
  let durationSec = 540;
  for (const a of args) {
    if (a.startsWith('--device=')) device = a.split('=')[1];
    else if (a.startsWith('--port=')) port = Number(a.split('=')[1]);
    else if (a.startsWith('--duration=')) durationSec = Number(a.split('=')[1]);
  }
  const cfg = DEVICE_CONFIGS[device];
  if (!cfg) {
    throw new Error(`Invalid --device=${device}. Use mobile | tablet | desktop`);
  }
  return {
    cfg,
    port: port || cfg.defaultPort,
    durationSec: Number.isFinite(durationSec) && durationSec > 10 ? durationSec : 540,
  };
}

function startStaticServer(port) {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      try {
        const cleanUrl = (req.url || '/').split('?')[0].split('#')[0];
        let rel = decodeURIComponent(cleanUrl).replace(/^\/+/, '');
        let target = path.join(DIST_DIR, rel);

        if (!target.startsWith(DIST_DIR)) {
          res.writeHead(403);
          res.end('Forbidden');
          return;
        }

        if (fs.existsSync(target) && fs.statSync(target).isDirectory()) {
          target = path.join(target, 'index.html');
        } else if (!fs.existsSync(target)) {
          const withIndex = path.join(DIST_DIR, rel, 'index.html');
          const withHtml = `${target}.html`;
          if (fs.existsSync(withIndex)) target = withIndex;
          else if (fs.existsSync(withHtml)) target = withHtml;
          else target = path.join(DIST_DIR, 'index.html');
        }

        const ext = path.extname(target).toLowerCase();
        res.writeHead(200, {
          'Content-Type': MIME_TYPES[ext] || 'application/octet-stream',
          'Cache-Control': 'no-cache',
        });
        fs.createReadStream(target).pipe(res);
      } catch (err) {
        res.writeHead(500);
        res.end(String(err));
      }
    });
    server.on('error', reject);
    server.listen(port, '127.0.0.1', () => resolve(server));
  });
}

// ============================================================================
// HUD & VISUAL GESTURE OVERLAY INJECTED ACROSS EVERY DOCUMENT NAVIGATION
// ============================================================================
function buildInitOverlayScript({ hudLabel, isTouchDevice, targetDurationSec }) {
  return `
  (() => {
    const HUD_LABEL = ${JSON.stringify(hudLabel)};
    const IS_TOUCH = ${JSON.stringify(isTouchDevice)};
    const TARGET_SEC = ${JSON.stringify(targetDurationSec)};

    if (!window.__TOUR_STATE__) {
      let savedStart = Number(sessionStorage.getItem('__tour_start_ts') || 0);
      if (!savedStart) {
        savedStart = Date.now();
        sessionStorage.setItem('__tour_start_ts', String(savedStart));
      }
      let savedMeta = null;
      try {
        savedMeta = JSON.parse(sessionStorage.getItem('__tour_hud_meta') || 'null');
      } catch {}
      window.__TOUR_STATE__ = {
        startTs: savedStart,
        chapter: (savedMeta && savedMeta.chapter) || '01/09 · INICIALIZANDO',
        action: (savedMeta && savedMeta.action) || 'Cargando MatricuLAB...',
        badge: (savedMeta && savedMeta.badge) || (IS_TOUCH ? 'TOUCH' : 'MOUSE'),
      };
    }

    const fmtTime = (sec) => {
      const s = Math.max(0, Math.floor(sec));
      const mm = String(Math.floor(s / 60)).padStart(2, '0');
      const ss = String(s % 60).padStart(2, '0');
      return mm + ':' + ss;
    };

    const ensureOverlay = () => {
      if (!document.body) return null;
      let root = document.getElementById('tour-fx-root');
      if (root) return root;

      const style = document.createElement('style');
      style.id = 'tour-fx-style';
      style.textContent = \`
        #tour-fx-root {
          position: fixed;
          inset: 0;
          pointer-events: none;
          z-index: 2147483647;
          overflow: hidden;
          font-family: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace;
        }
        #tour-hud-bar {
          position: fixed;
          right: \${IS_TOUCH ? '8px' : '14px'};
          left: \${IS_TOUCH ? '8px' : 'auto'};
          bottom: \${IS_TOUCH ? '72px' : '14px'};
          max-width: \${IS_TOUCH ? 'none' : '510px'};
          background: rgba(15, 23, 42, 0.84);
          backdrop-filter: blur(18px) saturate(180%);
          -webkit-backdrop-filter: blur(18px) saturate(180%);
          color: #F8FAFC;
          border: 1px solid rgba(255, 255, 255, 0.22);
          border-left: 3.5px solid #38BDF8;
          border-radius: 12px;
          padding: \${IS_TOUCH ? '6px 10px' : '8px 13px'};
          display: flex;
          flex-direction: column;
          gap: 3px;
          box-shadow: 0 10px 28px -6px rgba(15, 23, 42, 0.38), inset 0 1px 0 rgba(255, 255, 255, 0.16);
          pointer-events: none;
        }
        .tour-hud-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          font-size: \${IS_TOUCH ? '9px' : '10px'};
          font-weight: 700;
          letter-spacing: 0.04em;
        }
        .tour-hud-device { color: #38BDF8; text-transform: uppercase; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .tour-hud-clock { color: #FBBF24; font-variant-numeric: tabular-nums; white-space: nowrap; }
        .tour-hud-main {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: \${IS_TOUCH ? '9.5px' : '11px'};
          line-height: 1.25;
        }
        .tour-hud-badge {
          background: rgba(0, 119, 158, 0.85);
          color: #FFFFFF;
          padding: 1px 6px;
          border-radius: 5px;
          font-size: 9px;
          font-weight: 700;
          flex-shrink: 0;
          border: 1px solid rgba(255, 255, 255, 0.28);
        }
        .tour-hud-action {
          color: #F2F0EC;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          font-weight: 600;
        }
        #tour-mouse-cursor {
          position: fixed;
          width: 22px;
          height: 22px;
          margin-left: -3px;
          margin-top: -2px;
          pointer-events: none;
          opacity: 0;
          transition: transform 0.06s linear, opacity 0.15s ease;
          filter: drop-shadow(1px 2px 2px rgba(0,0,0,0.45));
        }
        .tour-tap-ring {
          position: fixed;
          width: 44px;
          height: 44px;
          margin-left: -22px;
          margin-top: -22px;
          border: 3px solid #00779E;
          background: rgba(0, 119, 158, 0.20);
          border-radius: 50%;
          animation: tourTapRipple 0.55s ease-out forwards;
          pointer-events: none;
        }
        .tour-tap-ring::after {
          content: '';
          position: absolute;
          left: 50%;
          top: 50%;
          width: 10px;
          height: 10px;
          margin: -5px 0 0 -5px;
          background: #B8332A;
          border-radius: 50%;
        }
        @keyframes tourTapRipple {
          0% { transform: scale(0.45); opacity: 1; }
          65% { transform: scale(1.18); opacity: 0.9; }
          100% { transform: scale(1.55); opacity: 0; }
        }
        #tour-key-toast {
          position: fixed;
          left: 50%;
          top: \${IS_TOUCH ? '68px' : '64px'};
          transform: translateX(-50%);
          background: rgba(15, 23, 42, 0.88);
          backdrop-filter: blur(14px) saturate(180%);
          -webkit-backdrop-filter: blur(14px) saturate(180%);
          color: #F8FAFC;
          border: 1px solid rgba(255, 255, 255, 0.25);
          border-radius: 9px;
          padding: 5px 13px;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.06em;
          box-shadow: 0 8px 24px -4px rgba(0, 119, 158, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.2);
          opacity: 0;
          transition: opacity 0.14s ease;
          pointer-events: none;
        }
      \`;
      document.head.appendChild(style);

      root = document.createElement('div');
      root.id = 'tour-fx-root';
      root.innerHTML = \`
        <svg id="tour-vector-svg" style="position:fixed;inset:0;width:100%;height:100%;pointer-events:none;">
          <defs>
            <marker id="tour-arrow" markerWidth="8" markerHeight="8" refX="6" refY="3.5" orient="auto">
              <polygon points="0 0, 7 3.5, 0 7" fill="#B8332A" />
            </marker>
          </defs>
        </svg>
        <div id="tour-key-toast"></div>
        <div id="tour-mouse-cursor">
          <svg width="22" height="22" viewBox="0 0 24 24">
            <polygon points="2,2 2,20 7.5,14.8 11.8,22 14.4,20.5 10.2,13.5 18,13.5" fill="#18181A" stroke="#F2F0EC" stroke-width="1.8"/>
          </svg>
        </div>
        <div id="tour-hud-bar">
          <div class="tour-hud-top">
            <span class="tour-hud-device" id="tour-hud-device">\${HUD_LABEL}</span>
            <span class="tour-hud-clock" id="tour-hud-clock">00:00 / \${fmtTime(TARGET_SEC)}</span>
          </div>
          <div class="tour-hud-main">
            <span class="tour-hud-badge" id="tour-hud-badge">READY</span>
            <span class="tour-hud-action" id="tour-hud-action">Iniciando recorrido...</span>
          </div>
        </div>
      \`;
      document.body.appendChild(root);

      const syncText = () => {
        const st = window.__TOUR_STATE__;
        const clk = document.getElementById('tour-hud-clock');
        const bdg = document.getElementById('tour-hud-badge');
        const act = document.getElementById('tour-hud-action');
        if (clk) clk.textContent = fmtTime((Date.now() - st.startTs) / 1000) + ' / ' + fmtTime(TARGET_SEC);
        if (bdg) bdg.textContent = st.badge || 'ACT';
        if (act) act.textContent = st.chapter + ' — ' + st.action;
      };
      syncText();
      if (!window.__TOUR_CLK_INT__) {
        window.__TOUR_CLK_INT__ = window.setInterval(syncText, 400);
      }
      return root;
    };

    window.__TOUR_API__ = {
      setHUD(chapter, action, badge) {
        const st = window.__TOUR_STATE__;
        if (chapter) st.chapter = chapter;
        if (action) st.action = action;
        if (badge) st.badge = badge;
        try {
          sessionStorage.setItem('__tour_hud_meta', JSON.stringify({ chapter: st.chapter, action: st.action, badge: st.badge }));
        } catch {}
        ensureOverlay();
        const bdg = document.getElementById('tour-hud-badge');
        const act = document.getElementById('tour-hud-action');
        if (bdg) bdg.textContent = st.badge;
        if (act) act.textContent = st.chapter + ' — ' + st.action;
      },
      moveCursor(x, y, show = true) {
        ensureOverlay();
        const cur = document.getElementById('tour-mouse-cursor');
        if (!cur) return;
        cur.style.opacity = show ? '1' : '0';
        cur.style.transform = 'translate3d(' + Math.round(x) + 'px,' + Math.round(y) + 'px,0)';
      },
      pulseTap(x, y, color = '#00779E') {
        const root = ensureOverlay();
        if (!root) return;
        const ring = document.createElement('div');
        ring.className = 'tour-tap-ring';
        ring.style.left = x + 'px';
        ring.style.top = y + 'px';
        ring.style.borderColor = color;
        root.appendChild(ring);
        setTimeout(() => ring.remove(), 580);
      },
      flashKey(text) {
        ensureOverlay();
        const el = document.getElementById('tour-key-toast');
        if (!el) return;
        el.textContent = '[ ' + text + ' ]';
        el.style.opacity = '1';
        clearTimeout(window.__TOUR_KEY_TIMER__);
        window.__TOUR_KEY_TIMER__ = setTimeout(() => {
          const k = document.getElementById('tour-key-toast');
          if (k) k.style.opacity = '0';
        }, 950);
      },
      drawVector(x1, y1, x2, y2, label) {
        ensureOverlay();
        const svg = document.getElementById('tour-vector-svg');
        if (!svg) return () => {};
        svg.innerHTML = \`
          <defs>
            <marker id="tour-arrow" markerWidth="8" markerHeight="8" refX="6" refY="3.5" orient="auto">
              <polygon points="0 0, 7 3.5, 0 7" fill="#B8332A" />
            </marker>
          </defs>
          <circle cx="\${x1}" cy="\${y1}" r="18" fill="rgba(0,119,158,0.22)" stroke="#00779E" stroke-width="2.5"/>
          <line x1="\${x1}" y1="\${y1}" x2="\${x2}" y2="\${y2}" stroke="#B8332A" stroke-width="3" stroke-dasharray="7 4" marker-end="url(#tour-arrow)"/>
          <rect x="\${(x1 + x2) / 2 - 52}" y="\${(y1 + y2) / 2 - 11}" width="104" height="20" fill="#18181A" stroke="#F2F0EC" stroke-width="1"/>
          <text x="\${(x1 + x2) / 2}" y="\${(y1 + y2) / 2 + 3}" fill="#F2F0EC" font-size="10" font-weight="700" text-anchor="middle" font-family="JetBrains Mono, monospace">\${label || 'GESTURE'}</text>
        \`;
        return () => {
          const s = document.getElementById('tour-vector-svg');
          if (s) s.innerHTML = '';
        };
      },
      drawPinch(cx, cy, spreadStart, spreadEnd, progress, label) {
        ensureOverlay();
        const svg = document.getElementById('tour-vector-svg');
        if (!svg) return;
        const d = spreadStart + (spreadEnd - spreadStart) * progress;
        const x1 = cx - d, y1 = cy - d * 0.45;
        const x2 = cx + d, y2 = cy + d * 0.45;
        svg.innerHTML = \`
          <line x1="\${x1}" y1="\${y1}" x2="\${x2}" y2="\${y2}" stroke="#18181A" stroke-width="2" stroke-dasharray="4 3"/>
          <circle cx="\${x1}" cy="\${y1}" r="20" fill="rgba(0,119,158,0.24)" stroke="#00779E" stroke-width="3"/>
          <circle cx="\${x2}" cy="\${y2}" r="20" fill="rgba(184,93,0,0.24)" stroke="#B85D00" stroke-width="3"/>
          <rect x="\${cx - 60}" y="\${cy - d * 0.45 - 32}" width="120" height="20" fill="#18181A"/>
          <text x="\${cx}" y="\${cy - d * 0.45 - 18}" fill="#38BDF8" font-size="10" font-weight="800" text-anchor="middle" font-family="JetBrains Mono, monospace">\${label}</text>
        \`;
      },
      clearVectors() {
        const s = document.getElementById('tour-vector-svg');
        if (s) s.innerHTML = '';
      },
    };

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', ensureOverlay);
    } else {
      ensureOverlay();
    }
  })();
  `;
}

// ============================================================================
// INTERACTION & GESTURE PRIMITIVES
// ============================================================================
class TourDriver {
  constructor(page, cfg, targetDurationSec) {
    this.page = page;
    this.cfg = cfg;
    this.isTouch = Boolean(cfg.contextOptions.hasTouch);
    this.targetDurationSec = targetDurationSec;
    this.scale = targetDurationSec / 540;
    this.startTs = Date.now();
    this.lastX = cfg.contextOptions.viewport.width * 0.5;
    this.lastY = cfg.contextOptions.viewport.height * 0.45;
    this.stats = { actions: 0, swipes: 0, drags: 0, modals: 0, keystrokes: 0, notes: [] };
  }

  elapsedSec() {
    return (Date.now() - this.startTs) / 1000;
  }

  /** Natural calibrated hold (keeps total action sequence comfortably within 540s across touch & desktop) */
  hold(msFull) {
    const touchBoost = this.isTouch && this.scale >= 0.5 ? 1.25 : 1;
    const cap = this.isTouch && this.scale >= 0.5 ? 1.30 : 0.96;
    const mult = Math.max(0.14, Math.min(cap, this.scale * touchBoost));
    const ms = Math.max(65, Math.round(msFull * mult));
    return this.page.waitForTimeout(ms);
  }

  async wait(ms) {
    await this.page.waitForTimeout(ms);
  }

  async hud(chapter, action, badge = null) {
    const b = badge || (this.isTouch ? 'TOUCH' : 'MOUSE');
    await this.page
      .evaluate(
        ({ c, a, b2, ts }) => {
          if (window.__TOUR_STATE__) window.__TOUR_STATE__.startTs = ts;
          window.__TOUR_API__?.setHUD(c, a, b2);
        },
        { c: chapter, a: action, b2: b, ts: this.startTs }
      )
      .catch(() => {});
  }

  async tryStep(name, fn) {
    const tStart = this.elapsedSec().toFixed(1);
    try {
      await fn();
      console.log(`[${this.cfg.id} @ ${tStart}s->${this.elapsedSec().toFixed(1)}s] ✓ ${name}`);
    } catch (err) {
      const msg = (err && err.message ? err.message : String(err)).split('\n')[0].slice(0, 140);
      this.stats.notes.push(`${name}: ${msg}`);
      console.log(`[${this.cfg.id} @ ${tStart}s] ~ fallback (${name}): ${msg}`);
    }
  }

  async ensureModalsClosed() {
    await this.page.keyboard.press('Escape').catch(() => {});
    await this.wait(100);
    await this.page.keyboard.press('Escape').catch(() => {});
    await this.wait(100);
  }

  async movePointer(x, y, steps = 8) {
    if (this.isTouch) return;
    const sx = this.lastX;
    const sy = this.lastY;
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const cx = sx + (x - sx) * t;
      const cy = sy + (y - sy) * t;
      await this.page.mouse.move(cx, cy).catch(() => {});
      await this.page.evaluate(([px, py]) => window.__TOUR_API__?.moveCursor(px, py, true), [cx, cy]).catch(() => {});
      await this.wait(10);
    }
    this.lastX = x;
    this.lastY = y;
  }

  async tapOrClick(locator, label, pauseAfterFull = 460) {
    const el = locator.first();
    await el.scrollIntoViewIfNeeded({ timeout: 3000 }).catch(() => {});
    const box = await el.boundingBox({ timeout: 2500 }).catch(() => null);
    if (!box || box.width < 1 || box.height < 1) {
      throw new Error(`Invisible/missing element for ${label}`);
    }
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    await this.movePointer(cx, cy, 8);
    await this.page
      .evaluate(([px, py, c]) => window.__TOUR_API__?.pulseTap(px, py, c), [cx, cy, this.isTouch ? '#00779E' : '#B8332A'])
      .catch(() => {});
    await el.click({ timeout: 4000 });
    this.stats.actions++;
    await this.hold(pauseAfterFull);
  }

  async hoverElement(locator, pauseFull = 600) {
    const el = locator.first();
    await el.scrollIntoViewIfNeeded({ timeout: 2500 }).catch(() => {});
    const box = await el.boundingBox({ timeout: 2500 }).catch(() => null);
    if (!box) return;
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    if (this.isTouch) {
      await el.dispatchEvent('mouseenter').catch(() => {});
    } else {
      await this.movePointer(cx, cy, 10);
      await el.hover({ timeout: 2500 }).catch(() => {});
    }
    await this.hold(pauseFull);
  }

  async typeHuman(locator, text, pauseAfterFull = 420) {
    const el = locator.first();
    await this.tapOrClick(el, `input ${text}`, 120);
    await el.fill('');
    await el.type(text, { delay: Math.max(18, Math.round(52 * Math.max(0.25, Math.min(0.95, this.scale)))) });
    this.stats.keystrokes += text.length;
    await this.hold(pauseAfterFull);
  }

  async pressKey(key, displayLabel = null, pauseAfterFull = 500) {
    await this.page.evaluate(lbl => window.__TOUR_API__?.flashKey(lbl), displayLabel || key.toUpperCase()).catch(() => {});
    await this.page.keyboard.press(key);
    this.stats.keystrokes++;
    await this.hold(pauseAfterFull);
  }

  async swipeOrDragXY(x1, y1, x2, y2, durationMs = 540, mode = null, label = 'SWIPE') {
    const useMode = mode || (this.isTouch ? 'touch' : 'mouse');
    await this.page.evaluate(([a, b, c, d, lbl]) => window.__TOUR_API__?.drawVector(a, b, c, d, lbl), [x1, y1, x2, y2, label]).catch(() => {});

    if (useMode === 'mouse') {
      await this.movePointer(x1, y1, 8);
      await this.page.mouse.down();
      const steps = Math.max(12, Math.round(durationMs / 18));
      for (let i = 1; i <= steps; i++) {
        const t = i / steps;
        const ease = 1 - Math.pow(1 - t, 2);
        const cx = x1 + (x2 - x1) * ease;
        const cy = y1 + (y2 - y1) * ease;
        await this.page.mouse.move(cx, cy);
        await this.page.evaluate(([px, py]) => window.__TOUR_API__?.moveCursor(px, py, true), [cx, cy]).catch(() => {});
        await this.wait(Math.round(durationMs / steps));
      }
      await this.page.mouse.up();
      this.stats.drags++;
    } else {
      await this.page.evaluate(
        ({ sx, sy, ex, ey, dur }) => {
          return new Promise(resolve => {
            const target = document.elementFromPoint(sx, sy) || document.body;
            const makeTouch = (x, y, tTarget) =>
              new Touch({
                identifier: 99,
                target: tTarget,
                clientX: x,
                clientY: y,
                pageX: x + window.scrollX,
                pageY: y + window.scrollY,
                radiusX: 16,
                radiusY: 16,
                force: 0.9,
              });

            const t0 = makeTouch(sx, sy, target);
            target.dispatchEvent(
              new TouchEvent('touchstart', {
                bubbles: true,
                cancelable: true,
                composed: true,
                touches: [t0],
                targetTouches: [t0],
                changedTouches: [t0],
              })
            );

            const steps = Math.max(14, Math.round(dur / 18));
            let step = 0;
            const iv = setInterval(() => {
              step++;
              const ratio = step / steps;
              const cx = sx + (ex - sx) * ratio;
              const cy = sy + (ey - sy) * ratio;
              const tm = makeTouch(cx, cy, target);
              target.dispatchEvent(
                new TouchEvent('touchmove', {
                  bubbles: true,
                  cancelable: true,
                  composed: true,
                  touches: [tm],
                  targetTouches: [tm],
                  changedTouches: [tm],
                })
              );
              if (step >= steps) {
                clearInterval(iv);
                const te = makeTouch(ex, ey, target);
                target.dispatchEvent(
                  new TouchEvent('touchend', {
                    bubbles: true,
                    cancelable: true,
                    composed: true,
                    touches: [],
                    targetTouches: [],
                    changedTouches: [te],
                  })
                );
                resolve();
              }
            }, Math.max(12, Math.floor(dur / steps)));
          });
        },
        { sx: x1, sy: y1, ex: x2, ey: y2, dur: durationMs }
      );
      this.stats.swipes++;
    }

    await this.wait(160);
    await this.page.evaluate(() => window.__TOUR_API__?.clearVectors()).catch(() => {});
  }

  async simulatePinchZoom(selector, zoomOutFirst = false, label = 'PINCH ZOOM') {
    const loc = this.page.locator(selector).first();
    await loc.scrollIntoViewIfNeeded({ timeout: 2000 }).catch(() => {});
    const box = await loc.boundingBox().catch(() => null);
    if (!box) return;
    const vp = this.cfg.contextOptions.viewport;
    const cx = Math.max(90, Math.min(vp.width - 90, box.x + box.width * 0.5));
    const safeTop = Math.max(130, box.y + 40);
    const safeBot = Math.min(vp.height - 200, box.y + box.height - 40);
    const cy = Math.max(130, Math.min(vp.height - 200, (safeTop + Math.max(safeTop, safeBot)) * 0.5));
    const s1 = zoomOutFirst ? 85 : 30;
    const s2 = zoomOutFirst ? 28 : 95;

    for (let i = 0; i <= 10; i++) {
      await this.page
        .evaluate(
          ([x, y, a, b, p, l]) => window.__TOUR_API__?.drawPinch(x, y, a, b, p, l),
          [cx, cy, s1, s2, i / 10, label]
        )
        .catch(() => {});
      await this.wait(28);
    }

    if (this.isTouch) {
      await this.page
        .evaluate(
          ({ x, y, a, b }) => {
            const target = document.elementFromPoint(x, y) || document.body;
            const mk = (id, px, py) =>
              new Touch({ identifier: id, target, clientX: px, clientY: py, pageX: px, pageY: py });
            const t1a = mk(1, x - a, y - a * 0.4);
            const t2a = mk(2, x + a, y + a * 0.4);
            target.dispatchEvent(new TouchEvent('touchstart', { bubbles: true, cancelable: true, touches: [t1a, t2a], targetTouches: [t1a, t2a], changedTouches: [t1a, t2a] }));
            const t1b = mk(1, x - b, y - b * 0.4);
            const t2b = mk(2, x + b, y + b * 0.4);
            target.dispatchEvent(new TouchEvent('touchmove', { bubbles: true, cancelable: true, touches: [t1b, t2b], targetTouches: [t1b, t2b], changedTouches: [t1b, t2b] }));
            target.dispatchEvent(new TouchEvent('touchend', { bubbles: true, cancelable: true, touches: [], targetTouches: [], changedTouches: [t1b, t2b] }));
          },
          { x: cx, y: cy, a: s1, b: s2 }
        )
        .catch(() => {});
    } else {
      await this.movePointer(cx, cy, 6);
      await this.page.keyboard.down('Control');
      await this.page.mouse.wheel(0, zoomOutFirst ? 260 : -260);
      await this.page.keyboard.up('Control');
    }
    await this.hold(380);
    await this.page.evaluate(() => window.__TOUR_API__?.clearVectors()).catch(() => {});
  }

  async findSafeSwipePoint() {
    const vp = this.cfg.contextOptions.viewport;
    return await this.page.evaluate(({ w, h }) => {
      const candidatesY = [h * 0.48, h * 0.62, h * 0.36, h * 0.72];
      for (const cy of candidatesY) {
        for (const cx of [w * 0.78, w * 0.52, w * 0.25]) {
          const el = document.elementFromPoint(cx, cy);
          if (
            el &&
            !el.closest('button, a, input, select, textarea, .overflow-x-auto, [data-no-page-swipe], .course-card-swipe-container, .grafton-mobile-dock')
          ) {
            return { y: cy, w };
          }
        }
      }
      return { y: h * 0.5, w };
    }, { w: vp.width, h: vp.height });
  }

  async smoothScrollWindow(deltaY, durationMs = 700) {
    const steps = Math.max(8, Math.round(durationMs / 45));
    const per = deltaY / steps;
    for (let i = 0; i < steps; i++) {
      await this.page.evaluate(d => window.scrollBy({ top: d, behavior: 'instant' }), per).catch(() => {});
      await this.wait(Math.round(durationMs / steps));
    }
  }

  async dismissSheetIfMobile(handleSelector, fallbackCloseSelector, label = 'Cerrar modal') {
    if (this.cfg.contextOptions.viewport.width < 768) {
      const handle = this.page.locator(handleSelector).first();
      const box = await handle.boundingBox().catch(() => null);
      if (box) {
        await this.swipeOrDragXY(
          box.x + box.width / 2,
          box.y + Math.min(10, box.height / 2),
          box.x + box.width / 2,
          box.y + 300,
          520,
          'touch',
          'SHEET DISMISS'
        );
        await this.wait(300);
      }
    }
    const closeBtn = this.page.locator(fallbackCloseSelector).first();
    if (await closeBtn.isVisible({ timeout: 350 }).catch(() => false)) {
      await this.tapOrClick(closeBtn, label, 320);
    }
  }

  async paceUntil(chapterTargetSec, activeContainerSelector = null) {
    let toggle = 1;
    while (this.elapsedSec() < chapterTargetSec) {
      const rem = chapterTargetSec - this.elapsedSec();
      if (rem <= 0.4) {
        await this.wait(Math.max(80, Math.round(rem * 1000)));
        break;
      }
      if (activeContainerSelector) {
        await this.page
          .evaluate(
            ({ sel, dir }) => {
              const el = document.querySelector(sel);
              if (el && el.scrollHeight > el.clientHeight + 20) {
                el.scrollBy({ top: dir * 180, behavior: 'smooth' });
              } else {
                window.scrollBy({ top: dir * 160, behavior: 'smooth' });
              }
            },
            { sel: activeContainerSelector, dir: toggle }
          )
          .catch(() => {});
      } else {
        await this.page.evaluate(dir => window.scrollBy({ top: dir * 180, behavior: 'smooth' }), toggle).catch(() => {});
      }
      toggle *= -1;
      await this.wait(Math.min(1300, Math.round(rem * 1000)));
    }
  }
}

// ============================================================================
// EXHAUSTIVE 9-CHAPTER CHOREOGRAPHY (540 SECONDS / 9 MINUTES PER DEVICE)
// ============================================================================
async function runFullDeviceTour(baseUrl, driver, totalTargetSec) {
  const { page, isTouch } = driver;
  const vp = driver.cfg.contextOptions.viewport;
  const T = sec => sec * (totalTargetSec / 540);

  // --------------------------------------------------------------------------
  // CHAPTER 1 (0 -> 78s): HORARIOS /, FICHA, SIDEBAR SUBSECCIONES, D&D & TABS
  // --------------------------------------------------------------------------
  await driver.hud('01/09 · HORARIOS', 'Cargando oferta UTEC 2026-2...', isTouch ? 'TOUCH' : 'MOUSE');
  await page.goto(`${baseUrl}/`, { waitUntil: 'networkidle' });
  await driver.hold(650);

  await driver.tryStep('Cargar Oferta UTEC 2026-2 + StudentBanner', async () => {
    const emptyBtn = page.locator('button:has-text("Cargar Oferta UTEC"), button:has-text("Cargar Ejemplo")').first();
    if (await emptyBtn.isVisible({ timeout: 2500 }).catch(() => false)) {
      await driver.tapOrClick(emptyBtn, 'Cargar Ejemplo', 800);
    }
    await page.waitForSelector('.timetable-grid-wrapper', { timeout: 10000 });

    // Mobile (<768px): Toggle compact student strip (▾ Ficha -> ▴ Ficha)
    const fichaBtn = page.locator('.student-mobile-summary-bar button:visible').first();
    if (await fichaBtn.isVisible().catch(() => false)) {
      await driver.tapOrClick(fichaBtn, 'Expandir Ficha Estudiante', 480);
      await driver.tapOrClick(fichaBtn, 'Contraer Ficha Estudiante', 340);
    }
  });

  const openDrawer = async () => {
    if (vp.width < 1024) {
      const btn = page.locator('#mobile-sidebar-btn').first();
      const openCount = await page.locator('#course-sidebar-drawer.is-mobile-open').count();
      if (!openCount && (await btn.isVisible().catch(() => false))) {
        await driver.tapOrClick(btn, 'Abrir Sidebar Cursos', 420);
      }
    }
  };
  const closeDrawer = async () => {
    if (vp.width < 1024) {
      const openCount = await page.locator('#course-sidebar-drawer.is-mobile-open').count();
      if (openCount > 0) {
        const closeBtn = page.locator('#course-sidebar-drawer .sidebar-mobile-close-btn').first();
        if (await closeBtn.isVisible({ timeout: 600 }).catch(() => false)) {
          await driver.tapOrClick(closeBtn, 'Cerrar Sidebar Cursos', 340);
        }
      }
    }
  };

  await driver.tryStep('Sidebar: Drawer, Expandir, Filtros, Subsecciones (CC1143/CC1103) & D&D', async () => {
    try {
      await openDrawer();
      const drawer = page.locator('#course-sidebar-drawer');
      const expandBtn = drawer.locator('.sidebar-expand-btn').first();
      if ((await expandBtn.isVisible().catch(() => false)) && (await expandBtn.isEnabled().catch(() => false))) {
        await driver.tapOrClick(expandBtn, 'Expandir todos los cursos', 440);
        await driver.tapOrClick(expandBtn, 'Colapsar todos los cursos', 400);
      }

      const pills = drawer.locator('.filter-pill-btn');
      const pCount = await pills.count();
      for (let i = 0; i < pCount; i++) {
        const p = pills.nth(i);
        if ((await p.isVisible().catch(() => false)) && (await p.isEnabled().catch(() => false))) {
          await driver.tapOrClick(p, `Filtro sidebar #${i + 1}`, 340);
        }
      }
      const activePills = drawer.locator('.filter-pill-btn.active');
      while ((await activePills.count()) > 0) {
        await driver.tapOrClick(activePills.first(), 'Restaurar pill sidebar', 240);
      }

      const searchInput = drawer.locator('.search-input').first();
      // Showcase 2-level hierarchy (CC1143), 1-main+7-labs (CC1103), and standard courses
      for (const code of ['CC1143', 'CC1103', 'HH2101', 'CS1111', 'AD2011', 'CS2023']) {
        await driver.typeHuman(searchInput, code, 420);
        const sectionsDrawer = drawer.locator('.course-sections-drawer').first();
        if (!(await sectionsDrawer.isVisible().catch(() => false))) {
          const cardHdr = drawer.locator('.course-card-header:visible').first();
          if (await cardHdr.isVisible().catch(() => false)) {
            await driver.tapOrClick(cardHdr, `Expandir ${code}`, 380);
          }
        }
        // Test course professor CustomSelect (.grafton-custom-select-trigger) inside expanded card
        const profSelect = drawer.locator('.course-prof-filter .grafton-custom-select-trigger:visible').first();
        if (await profSelect.isVisible().catch(() => false)) {
          await driver.tapOrClick(profSelect, `Dropdown docentes ${code}`, 320);
          const profOpt = drawer.locator('.course-prof-filter .grafton-custom-select-opt:visible').nth(1);
          if (await profOpt.isVisible().catch(() => false)) {
            await driver.tapOrClick(profOpt, 'Filtrar por docente', 320);
            await driver.tapOrClick(profSelect, 'Reabrir docentes', 240);
            await driver.tapOrClick(drawer.locator('.course-prof-filter .grafton-custom-select-opt:visible').first(), 'Todos docentes', 240);
          } else {
            await driver.pressKey('Escape', 'ESC', 180);
          }
        }
        // Ghost preview hover on Desktop & Subsection picking for CC1143/CC1103
        const secBox = drawer.locator('.main-section-box:visible').first();
        if (await secBox.isVisible().catch(() => false)) {
          await driver.hoverElement(secBox, 450);
        }
        const subCard = drawer.locator('.subsection-card .select-btn:not(.remove):visible').first();
        if (await subCard.isVisible().catch(() => false)) {
          await driver.tapOrClick(subCard, `Elegir subsección ${code}`, 420);
        } else {
          const chooseBtn = drawer.locator('.select-btn:not(.remove):visible').first();
          if (await chooseBtn.isVisible().catch(() => false)) {
            await driver.tapOrClick(chooseBtn, `Elegir ${code}`, 380);
          }
        }
        await searchInput.fill('');
        await driver.hold(180);
      }

      // Test collapsed Quick Section Strip (.quick-sec-btn) on CC1103
      await driver.typeHuman(searchInput, 'CC1103', 320);
      const qSec = drawer.locator('.quick-sec-btn:not(.is-active):visible').first();
      if (await qSec.isVisible().catch(() => false)) {
        await driver.tapOrClick(qSec, 'Quick Pill Subsección CC1103', 400);
      }
      await searchInput.fill('');

      // Drag & Drop section from sidebar onto TimetableGrid on Desktop
      if (!isTouch) {
        await driver.typeHuman(searchInput, 'AD1701', 380);
        const sectionsDrawer = drawer.locator('.course-sections-drawer').first();
        if (!(await sectionsDrawer.isVisible().catch(() => false))) {
          const hdr = drawer.locator('.course-card-header:visible').first();
          if (await hdr.isVisible().catch(() => false)) {
            await driver.tapOrClick(hdr, 'Expandir AD1701', 320);
          }
        }
        const draggableBox = drawer.locator('.main-section-box[draggable="true"]:visible').first();
        const dropTarget = page.locator('.timetable-grid-wrapper .day-column:visible').first();
        if ((await draggableBox.isVisible().catch(() => false)) && (await dropTarget.isVisible().catch(() => false))) {
          const b1 = await draggableBox.boundingBox();
          const b2 = await dropTarget.boundingBox();
          if (b1 && b2) {
            await driver.page.evaluate(
              ([x1, y1, x2, y2]) => window.__TOUR_API__?.drawVector(x1, y1, x2, y2, 'D&D SECTION'),
              [b1.x + b1.width / 2, b1.y + b1.height / 2, b2.x + b2.width / 2, b2.y + b2.height / 3]
            );
            await draggableBox.dragTo(dropTarget);
            driver.stats.drags++;
            await driver.hold(480);
            await driver.page.evaluate(() => window.__TOUR_API__?.clearVectors());
          }
        }
        await searchInput.fill('');
      }
    } finally {
      await closeDrawer();
    }
  });

  await driver.hud('01/09 · HORARIOS', 'Pestañas Multi-Horario: +Nueva, Duplicar, Reordenar, Restablecer & Vaciar', 'TABS+KB');
  await driver.tryStep('MultiScheduleTabs + Reorder + Delete + Keyboard J/K + Restablecer/Vaciar', async () => {
    const dupTabBtn = page.locator('[aria-label="Duplicar opción actual"]:visible').first();
    const addTabBtn = page.locator('[aria-label="Nueva opción de horario"]:visible').first();
    if (await dupTabBtn.isVisible().catch(() => false)) await driver.tapOrClick(dupTabBtn, 'Duplicar opción', 400);
    if (await addTabBtn.isVisible().catch(() => false)) await driver.tapOrClick(addTabBtn, 'Nueva opción', 400);

    const tabs = page.locator('.tab-wrapper[draggable="true"]:visible');
    if ((await tabs.count()) >= 2) {
      const t0 = await tabs.nth(0).boundingBox();
      const t1 = await tabs.nth(1).boundingBox();
      if (t0 && t1) {
        await driver.page.evaluate(
          ([x1, y1, x2, y2]) => window.__TOUR_API__?.drawVector(x1, y1, x2, y2, 'REORDER TAB'),
          [t0.x + t0.width / 2, t0.y + t0.height / 2, t1.x + t1.width / 2, t1.y + t1.height / 2]
        );
        await tabs.nth(0).dragTo(tabs.nth(1));
        driver.stats.drags++;
        await driver.hold(420);
        await driver.page.evaluate(() => window.__TOUR_API__?.clearVectors());
      }
    }

    // Delete newly created blank tab cleanly
    const delTabBtn = page.locator('[aria-label="Eliminar opción actual"]:visible').first();
    if (await delTabBtn.isVisible().catch(() => false)) {
      await driver.tapOrClick(delTabBtn, 'Eliminar opción extra', 380);
    }

    // Test Restablecer on Opción 2 then return to Opción 1
    const secondTab = page.locator('.tab-content-btn:visible').nth(1);
    if (await secondTab.isVisible().catch(() => false)) {
      await driver.tapOrClick(secondTab, 'Ir a Opción 2', 320);
      const resetOptBtn = page.locator('.timetable-actions button:has-text("Restablecer"):visible').first();
      if (await resetOptBtn.isVisible().catch(() => false)) {
        await driver.tapOrClick(resetOptBtn, 'Restablecer Opción', 380);
      }
    }

    const firstTab = page.locator('.tab-content-btn:visible').first();
    if (await firstTab.isVisible().catch(() => false)) await driver.tapOrClick(firstTab, 'Activar Opción 1', 350);
    await driver.pressKey('j', 'J → NEXT TAB', 380);
    await driver.pressKey('ArrowRight', '→ NEXT TAB', 380);
    await driver.pressKey('k', 'K ← PREV TAB', 380);
    await driver.pressKey('ArrowLeft', '← PREV TAB', 380);

    // Showcase Vaciar -> Empty Landing -> Cargar Ejemplo again cleanly
    const clearAllBtn = page.locator('.timetable-actions button:has-text("Vaciar"):visible').first();
    if (await clearAllBtn.isVisible().catch(() => false)) {
      await driver.tapOrClick(clearAllBtn, 'Vaciar Oferta (Empty State)', 600);
      const reloadSample = page.locator('button:has-text("Cargar Oferta UTEC"), button:has-text("Cargar Ejemplo")').first();
      if (await reloadSample.isVisible({ timeout: 2500 }).catch(() => false)) {
        await driver.tapOrClick(reloadSample, 'Recargar Ejemplo UTEC', 750);
      }
    }
  });

  await driver.hud('01/09 · HORARIOS', 'Grilla Semanal: Selector Días, Micro-Ticket Inspector & Day Zoom', isTouch ? 'TOUCH' : 'GRID');
  await driver.tryStep('TimetableGrid Segmented Controls + Touch Inspector', async () => {
    const segBtns = page.locator('.timetable-day-segment-btn:visible');
    const segCount = await segBtns.count();
    for (let i = 1; i < Math.min(segCount, 7); i++) {
      await driver.tapOrClick(segBtns.nth(i), `Día Grilla #${i}`, 320);
    }
    const resetWeek = page.locator('.timetable-reset-week-btn:visible, .timetable-day-segment-btn:has-text("Semana"):visible').first();
    if (await resetWeek.isVisible().catch(() => false)) {
      await driver.tapOrClick(resetWeek, 'Vista Semanal completa', 400);
    }

    const blocks = page.locator('.timetable-grid-wrapper .course-block:visible, .timetable-grid-wrapper .scheduled-block:visible');
    for (let i = 0; i < Math.min(await blocks.count(), 2); i++) {
      await driver.tapOrClick(blocks.nth(i), `Inspeccionar curso #${i + 1}`, 480);
    }
    const strip = page.locator('[data-testid="mobile-course-inspector-strip"]');
    if (await strip.isVisible().catch(() => false)) {
      await driver.hold(550);
      const closeStrip = strip.locator('[aria-label="Cerrar inspector de curso"]');
      if (await closeStrip.isVisible().catch(() => false)) {
        await driver.tapOrClick(closeStrip, 'Cerrar inspector', 300);
      }
    }
    if (isTouch) {
      await driver.simulatePinchZoom('.timetable-scroll-container', false, 'PINCH DAY ZOOM');
      const dayColHeader = page.locator('.day-col-header:visible').first();
      if (await dayColHeader.isVisible().catch(() => false)) {
        await dayColHeader.dblclick().catch(() => {});
        await driver.hold(520);
        const resetBtn = page.locator('.timetable-reset-week-btn:visible').first();
        if (await resetBtn.isVisible().catch(() => false)) {
          await driver.tapOrClick(resetBtn, 'Salir Day Zoom', 350);
        }
      }
    }
  });

  await driver.paceUntil(T(78));

  // --------------------------------------------------------------------------
  // CHAPTER 2 (78 -> 170s): QUANTUM ENGINE OPTIMIZER & TIME BLOCKER PAINTING
  // --------------------------------------------------------------------------
  await driver.hud('02/09 · OPTIMIZER', 'Auto-Generador QuantumEngine: Tipo, Pin, Slider, Pickers, Bloqueos & Preview', 'QUANTUM');
  await driver.tryStep('ScheduleOptimizerModal: Config, Pickers, Bloqueos, Solver & Preview', async () => {
    const genOpenBtn = page.locator('.timetable-actions button:has-text("Auto-Generar"):visible').first();
    await driver.tapOrClick(genOpenBtn, 'Abrir Auto-Generar', 540);
    const dlg = page.locator('.optimizer-modal-card:visible').first();
    await dlg.waitFor({ state: 'visible', timeout: 6000 });
    driver.stats.modals++;

    try {
      const advSwitch = dlg.locator('text="Armador de Semestre (Modo Avanzado)"').first();
      if (await advSwitch.isVisible().catch(() => false)) {
        await driver.tapOrClick(advSwitch, 'Modo Avanzado ON', 440);

        const slider = dlg.locator('input[type="range"]').first();
        if (await slider.isVisible().catch(() => false)) {
          const sBox = await slider.boundingBox();
          if (sBox) {
            await driver.swipeOrDragXY(
              sBox.x + sBox.width * 0.35,
              sBox.y + sBox.height / 2,
              sBox.x + sBox.width * 0.80,
              sBox.y + sBox.height / 2,
              520,
              isTouch ? 'touch' : 'mouse',
              'MAX CURSOS'
            );
            await slider.fill('4').catch(() => {});
          }
        }

        // GlassTimePicker Hora Inicio & Hora Fin inside Optimizer
        const gtpBtns = dlg.locator('button:has-text("AM"), button:has-text("PM")');
        if ((await gtpBtns.count()) >= 1 && (await gtpBtns.first().isVisible().catch(() => false))) {
          await driver.tapOrClick(gtpBtns.first(), 'GlassTimePicker Hora Inicio', 400);
          const pickOpt = dlg.locator('button:has-text("08:00 AM")').first();
          if (await pickOpt.isVisible().catch(() => false)) {
            await driver.tapOrClick(pickOpt, 'Seleccionar 08:00 AM', 340);
          }
          await driver.tapOrClick(gtpBtns.first(), 'Reabrir Hora Inicio', 300);
          const pick07 = dlg.locator('button:has-text("07:00 AM"):visible').last();
          if (await pick07.isVisible().catch(() => false)) {
            await driver.tapOrClick(pick07, 'Restaurar 07:00 AM', 300);
          } else {
            await driver.pressKey('Escape', 'ESC', 180);
          }
        }
        if ((await gtpBtns.count()) >= 2 && (await gtpBtns.nth(1).isVisible().catch(() => false))) {
          await driver.tapOrClick(gtpBtns.nth(1), 'GlassTimePicker Hora Fin', 380);
          const pick21 = dlg.locator('button:has-text("09:00 PM"):visible').last();
          if (await pick21.isVisible().catch(() => false)) {
            await driver.tapOrClick(pick21, 'Hasta 09:00 PM', 320);
          } else {
            await driver.pressKey('Escape', 'ESC', 180);
          }
        }

        // Guarantee Lunch Range + Duration CustomSelect
        const lunchRow = dlg.locator('text="Garantizar Hora de Almuerzo"').first();
        if (await lunchRow.isVisible().catch(() => false)) {
          await driver.tapOrClick(lunchRow, 'Garantizar Almuerzo', 420);
          const lunchDur = dlg.locator('[aria-label="Duración mínima de almuerzo"]').first();
          if (await lunchDur.isVisible().catch(() => false)) {
            await driver.tapOrClick(lunchDur, 'Duración almuerzo', 320);
            const durOpt = dlg.locator('.custom-select-option:has-text("1 hora"):visible').first();
            if (await durOpt.isVisible().catch(() => false)) await driver.tapOrClick(durOpt, '1 hora', 320);
          }
          await driver.tapOrClick(lunchRow, 'Desactivar Almuerzo', 280);
        }
      }

      // Time Blocker Grid toggle, Strict/Flexible switch & Paint/Resize/Erase
      const blockerToggle = dlg.locator('[data-testid="toggle-blocker-grid"]').first();
      if (await blockerToggle.isVisible().catch(() => false)) {
        await driver.tapOrClick(blockerToggle, 'Toggle Calendario Bloqueos', 420);
        const strictLabel = dlg.locator('text="Modo Estricto:"').first();
        if (await strictLabel.isVisible().catch(() => false)) {
          const strictToggle = strictLabel.locator('..').locator('div').last();
          if (await strictToggle.isVisible().catch(() => false)) {
            await driver.tapOrClick(strictToggle, 'Alternar Modo Estricto/Flexible', 320);
            await driver.tapOrClick(strictToggle, 'Restaurar Modo Estricto', 280);
          }
        }
        const painter = dlg.locator('.time-blocker-grid').first();
        if (await painter.isVisible().catch(() => false)) {
          const pBox = await painter.boundingBox();
          if (pBox) {
            const colW = (pBox.width - 50) / 6;
            await driver.swipeOrDragXY(
              pBox.x + 58 + colW * 0.45,
              pBox.y + pBox.height * 0.25,
              pBox.x + 58 + colW * 0.45,
              pBox.y + pBox.height * 0.48,
              520,
              isTouch ? 'touch' : 'mouse',
              'PAINT BLOCK 1'
            );
            await driver.swipeOrDragXY(
              pBox.x + 58 + colW * 2.45,
              pBox.y + pBox.height * 0.40,
              pBox.x + 58 + colW * 2.45,
              pBox.y + pBox.height * 0.58,
              480,
              isTouch ? 'touch' : 'mouse',
              'PAINT BLOCK 2'
            );
            const resizeH = dlg.locator('.tbg-resize-handle').first();
            const rBox = await resizeH.boundingBox().catch(() => null);
            if (rBox) {
              await driver.swipeOrDragXY(rBox.x + rBox.width / 2, rBox.y + rBox.height / 2, rBox.x + rBox.width / 2, rBox.y - 26, 420, 'mouse', 'RESIZE BLOCK');
            }
            const bodies = dlg.locator('.tbg-block-body');
            while ((await bodies.count()) > 0) {
              await driver.tapOrClick(bodies.last(), 'Limpiar bloqueo', 260);
            }
          }
        }
      }

      const optSearch = dlg.locator('input[placeholder*="Buscar curso"]').first();
      if (await optSearch.isVisible().catch(() => false)) {
        await driver.typeHuman(optSearch, 'CS', 340);
        await optSearch.fill('');
        await driver.hold(180);
      }

      // Segmented filter: Todos / Obligatorio / Electivo (when available)
      for (const tLabel of ['Obligatorio', 'Electivo', 'Todos']) {
        const typeTab = dlg.locator(`div:text-is("${tLabel}"):visible`).first();
        if (await typeTab.isVisible().catch(() => false)) {
          await driver.tapOrClick(typeTab, `Filtro Pool ${tLabel}`, 280);
        }
      }

      // Toggle Pin button on a course + unpin cleanly
      const pinBtn = dlg.locator('[title*="Fijar curso"]:visible').first();
      if (await pinBtn.isVisible().catch(() => false)) {
        await driver.tapOrClick(pinBtn, 'Fijar curso obligatorio', 340);
        const unpinBtn = dlg.locator('[title*="Desfijar curso"]:visible').first();
        if (await unpinBtn.isVisible().catch(() => false)) {
          await driver.tapOrClick(unpinBtn, 'Desfijar curso', 260);
        }
      }

      const prefPills = dlg.locator('.pref-pill');
      for (let i = 0; i < Math.min(await prefPills.count(), 4); i++) {
        await driver.tapOrClick(prefPills.nth(i), `Preferencia #${i + 1}`, 260);
      }

      const vacCheck = dlg.locator('text="Solo secciones con vacantes disponibles"').first();
      if (await vacCheck.isVisible().catch(() => false)) {
        await driver.tapOrClick(vacCheck, 'Vacantes', 260);
        await driver.tapOrClick(vacCheck, 'Todas secciones', 260);
      }

      for (const d of ['Sab', 'Vie']) {
        const dBtn = dlg.locator(`button:has-text("${d}")`).first();
        if (await dBtn.isVisible().catch(() => false)) await driver.tapOrClick(dBtn, `Día libre ${d}`, 260);
      }
      const vieBtn = dlg.locator('button:has-text("Vie")').first();
      if (await vieBtn.isVisible().catch(() => false)) await driver.tapOrClick(vieBtn, 'Rehabilitar Viernes', 240);

      // Keep Modo Avanzado (4 of 6 compatible courses) -> fast QuantumEngine 18..50 solutions
      const clearOptBtn = dlg.locator('button:has-text("Limpiar")').first();
      if (await clearOptBtn.isVisible().catch(() => false)) {
        await driver.tapOrClick(clearOptBtn, 'Limpiar selección Optimizer', 260);
      }
      const totalOptItems = await dlg.locator('.optimizer-course-item:visible').count();
      for (let i = 0; i < Math.min(6, totalOptItems); i++) {
        const item = dlg.locator('.optimizer-course-item:visible').nth(i);
        const cls = await item.getAttribute('class');
        if (!cls || !cls.includes('selected')) {
          await driver.tapOrClick(item, `Pool Opt #${i + 1}`, 200);
        }
      }
      const advSlider = dlg.locator('input[type="range"]').first();
      if (await advSlider.isVisible().catch(() => false)) {
        await advSlider.fill('4').catch(() => {});
      }
      await driver.wait(350);

      const runBtn = dlg.locator('.optimizer-generate-btn').first();
      await driver.tapOrClick(runBtn, 'Generar Horarios (QuantumEngine)', 1100);
      await dlg.locator('.optimizer-card-zone-c .btn-preview').first().waitFor({ state: 'visible', timeout: 15000 }).catch(() => {});
      await driver.hold(800);

      const previewBtn = dlg.locator('.optimizer-card-zone-c .btn-preview').first();
      if (await previewBtn.isVisible().catch(() => false)) {
        await driver.tapOrClick(previewBtn, 'Abrir Vista Previa #1', 650);
        for (const [k, lbl] of [['ArrowRight', '→ #2'], ['j', 'J → #3'], ['ArrowRight', '→ #4'], ['j', 'J → #5'], ['k', 'K ← #4'], ['ArrowLeft', '← #3']]) {
          await driver.pressKey(k, lbl, 540);
        }
        const backResBtn = dlg.locator('button:has-text("Volver a resultados"):visible').first();
        if (await backResBtn.isVisible().catch(() => false)) {
          await driver.tapOrClick(backResBtn, 'Volver a resultados', 440);
        }
      }

      const newTabBtn = dlg.locator('.optimizer-card-zone-c .btn-new-tab:visible').first();
      if (await newTabBtn.isVisible().catch(() => false)) {
        await driver.tapOrClick(newTabBtn, '+ Nueva Pestaña', 620);
      }
      const applyBtn = dlg.locator('.optimizer-card-zone-c .btn-apply:visible').first();
      if (await applyBtn.isVisible().catch(() => false)) {
        await driver.tapOrClick(applyBtn, '✓ Aplicar solución óptima', 620);
      }
    } finally {
      if (await dlg.isVisible().catch(() => false)) {
        await driver.dismissSheetIfMobile('.optimizer-modal-card .grafton-modal-drag-handle', '.optimizer-modal-card .close-btn', 'Cerrar Optimizer');
        await driver.ensureModalsClosed();
      }
    }
  });

  await driver.paceUntil(T(170), '.timetable-scroll-container');

  // --------------------------------------------------------------------------
  // CHAPTER 3 (170 -> 208s): EXPORTAR, GOOGLE CALENDAR & FILE UPLOAD MODAL
  // --------------------------------------------------------------------------
  await driver.hud('03/09 · EXPORT+IO', 'ExportModal (.ICS / VALARM / Colores / PNG / CSV), GCal Intents & Importar', 'MODALS');
  await driver.tryStep('ExportModal + Colores + VALARM + GoogleCalendarModal + Intents', async () => {
    const expBtn = page.locator('.grafton-export-btn:visible').first();
    await driver.tapOrClick(expBtn, 'Abrir Exportar', 540);
    const dlg = page.locator('.modal-card:visible').first();
    await dlg.waitFor({ state: 'visible', timeout: 5000 });
    driver.stats.modals++;

    try {
      const colorBtns = dlg.locator('.export-color-grid button');
      if ((await colorBtns.count()) >= 2) {
        await driver.tapOrClick(colorBtns.nth(1), 'Un color por curso (.ics)', 380);
        await driver.tapOrClick(colorBtns.nth(0), 'Por categoría/prefijo', 340);
      }
      const alarmBtns = dlg.locator('.alarm-segmented-bar button');
      const aCount = await alarmBtns.count();
      for (let i = 0; i < aCount; i++) {
        await driver.tapOrClick(alarmBtns.nth(i), `VALARM #${i + 1}`, 320);
      }
      const exportCards = dlg.locator('.export-card');
      for (let i = 2; i < Math.min(await exportCards.count(), 4); i++) {
        await driver.hoverElement(exportCards.nth(i), 420);
      }

      const gcalCard = dlg.locator('.export-card:has-text("Google Calendar")').first();
      if (await gcalCard.isVisible().catch(() => false)) {
        await driver.tapOrClick(gcalCard, 'Abrir GoogleCalendarModal', 620);
        const gcalColorBtns = page.locator('.grafton-gcal-mode-btn:visible');
        if ((await gcalColorBtns.count()) >= 2) {
          await driver.tapOrClick(gcalColorBtns.nth(1), 'GCal color por curso', 360);
          await driver.tapOrClick(gcalColorBtns.nth(0), 'GCal color por categoría', 320);
        }
        const gcalAlarmBtns = page.locator('[aria-label="Tiempo de recordatorio en Google Calendar"] button:visible');
        if ((await gcalAlarmBtns.count()) >= 4) {
          await driver.tapOrClick(gcalAlarmBtns.nth(3), 'Recordatorio 30 min', 300);
          await driver.tapOrClick(gcalAlarmBtns.nth(2), 'Recordatorio 15 min', 280);
        }
        const webIntentsBtn = page.locator('button:has-text("agregar clases individualmente"):visible').first();
        if (await webIntentsBtn.isVisible().catch(() => false)) {
          await driver.tapOrClick(webIntentsBtn, 'Expandir Enlaces Web Intents', 480);
          const hideWebIntentsBtn = page.locator('button:has-text("Ocultar enlaces de adición manual web"):visible').first();
          if (await hideWebIntentsBtn.isVisible().catch(() => false)) {
            await driver.tapOrClick(hideWebIntentsBtn, 'Contraer Web Intents', 300);
          }
        }
        const advClientBtn = page.locator('button:has-text("Configuración avanzada"):visible').first();
        if (await advClientBtn.isVisible().catch(() => false)) {
          await driver.tapOrClick(advClientBtn, 'Config OAuth Client ID', 400);
          const clientInput = page.locator('input[placeholder*="Google OAuth Client ID"]:visible').first();
          if (await clientInput.isVisible().catch(() => false)) {
            await driver.typeHuman(clientInput, '987654321-demo.apps.googleusercontent.com', 360);
          }
        }
        const backBtn = page.locator('button:has-text("Volver"):visible').first();
        if (await backBtn.isVisible().catch(() => false)) {
          await driver.tapOrClick(backBtn, 'Volver a Exportar', 420);
        }
      }
    } finally {
      if (await dlg.isVisible().catch(() => false)) {
        await driver.dismissSheetIfMobile('.modal-card .grafton-modal-drag-handle', '.modal-card [aria-label="Cerrar modal de exportación"]', 'Cerrar Exportar');
        await driver.ensureModalsClosed();
      }
    }
  });

  await driver.tryStep('FileUploadModal: Carga Excel real Consulta_Horario.xlsx + JSON', async () => {
    const impBtn = page.locator('.timetable-import-btn:visible, .grafton-nav-btn--import:visible').first();
    await driver.tapOrClick(impBtn, 'Abrir FileUploadModal', 540);
    const dlg = page.locator('.modal-card:visible').first();
    await dlg.waitFor({ state: 'visible', timeout: 5000 });
    driver.stats.modals++;

    try {
      if (fs.existsSync(SAMPLE_XLSX_PATH)) {
        const fileInputs = dlg.locator('input[type="file"]');
        if ((await fileInputs.count()) >= 1) {
          await fileInputs.first().setInputFiles(SAMPLE_XLSX_PATH);
          await driver.hold(1100);
        }
      }

      const jsonInput = dlg.locator('input[placeholder*="JSON"]').first();
      if (await jsonInput.isVisible().catch(() => false)) {
        await driver.typeHuman(jsonInput, '{"courses":[]}', 340);
        await jsonInput.fill('');
      }
    } finally {
      if (await dlg.isVisible().catch(() => false)) {
        await driver.dismissSheetIfMobile('.modal-card .grafton-modal-drag-handle', '.modal-card .close-btn', 'Cerrar FileUpload');
        await driver.ensureModalsClosed();
      }
    }
  });

  await driver.paceUntil(T(208));

  // --------------------------------------------------------------------------
  // CHAPTER 4 (208 -> 240s): PAGE-SWIPE, DOCK SCRUBBING, TOP BAR & CMD+K
  // --------------------------------------------------------------------------
  await driver.hud('04/09 · NAVEGACIÓN', isTouch ? 'Page-Swipe Elástico + Dock Scrubbing + Cmd+K Categorías' : 'TopBar Modules + Paleta Ctrl+K & Categorías', isTouch ? 'SWIPE/SCRUB' : 'CTRL+K');

  if (vp.width < 1024) {
    await driver.tryStep('1:1 Elastic Horizontal Page Swipe (5 rutas completas ida y vuelta)', async () => {
      for (const nextName of ['Cursos', 'Aulas', 'Docentes', 'Mentores']) {
        const pt = await driver.findSafeSwipePoint();
        await driver.swipeOrDragXY(pt.w * 0.85, pt.y, pt.w * 0.14, pt.y, 440, 'touch', `SWIPE → ${nextName.toUpperCase()}`);
        await driver.hold(520);
      }
      for (const backName of ['Docentes', 'Aulas', 'Cursos']) {
        const pt = await driver.findSafeSwipePoint();
        await driver.swipeOrDragXY(pt.w * 0.15, pt.y, pt.w * 0.86, pt.y, 440, 'touch', `SWIPE ← ${backName.toUpperCase()}`);
        await driver.hold(480);
      }
    });

    await driver.tryStep('Magnetic Bottom Dock Thumb-Scrubbing across 5 Tabs', async () => {
      const dock = page.locator('.grafton-mobile-dock:visible').first();
      const dBox = await dock.boundingBox().catch(() => null);
      if (dBox) {
        const y = dBox.y + dBox.height / 2;
        await driver.swipeOrDragXY(dBox.x + dBox.width * 0.25, y, dBox.x + dBox.width * 0.90, y, 1100, 'touch', 'DOCK → MENTORES');
        await driver.hold(550);
        await driver.swipeOrDragXY(dBox.x + dBox.width * 0.90, y, dBox.x + dBox.width * 0.10, y, 1050, 'touch', 'DOCK ← HORARIOS');
        await driver.hold(500);
      }
    });
  } else {
    await driver.tryStep('Desktop GraftonTopBar Module Navigation Showcase (6 módulos)', async () => {
      for (const mod of ['courses', 'mentors', 'classrooms', 'professors', 'malla', 'schedule']) {
        const navBtn = page.locator(`.grafton-nav-btn[data-nav-module="${mod}"]:visible`).first();
        if (await navBtn.isVisible().catch(() => false)) {
          await driver.tapOrClick(navBtn, `TopBar -> ${mod}`, 540);
        }
      }
    });
  }

  await driver.tryStep('Command Palette (Cmd+K) Categorías & Búsqueda -> Malla', async () => {
    if (isTouch) {
      const trigger = page.locator('[data-testid="cmdk-trigger-btn"]:visible').first();
      await driver.tapOrClick(trigger, 'Abrir Cmd+K', 420);
    } else {
      await driver.pressKey('Control+k', 'CTRL + K', 460);
    }
    const cmdInput = page.locator('[data-testid="cmdk-input"]').first();
    await cmdInput.waitFor({ state: 'visible', timeout: 4500 });

    const cmdTabs = page.locator('.grafton-cmdk-tab:visible');
    const cmdTabCount = await cmdTabs.count();
    for (let i = 1; i < cmdTabCount; i++) {
      await driver.tapOrClick(cmdTabs.nth(i), `Categoría Cmd+K #${i + 1}`, 240);
    }
    if (cmdTabCount > 0) await driver.tapOrClick(cmdTabs.first(), 'Cmd+K Todos', 220);

    for (const q of ['CC1103', 'A908', 'Pino', 'Ciencia de la Computación']) {
      await cmdInput.fill('');
      await driver.typeHuman(cmdInput, q, 440);
      await driver.pressKey('ArrowDown', '↓ RESULT', 240);
    }
    await driver.pressKey('Enter', 'ENTER → MALLA', 750);
  });

  await driver.paceUntil(T(240));

  // --------------------------------------------------------------------------
  // CHAPTER 5 (240 -> 302s): MALLA CURRICULAR INTERACTIVA /malla
  // --------------------------------------------------------------------------
  await driver.hud('05/09 · MALLA', 'Malla Curricular: 4 Facultades, 16 Carreras, Pinch Zoom, Pan & Prerrequisitos', 'DAG GRAPH');
  if (!page.url().includes('/malla')) {
    await page.goto(`${baseUrl}/malla`, { waitUntil: 'networkidle' });
    await driver.hold(550);
  }

  await driver.tryStep('Facultades, Carreras Representativas y Toolbar Zoom', async () => {
    const facBtns = page.locator('.dag-faculty-btn:visible');
    const fCount = await facBtns.count();
    for (let i = 1; i < fCount; i++) {
      await driver.tapOrClick(facBtns.nth(i), `Facultad #${i + 1}`, 380);
    }
    if (fCount > 0) await driver.tapOrClick(facBtns.first(), 'Todas (16)', 340);

    const cPills = page.locator('.dag-career-pill:visible');
    const cCount = await cPills.count();
    for (const idx of [2, 5, 7, 9, 12, 15, 0]) {
      if (idx < cCount) await driver.tapOrClick(cPills.nth(idx), `Carrera #${idx + 1}`, 440);
    }

    await driver.tapOrClick(page.locator('[data-testid="dag-zoom-in"]'), 'Zoom +', 320);
    await driver.tapOrClick(page.locator('[data-testid="dag-zoom-in"]'), 'Zoom ++', 320);
    await driver.tapOrClick(page.locator('[data-testid="dag-zoom-out"]'), 'Zoom -', 320);
    await driver.tapOrClick(page.locator('[data-testid="dag-zoom-reset"]'), 'Zoom 100%', 350);
    await driver.tapOrClick(page.locator('[data-testid="dag-zoom-fit"]'), 'Ajustar 10 Ciclos', 480);
  });

  await driver.tryStep('Pinch Zoom + Pan Canvas 10 Ciclos + Trazar Cadenas Prerrequisito', async () => {
    await driver.simulatePinchZoom('#dag-scroll-container', false, isTouch ? 'PINCH IN/OUT DAG' : 'CTRL+WHEEL ZOOM');
    await driver.simulatePinchZoom('#dag-scroll-container', true, isTouch ? 'PINCH OUT DAG' : 'CTRL+WHEEL OUT');

    const scroller = page.locator('#dag-scroll-container').first();
    const sBox = await scroller.boundingBox().catch(() => null);
    if (sBox) {
      await driver.swipeOrDragXY(sBox.x + sBox.width * 0.78, sBox.y + sBox.height * 0.52, sBox.x + sBox.width * 0.20, sBox.y + sBox.height * 0.32, 680, isTouch ? 'touch' : 'mouse', 'PAN RIGHT');
      await driver.swipeOrDragXY(sBox.x + sBox.width * 0.50, sBox.y + sBox.height * 0.65, sBox.x + sBox.width * 0.50, sBox.y + sBox.height * 0.25, 580, isTouch ? 'touch' : 'mouse', 'PAN DOWN');
      await driver.swipeOrDragXY(sBox.x + sBox.width * 0.25, sBox.y + sBox.height * 0.35, sBox.x + sBox.width * 0.75, sBox.y + sBox.height * 0.62, 640, isTouch ? 'touch' : 'mouse', 'PAN LEFT');
      await scroller.evaluate(el => el.scrollTo({ left: el.scrollWidth * 0.38, behavior: 'smooth' })).catch(() => {});
      await driver.hold(550);
    }

    const dagNodes = page.locator('.dag-node');
    const nCount = await dagNodes.count();
    for (const idx of [8, 16, 22, 28, 4]) {
      if (idx < nCount) {
        await driver.tapOrClick(dagNodes.nth(idx), `Nodo Malla #${idx}`, 480);
        const routeToggle = page.locator('.dag-mobile-route-toggle:visible').first();
        if (await routeToggle.isVisible().catch(() => false)) {
          await driver.tapOrClick(routeToggle, 'Toggle Ver Ruta', 380);
        }
        const unlockPill = page.locator('.dag-pill--unlock:visible').first();
        if (await unlockPill.isVisible().catch(() => false)) {
          await driver.tapOrClick(unlockPill, 'Seguir Curso Desbloqueado', 440);
        }
        const prereqPill = page.locator('.dag-pill--prereq:visible').first();
        if (await prereqPill.isVisible().catch(() => false)) {
          await driver.tapOrClick(prereqPill, 'Volver a Prerrequisito', 440);
        }
      }
    }

    const addSchedBtn = page.locator('button:has-text("Añadir a Horario"):visible').first();
    if (await addSchedBtn.isVisible().catch(() => false)) {
      await driver.tapOrClick(addSchedBtn, 'Añadir al Horario', 400);
    }
    const viewCursosBtn = page.locator('a:has-text("Ver en Cursos"):visible, button:has-text("Ver en Cursos"):visible').first();
    if (await viewCursosBtn.isVisible().catch(() => false)) {
      await driver.tapOrClick(viewCursosBtn, 'Abrir en Cursos', 750);
    }
  });

  await driver.paceUntil(T(302), '#dag-scroll-container');

  // --------------------------------------------------------------------------
  // CHAPTER 6 (302 -> 402s): CURSOS /cursos · CIENCIAS · SUBSECCIONES & OYENTE
  // --------------------------------------------------------------------------
  await driver.hud('06/09 · CURSOS', 'Cursos: Depto Ciencias, Subsecciones (CC1103/CC1143), VisitorEmail & .ICS', 'CURSOS');
  await driver.tryStep('Filtros /cursos (Ciencias, Días, Modalidad, En Vivo) + Swipe Oyente', async () => {
    const closeExisting = page.locator('.course-modal-close-btn:visible').first();
    if (await closeExisting.isVisible().catch(() => false)) {
      await driver.tapOrClick(closeExisting, 'Cerrar modal previo', 340);
    }
    if (!page.url().includes('/cursos')) {
      await page.goto(`${baseUrl}/cursos`, { waitUntil: 'networkidle' });
      await driver.hold(520);
    }

    const root = page.locator('.course-finder-root');
    const searchInput = root.locator('input[placeholder*="Buscar por código"]').first();
    await driver.typeHuman(searchInput, 'Algoritmos', 420);
    await searchInput.fill('');
    await driver.hold(200);

    const sortSel = root.locator('.course-sort-select .custom-select-trigger').first();
    if (await sortSel.isVisible().catch(() => false)) {
      await driver.tapOrClick(sortSel, 'Ordenar Cursos', 320);
      const opt = root.locator('.course-sort-select .custom-select-option').nth(1);
      if (await opt.isVisible().catch(() => false)) await driver.tapOrClick(opt, 'Cambiar orden', 320);
    }

    const dayPills = root.locator('.prof-day-pill');
    for (let i = 1; i < await dayPills.count(); i++) {
      await driver.tapOrClick(dayPills.nth(i), `Día Cursos #${i}`, 250);
    }
    await driver.tapOrClick(dayPills.first(), 'Todos días', 260);

    // Filter Departamento Ciencias (verifying CC nomenclature) then Restablecer
    const deptTrigger = root.locator('.course-dept-select .custom-select-trigger').first();
    if (await deptTrigger.isVisible().catch(() => false)) {
      await driver.tapOrClick(deptTrigger, 'Filtro Depto Académico', 340);
      const ddSearch = root.locator('.course-dept-select .custom-select-search-input').first();
      if (await ddSearch.isVisible().catch(() => false)) {
        await driver.typeHuman(ddSearch, 'Ciencias', 360);
      }
      const opt = root.locator('.course-dept-select .custom-select-option').first();
      if (await opt.isVisible().catch(() => false)) await driver.tapOrClick(opt, 'Departamento Ciencias', 440);
    }

    const modTrigger = root.locator('.course-modality-select .custom-select-trigger').first();
    if (await modTrigger.isVisible().catch(() => false)) {
      await driver.tapOrClick(modTrigger, 'Filtro Modalidad', 320);
      const mOpt = root.locator('.course-modality-select .custom-select-option').nth(1);
      if (await mOpt.isVisible().catch(() => false)) await driver.tapOrClick(mOpt, 'Modalidad Presencial', 340);
    }

    const resetBtn = root.locator('.filter-reset-btn').first();
    if (await resetBtn.isVisible().catch(() => false)) await driver.tapOrClick(resetBtn, 'Restablecer', 320);

    const liveBtn = root.locator('.course-quick-pill--live').first();
    if (await liveBtn.isVisible().catch(() => false)) {
      await driver.tapOrClick(liveBtn, 'En vivo ahora', 380);
      await driver.tapOrClick(liveBtn, 'Quitar En vivo', 280);
    }

    if (vp.width < 768) {
      const card = root.locator('.course-card').first();
      const cBox = await card.boundingBox().catch(() => null);
      if (cBox) {
        await driver.swipeOrDragXY(cBox.x + 28, cBox.y + 42, cBox.x + cBox.width - 24, cBox.y + 42, 440, 'touch', 'SWIPE → OYENTE');
        await driver.hold(520);
      }
    }
  });

  await driver.tryStep('Subsecciones CC1103 (Ciencias + 7 Labs) & CC1143 (2-Niveles Sec->Sub)', async () => {
    const root = page.locator('.course-finder-root');
    const searchInput = root.locator('input[placeholder*="Buscar por código"]').first();

    // 1. CC1103 Álgebra Lineal: Ciencias + Single-Main 7 Lab Subsections
    await driver.typeHuman(searchInput, 'CC1103', 440);
    await driver.tapOrClick(root.locator('.course-card').first(), 'Abrir CC1103 (Ciencias)', 520);
    const dlg1103 = page.locator('.course-modal-dialog:visible').first();
    await dlg1103.waitFor({ state: 'visible', timeout: 5000 });
    driver.stats.modals++;
    try {
      await driver.tapOrClick(dlg1103.locator('.course-modal-tab-btn').nth(1), 'CC1103 Malla Subsecciones', 600);
      const subPills = dlg1103.locator('[aria-label="Filtrar subsección del curso"] .course-subsec-filter-pill:visible');
      if ((await subPills.count()) >= 3) {
        await driver.tapOrClick(subPills.nth(2), 'Filtrar Lab 13', 460);
        await driver.tapOrClick(subPills.nth(0), 'Volver Lab 11', 380);
      }
      const allLabsBtn = dlg1103.locator('[aria-label="Filtrar subsección del curso"] .course-sec-filter-pill:has-text("Todas"):visible').first();
      if (await allLabsBtn.isVisible().catch(() => false)) {
        await driver.tapOrClick(allLabsBtn, 'Todas las 7 Subsecciones', 440);
      }
      const sessBlock = dlg1103.locator('.prof-tt-block, .course-tt-block').first();
      if (await sessBlock.isVisible().catch(() => false)) {
        await driver.tapOrClick(sessBlock, 'Inspector Teoría Compartida S01·7s', 560);
      }
    } finally {
      await driver.dismissSheetIfMobile('.course-modal-dialog .course-sheet-drag-zone', '.course-modal-dialog .course-modal-close-btn', 'Cerrar CC1103');
      await driver.ensureModalsClosed();
    }

    // 2. CC1143 Ciencia de los Materiales: 2-Level Section -> Subsection Hierarchy
    await searchInput.fill('');
    await driver.typeHuman(searchInput, 'CC1143', 440);
    const card1143 = root.locator('.course-card').first();
    if (await card1143.isVisible().catch(() => false)) {
      await driver.tapOrClick(card1143, 'Abrir CC1143 (2 Niveles)', 520);
      const dlg1143 = page.locator('.course-modal-dialog:visible').first();
      if (await dlg1143.isVisible().catch(() => false)) {
        driver.stats.modals++;
        try {
          await driver.tapOrClick(dlg1143.locator('.course-modal-tab-btn').nth(1), 'CC1143 Malla Jerarquía 2-Niveles', 620);
          const sec1Pill = dlg1143.locator('[aria-label="Filtrar sección principal del curso"] .course-sec-filter-pill:has-text("Sec. 1"):visible').first();
          if (await sec1Pill.isVisible().catch(() => false)) await driver.tapOrClick(sec1Pill, 'Filtrar Sec. 1 (4 sub)', 440);
          const teo12Pill = dlg1143.locator('.course-subsec-pills-strip .course-subsec-filter-pill:has-text("Teo 12"):visible').first();
          if (await teo12Pill.isVisible().catch(() => false)) await driver.tapOrClick(teo12Pill, 'Subsec. Teo 12', 420);
          const sec2Pill = dlg1143.locator('[aria-label="Filtrar sección principal del curso"] .course-sec-filter-pill:has-text("Sec. 2"):visible').first();
          if (await sec2Pill.isVisible().catch(() => false)) await driver.tapOrClick(sec2Pill, 'Filtrar Sec. 2 (4 sub)', 440);
          const allSecPill = dlg1143.locator('[aria-label="Filtrar sección principal del curso"] .course-sec-filter-pill:has-text("Todas"):visible').first();
          if (await allSecPill.isVisible().catch(() => false)) await driver.tapOrClick(allSecPill, 'Todas (8 subsecs)', 440);

          const vBtns = dlg1143.locator('.prof-view-toggle-btn');
          if ((await vBtns.count()) >= 2) {
            await driver.tapOrClick(vBtns.nth(1), 'CC1143 Agenda', 460);
            await driver.tapOrClick(vBtns.nth(0), 'CC1143 Matriz', 380);
          }
        } finally {
          await driver.dismissSheetIfMobile('.course-modal-dialog .course-sheet-drag-zone', '.course-modal-dialog .course-modal-close-btn', 'Cerrar CC1143');
          await driver.ensureModalsClosed();
        }
      }
    }
    await searchInput.fill('');
  });

  await driver.tryStep('Modal HH2101: Oyente + VisitorEmailModal + Exportar .ICS + AD2011', async () => {
    const root = page.locator('.course-finder-root');
    const searchInput = root.locator('input[placeholder*="Buscar por código"]').first();
    await driver.typeHuman(searchInput, 'HH2101', 460);
    const targetCard = root.locator('.course-card').first();
    await driver.tapOrClick(targetCard, 'Abrir HH2101', 540);
    const dlg = page.locator('.course-modal-dialog:visible').first();
    await dlg.waitFor({ state: 'visible', timeout: 5000 });
    driver.stats.modals++;

    try {
      const starBtn = dlg.locator('.visitor-action-btn--primary').first();
      if (await starBtn.isVisible().catch(() => false)) await driver.tapOrClick(starBtn, 'Marcar como Visitante', 380);

      const icsActionBtn = dlg.locator('button:has-text("Exportar .ICS"):visible').first();
      if (await icsActionBtn.isVisible().catch(() => false)) {
        await driver.hoverElement(icsActionBtn, 360);
      }

      const permBtn = dlg.locator('.course-permission-btn').first();
      if (await permBtn.isVisible().catch(() => false)) {
        await driver.tapOrClick(permBtn, 'Abrir Pedir Permiso (Oyente)', 500);
        const vDlg = page.locator('.visitor-modal-dialog:visible').first();
        if (await vDlg.isVisible().catch(() => false)) {
          const secDrop = vDlg.locator('.visitor-meta-section .custom-select-trigger').first();
          if (await secDrop.isVisible().catch(() => false)) {
            await driver.tapOrClick(secDrop, 'Cambiar sección a auditar', 320);
            const sOpt = vDlg.locator('.visitor-meta-section .custom-select-option').nth(1);
            if (await sOpt.isVisible().catch(() => false)) await driver.tapOrClick(sOpt, 'Sección 2', 300);
          }
          const togglePers = vDlg.locator('.visitor-student-toggle-btn').first();
          if (await togglePers.isVisible().catch(() => false)) {
            await driver.tapOrClick(togglePers, 'Completar datos remitente', 320);
            await driver.typeHuman(vDlg.locator('#visitor-student-name'), 'Valeria Campos', 260);
            await driver.typeHuman(vDlg.locator('#visitor-student-major'), 'Ingeniería Industrial', 260);
          }
          const copyBtn = vDlg.locator('.visitor-copy-btn').first();
          if (await copyBtn.isVisible().catch(() => false)) await driver.tapOrClick(copyBtn, 'Copiar borrador', 400);
          const backBtn = vDlg.locator('.visitor-modal-back-btn').first();
          if (await backBtn.isVisible().catch(() => false)) await driver.tapOrClick(backBtn, 'Volver a HH2101', 380);
        }
      }

      const mallaTab = dlg.locator('.course-modal-tab-btn').nth(1);
      await driver.tapOrClick(mallaTab, 'Tab Malla Horaria', 560);
      const daysFilter = dlg.locator('.course-days-filter-pill');
      for (let i = 0; i < Math.min(await daysFilter.count(), 2); i++) {
        await driver.tapOrClick(daysFilter.nth(i), `Toggle malla #${i + 1}`, 340);
      }
      const dayJumps = dlg.locator('.course-day-jump-chip:visible');
      for (let i = 0; i < Math.min(await dayJumps.count(), 3); i++) {
        await driver.tapOrClick(dayJumps.nth(i), `Ir al día #${i + 1}`, 320);
      }
    } finally {
      await driver.dismissSheetIfMobile('.course-modal-dialog .course-sheet-drag-zone', '.course-modal-dialog .course-modal-close-btn', 'Cerrar HH2101');
      await driver.ensureModalsClosed();
    }
    await searchInput.fill('');

    // Showcase Mis Visitados filter pill
    const visitadosBtn = root.locator('.course-quick-pill--visitor').first();
    if (await visitadosBtn.isVisible().catch(() => false)) {
      await driver.tapOrClick(visitadosBtn, 'Filtrar Mis Visitados', 520);
      await driver.tapOrClick(visitadosBtn, 'Ver catálogo completo', 340);
    }
  });

  await driver.tryStep('Scroll catálogo Cursos + Botón SUBIR', async () => {
    await driver.smoothScrollWindow(1000, 650);
    const topBtn = page.locator('.course-finder-root .mobile-floating-top-btn:visible').first();
    if (await topBtn.isVisible().catch(() => false)) {
      await driver.tapOrClick(topBtn, 'Botón flotante SUBIR', 450);
    } else {
      await driver.smoothScrollWindow(-1000, 450);
    }
  });

  await driver.paceUntil(T(402));

  // --------------------------------------------------------------------------
  // CHAPTER 7 (402 -> 462s): AULAS LIBRES /aulas + CAMPUS VERTICAL + MODAL A908
  // --------------------------------------------------------------------------
  await driver.hud('07/09 · AULAS', 'Aulas: Hero Intranet UTEC en Vivo, TimePickers De/A, Pisos 1..11, Campus Vertical & A908', 'AULAS');
  await driver.tryStep('Navegar a /aulas + Hora en Vivo + TimePickers + Pisos + Campus Vertical + Modal A908', async () => {
    await page.goto(`${baseUrl}/aulas`, { waitUntil: 'networkidle' });
    await driver.hold(650);

    const root = page.locator('.classroom-finder-root');

    // Open Live TimePicker -> simulate 10:00 AM campus -> -15m / +15m / Volver a Hora Real
    const liveBadgeBtn = root.locator('.live-time-stepper-btn:visible').first();
    if (await liveBadgeBtn.isVisible().catch(() => false)) {
      await driver.tapOrClick(liveBadgeBtn, 'Simular Hora Campus en Vivo', 380);
      const chip10 = page.locator('.gtp-chip:has-text("10:00"):visible, .gtp-chip:has-text("11:00"):visible').first();
      if (await chip10.isVisible().catch(() => false)) await driver.tapOrClick(chip10, 'Campus 10:00 AM', 420);
      const closeLiveGtp = page.locator('.gtp-close-btn:visible').first();
      if (await closeLiveGtp.isVisible().catch(() => false)) await driver.tapOrClick(closeLiveGtp, 'Cerrar selector en vivo', 240);
    }
    const prevLive = root.locator('.grafton-step-btn--prev:visible').first();
    const nextLive = root.locator('.grafton-step-btn--next:visible').first();
    if (await nextLive.isVisible().catch(() => false)) {
      await driver.tapOrClick(nextLive, 'Avanzar Hora Campus (+15m)', 340);
    }
    if (await prevLive.isVisible().catch(() => false)) {
      await driver.tapOrClick(prevLive, 'Retroceder Hora Campus (-15m)', 320);
    }
    const resetRealtime = root.locator('.btn-reset-realtime:visible').first();
    if (await resetRealtime.isVisible().catch(() => false)) {
      await driver.tapOrClick(resetRealtime, 'Volver a hora real', 300);
    }

    const manualModeBtn = root.locator('button:has-text("Buscar por Horario")').first();
    if (await manualModeBtn.isVisible().catch(() => false)) {
      await driver.tapOrClick(manualModeBtn, 'Buscar por Horario', 420);
    }

    // Both De: and A: CustomTimePickers
    const timeTriggers = root.locator('.time-inputs-container .grafton-time-trigger-btn:visible');
    if ((await timeTriggers.count()) >= 1) {
      await driver.tapOrClick(timeTriggers.nth(0), 'CustomTimePicker De:', 400);
      const chip = page.locator('.gtp-chip:visible').nth(1);
      if (await chip.isVisible().catch(() => false)) await driver.tapOrClick(chip, 'Hora frecuente De:', 320);
      const closeGtp = page.locator('.gtp-close-btn:visible').first();
      if (await closeGtp.isVisible().catch(() => false)) await driver.tapOrClick(closeGtp, 'Cerrar Picker De:', 240);
    }
    if ((await timeTriggers.count()) >= 2) {
      await driver.tapOrClick(timeTriggers.nth(1), 'CustomTimePicker A:', 380);
      const closeGtp2 = page.locator('.gtp-close-btn:visible').first();
      if (await closeGtp2.isVisible().catch(() => false)) await driver.tapOrClick(closeGtp2, 'Cerrar Picker A:', 240);
    }

    const timePresets = root.locator('.time-preset-btn');
    for (let i = 0; i < Math.min(await timePresets.count(), 4); i++) {
      await driver.tapOrClick(timePresets.nth(i), `Preset horario #${i + 1}`, 260);
    }
    if ((await timePresets.count()) >= 3) {
      await driver.tapOrClick(timePresets.nth(2), 'Preset Tarde (14:00 - 18:00)', 300);
    }

    const dateModeBtns = root.locator('.date-mode-btn');
    if ((await dateModeBtns.count()) >= 2) {
      await driver.tapOrClick(dateModeBtns.nth(1), 'Semestre General', 380);
      await driver.tapOrClick(dateModeBtns.nth(0), 'Fecha Exacta', 360);
    }
    const semNextBtn = root.locator('button:has-text("Sem. >"):visible').first();
    const semPrevBtn = root.locator('button:has-text("< Sem."):visible').first();
    if (await semNextBtn.isVisible().catch(() => false)) {
      await driver.tapOrClick(semNextBtn, 'Semana siguiente', 280);
      if (await semPrevBtn.isVisible().catch(() => false)) await driver.tapOrClick(semPrevBtn, 'Semana actual', 260);
    }

    const cDayPills = root.locator('.day-pill-btn');
    for (const idx of [0, 3, 5, 2]) {
      if (idx < (await cDayPills.count())) await driver.tapOrClick(cDayPills.nth(idx), `Día aula #${idx + 1}`, 260);
    }
    const durPills = root.locator('.duration-pill-btn');
    for (let i = 1; i < Math.min(await durPills.count(), 4); i++) {
      await driver.tapOrClick(durPills.nth(i), `Duración #${i}`, 260);
    }
    if ((await durPills.count()) > 0) await driver.tapOrClick(durPills.first(), 'Cualquiera', 240);

    const floorPills = root.locator('.floor-pill-btn');
    for (const idx of [2, 5, 7, 9, 0]) {
      if (idx < (await floorPills.count())) await driver.tapOrClick(floorPills.nth(idx), `Piso #${idx + 1}`, 280);
    }

    const typeChips = root.locator('.type-chip-btn');
    for (let i = 1; i < await typeChips.count(); i++) {
      await driver.tapOrClick(typeChips.nth(i), `Tipo aula #${i + 1}`, 260);
    }
    if ((await typeChips.count()) > 0) await driver.tapOrClick(typeChips.first(), 'Todos tipos', 250);

    const sortTrigger = root.locator('.custom-select-trigger:visible').first();
    if (await sortTrigger.isVisible().catch(() => false)) {
      await driver.tapOrClick(sortTrigger, 'Ordenar Aulas', 300);
      const sortOpt = page.locator('.custom-select-option:has-text("Mayor tiempo libre"):visible').first();
      if (await sortOpt.isVisible().catch(() => false)) await driver.tapOrClick(sortOpt, 'Mayor tiempo libre', 320);
    }

    const subModes = root.locator('.classroom-submode-btn');
    if ((await subModes.count()) >= 2) {
      await driver.tapOrClick(subModes.nth(1), 'Campus Vertical Grafton Architects', 680);
      await driver.smoothScrollWindow(600, 620);
      const freeChip = root.locator('.campus-room-chip.is-free:visible').first();
      if (await freeChip.isVisible().catch(() => false)) {
        await driver.tapOrClick(freeChip, 'Abrir Aula Libre desde Campus Vertical', 560);
        const fDlg = page.locator('.classroom-modal:visible').first();
        if (await fDlg.isVisible().catch(() => false)) {
          driver.stats.modals++;
          await driver.dismissSheetIfMobile('.classroom-modal .mobile-sheet-drag-zone', '.classroom-modal .modal-close-btn', 'Cerrar Modal Campus');
          await driver.ensureModalsClosed();
        }
      }
      await driver.tapOrClick(subModes.nth(0), 'Volver Directorio', 420);
    }

    const busyToggle = root.locator('button:has-text("Ver Aulas Ocupadas")').first();
    if (await busyToggle.isVisible().catch(() => false)) {
      await driver.tapOrClick(busyToggle, 'Expandir Aulas Ocupadas', 440);
    }

    const roomSearch = root.locator('input[placeholder*="Buscar aula"]').first();
    if (await roomSearch.isVisible().catch(() => false)) {
      await driver.typeHuman(roomSearch, 'A908', 420);
    }
    const roomCard = root.locator('.classroom-card').first();
    await driver.tapOrClick(roomCard, 'Abrir ClassroomDetailModal A908', 600);
    const dlg = page.locator('.classroom-modal:visible').first();
    await dlg.waitFor({ state: 'visible', timeout: 5000 });
    driver.stats.modals++;

    try {
      const mDateBtns = dlg.locator('.modal-date-mode-btn');
      if ((await mDateBtns.count()) >= 2) {
        await driver.tapOrClick(mDateBtns.nth(1), 'Modal Semestre', 360);
        await driver.tapOrClick(mDateBtns.nth(0), 'Modal Fecha Exacta', 360);
      }
      const weekNext = dlg.locator('.modal-week-btn').nth(1);
      if (await weekNext.isVisible().catch(() => false)) {
        await driver.tapOrClick(weekNext, 'Siguiente semana', 340);
        const weekToday = dlg.locator('.modal-week-today-btn').first();
        if (await weekToday.isVisible().catch(() => false)) await driver.tapOrClick(weekToday, 'Hoy', 320);
      }
      const modalDays = dlg.locator('.modal-day-tab');
      for (let i = 0; i < await modalDays.count(); i++) {
        await driver.tapOrClick(modalDays.nth(i), `Día Modal #${i + 1}`, 280);
      }
      const occCard = dlg.locator('.agenda-item--occupied').first();
      if (await occCard.isVisible().catch(() => false)) {
        await driver.tapOrClick(occCard, 'Inspeccionar sesión ocupada', 480);
      }
    } finally {
      await driver.dismissSheetIfMobile('.classroom-modal .mobile-sheet-drag-zone', '.classroom-modal .modal-close-btn', 'Cerrar AulaModal');
      await driver.ensureModalsClosed();
    }

    const resetClassroomFilters = root.locator('.btn-reset-filters:visible').first();
    if (await resetClassroomFilters.isVisible().catch(() => false)) {
      await driver.tapOrClick(resetClassroomFilters, 'Restablecer Aulas', 300);
    }
  });

  await driver.paceUntil(T(462));

  // --------------------------------------------------------------------------
  // CHAPTER 8 (462 -> 510s): DOCENTES (/profesores) & MENTORES (/mentores)
  // --------------------------------------------------------------------------
  await driver.hud('08/09 · DOCENTES', 'Docentes (Ciencias/Filtros/3-Tabs) & Mentores (Compatibilidad/EmptyState)', 'DIRECTORIOS');
  await driver.tryStep('Docentes: Filtros completos + ProfessorDetailModal (3 Tabs & Matriz/Agenda)', async () => {
    await page.goto(`${baseUrl}/profesores`, { waitUntil: 'networkidle' });
    await driver.hold(520);

    const root = page.locator('.professor-finder-root');
    const search = root.locator('input[placeholder*="Buscar docente"]').first();
    await driver.typeHuman(search, 'Pino', 440);
    await search.fill('');
    await driver.hold(200);

    // Filter Ciencias Department to verify CC -> Ciencias mapping
    const deptTrigger = root.locator('.custom-select-trigger:visible').nth(1);
    if (await deptTrigger.isVisible().catch(() => false)) {
      await driver.tapOrClick(deptTrigger, 'Depto Ciencias Docentes', 320);
      const sciOpt = root.locator('.custom-select-option:has-text("Ciencias"):visible').first();
      if (await sciOpt.isVisible().catch(() => false)) {
        await driver.tapOrClick(sciOpt, 'Ciencias (CC)', 420);
      }
    }

    const toggles = root.locator('.prof-toggle-btn:visible');
    for (let i = 0; i < Math.min(await toggles.count(), 2); i++) {
      await driver.tapOrClick(toggles.nth(i), `Prof Toggle #${i + 1}`, 280);
      await driver.tapOrClick(toggles.nth(i), `Reset Prof Toggle #${i + 1}`, 220);
    }

    const modBtns = root.locator('.prof-modality-btn');
    for (let i = 0; i < Math.min(await modBtns.count(), 2); i++) {
      await driver.tapOrClick(modBtns.nth(i), `Prof Mod #${i + 1}`, 280);
      await driver.tapOrClick(modBtns.nth(i), `Reset Prof Mod #${i + 1}`, 220);
    }

    const resetBtn = root.locator('.prof-reset-btn:visible').first();
    if (await resetBtn.isVisible().catch(() => false)) {
      await driver.tapOrClick(resetBtn, 'Restablecer Docentes', 280);
    }

    const firstProfCard = root.locator('.professor-card').first();
    await driver.tapOrClick(firstProfCard, 'Abrir ProfessorDetailModal', 540);
    const dlg = page.locator('.prof-modal:not(.mentor-modal):visible').first();
    await dlg.waitFor({ state: 'visible', timeout: 5000 });
    driver.stats.modals++;

    try {
      const profTabs = dlg.locator('.prof-modal-tab-btn');
      for (let i = 1; i < await profTabs.count(); i++) {
        await driver.tapOrClick(profTabs.nth(i), `Prof Tab #${i + 1}`, 440);
      }
      await driver.tapOrClick(profTabs.first(), 'Tab Horario Prof', 400);
      const viewBtns = dlg.locator('.prof-view-toggle-btn');
      if ((await viewBtns.count()) >= 2) {
        await driver.tapOrClick(viewBtns.nth(1), 'Prof Agenda', 420);
        await driver.tapOrClick(viewBtns.nth(0), 'Prof Matriz', 360);
      }
    } finally {
      await driver.dismissSheetIfMobile('.prof-modal:not(.mentor-modal) .mobile-sheet-drag-zone', '.prof-modal:not(.mentor-modal) .modal-close-btn', 'Cerrar ProfModal');
      await driver.ensureModalsClosed();
    }
  });

  await driver.tryStep('Mentores (/mentores): Compatibilidad, Filtros, EmptyState & Modal 3 Tabs', async () => {
    await page.goto(`${baseUrl}/mentores`, { waitUntil: 'networkidle' });
    await driver.hold(520);

    const root = page.locator('.mentor-finder-root');
    const compatBtn = root.locator('.mentor-compat-bar button').first();
    if (await compatBtn.isVisible().catch(() => false)) {
      await driver.tapOrClick(compatBtn, 'Filtrar Mentores Compatibles con Horario', 440);
      await driver.tapOrClick(compatBtn, 'Todos los Mentores', 280);
    }

    const search = root.locator('input[placeholder*="Buscar mentor"]').first();
    await driver.typeHuman(search, 'Cálculo', 400);
    await search.fill('');
    await driver.hold(200);

    const mCard = root.locator('.mentor-card').first();
    if (await mCard.isVisible().catch(() => false)) {
      await driver.tapOrClick(mCard, 'Abrir MentorDetailModal', 540);
      const dlg = page.locator('.mentor-modal:visible').first();
      await dlg.waitFor({ state: 'visible', timeout: 5000 });
      driver.stats.modals++;

      try {
        const mTabs = dlg.locator('.prof-modal-tab-btn');
        for (let i = 1; i < await mTabs.count(); i++) {
          await driver.tapOrClick(mTabs.nth(i), `Mentor Tab #${i + 1}`, 440);
        }
      } finally {
        await driver.dismissSheetIfMobile('.mentor-modal .mobile-sheet-drag-zone', '.mentor-modal .modal-close-btn', 'Cerrar MentorModal');
        await driver.ensureModalsClosed();
      }
    }

    // Empty state + Restablecer Filtros button check
    await driver.typeHuman(search, 'ZZZ999', 360);
    const resetMentors = root.locator('button:has-text("Restablecer Filtros"):visible').first();
    if (await resetMentors.isVisible({ timeout: 2500 }).catch(() => false)) {
      await driver.tapOrClick(resetMentors, 'Restablecer Filtros (Empty State)', 380);
    } else {
      await search.fill('');
    }
  });

  await driver.paceUntil(T(510));

  // --------------------------------------------------------------------------
  // CHAPTER 9 (510 -> 540s): DEEP LINKS, ALIAS /docentes, /privacy, /terms & FINALE
  // --------------------------------------------------------------------------
  await driver.hud('09/09 · DEEP-LINKS', 'Deep-Links (?curso=CC1143, ?aula=A908, /docentes), /privacy & /terms', 'FINAL');
  await driver.tryStep('Deep-Links & Legal Pages', async () => {
    await page.goto(`${baseUrl}/cursos?curso=CC1143`, { waitUntil: 'networkidle' });
    await driver.hold(950);
    await driver.pressKey('Escape', 'ESC', 280);

    await page.goto(`${baseUrl}/aulas?aula=A908`, { waitUntil: 'networkidle' });
    await driver.hold(900);
    await driver.pressKey('Escape', 'ESC', 280);

    await page.goto(`${baseUrl}/docentes`, { waitUntil: 'networkidle' });
    await driver.hold(750);

    await page.goto(`${baseUrl}/privacy`, { waitUntil: 'networkidle' });
    await driver.smoothScrollWindow(600, 620);
    await driver.hold(450);
    await driver.smoothScrollWindow(-450, 500);

    await page.goto(`${baseUrl}/terms`, { waitUntil: 'networkidle' });
    await driver.smoothScrollWindow(600, 620);
    await driver.hold(450);
    await driver.smoothScrollWindow(-450, 500);

    await page.goto(`${baseUrl}/`, { waitUntil: 'networkidle' });
    await driver.hold(750);
  });

  await driver.paceUntil(T(540));
  await driver.hud('COMPLETO · 09:00', `Tour completo (${driver.stats.actions} clicks · ${driver.stats.swipes} swipes · ${driver.stats.drags} drags)`, 'DONE');
  await driver.wait(500);
}

// ============================================================================
// MAIN ENTRYPOINT
// ============================================================================
async function main() {
  const { cfg, port, durationSec } = parseArgs();
  fs.mkdirSync(TOUR_VIDEOS_DIR, { recursive: true });
  const rawDir = `/tmp/tour-raw-${cfg.id}-${Date.now()}`;
  fs.mkdirSync(rawDir, { recursive: true });

  const server = await startStaticServer(port);
  const baseUrl = `http://127.0.0.1:${port}`;
  console.log(`[${cfg.id}] Serving dist/ on ${baseUrl} (target=${durationSec}s)...`);

  const browser = await chromium.launch({
    executablePath: CHROMIUM_EXECUTABLE,
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu-sandbox'],
  });

  const consoleErrors = [];
  const pageErrors = [];
  let webmPath = null;
  const finalMp4 = path.join(TOUR_VIDEOS_DIR, cfg.outName);

  try {
    const context = await browser.newContext({
      viewport: cfg.contextOptions.viewport,
      deviceScaleFactor: cfg.contextOptions.deviceScaleFactor,
      isMobile: cfg.contextOptions.isMobile,
      hasTouch: cfg.contextOptions.hasTouch,
      locale: 'es-PE',
      timezoneId: 'America/Lima',
      recordVideo: {
        dir: rawDir,
        size: cfg.contextOptions.recordVideoSize,
      },
    });

    await context.addInitScript(
      buildInitOverlayScript({
        hudLabel: cfg.hudLabel,
        isTouchDevice: cfg.contextOptions.hasTouch,
        targetDurationSec: durationSec,
      })
    );

    const page = await context.newPage();
    page.on('pageerror', err => pageErrors.push(String(err)));
    page.on('console', msg => {
      if (msg.type() === 'error') {
        const txt = msg.text();
        if (!txt.includes('favicon')) consoleErrors.push(txt);
      }
    });

    const driver = new TourDriver(page, cfg, durationSec);
    await runFullDeviceTour(baseUrl, driver, durationSec);

    const videoHandle = page.video();
    await context.close();
    if (videoHandle) webmPath = await videoHandle.path();

    console.log(`[${cfg.id}] Finished recording at ${driver.elapsedSec().toFixed(1)}s. Stats:`, JSON.stringify(driver.stats));
    console.log(`[${cfg.id}] Errors: pageErrors=${pageErrors.length}, consoleErrors=${consoleErrors.length}`);
    if (pageErrors.length) console.log(`[${cfg.id}] pageErrors:`, pageErrors);
    if (consoleErrors.length) console.log(`[${cfg.id}] consoleErrorsSample:`, consoleErrors.slice(0, 6));
  } finally {
    await browser.close();
    server.close();
  }

  if (webmPath && fs.existsSync(webmPath)) {
    console.log(`[${cfg.id}] Transcoding ${webmPath} -> ${finalMp4} ...`);
    const ffArgs = ['-y', '-i', webmPath];
    if (cfg.scaleSize) {
      ffArgs.push('-vf', `scale=${cfg.scaleSize}:flags=lanczos,setsar=1`);
    }
    ffArgs.push(
      '-c:v',
      'libx264',
      '-pix_fmt',
      'yuv420p',
      '-r',
      '30',
      '-preset',
      'fast',
      '-crf',
      '21',
      '-movflags',
      '+faststart',
      finalMp4
    );
    execFileSync('ffmpeg', ffArgs, { stdio: 'pipe' });
    fs.rmSync(rawDir, { recursive: true, force: true });

    const probe = execFileSync('ffprobe', [
      '-v',
      'error',
      '-show_entries',
      'format=duration,size:stream=width,height,codec_name',
      '-of',
      'json',
      finalMp4,
    ]).toString();
    console.log(`[${cfg.id}] FFPROBE:`, probe.trim());
  } else {
    throw new Error(`[${cfg.id}] Video file was not created!`);
  }
}

main().catch(err => {
  console.error('FATAL TOUR ERROR:', err);
  process.exit(1);
});
