import { formatLocation, DAY_NAMES, DAYS } from './scheduleUtils';
import { getGraftonPigment, isLaboratorySession } from './graftonPigments';
import type { Course, DayOfWeek } from '../types/schedule';

interface ExportBlock {
  course: Course;
  sectionNumber: string;
  sessionGroup: string;
  day: DayOfWeek;
  startTime: string;
  endTime: string;
  startMinutes: number;
  endMinutes: number;
  location: string;
}

const formatCompactRoom = (loc: string): string => {
  const formatted = formatLocation(loc);
  if (!formatted) return 'Aula';
  if (/virtual|zoom|meet/i.test(formatted)) return 'Virtual';
  if (/magna|auditorio/i.test(formatted)) return 'MAG · Aula Magna';
  const roomMatch = formatted.match(/([ABLM]\s?-?\s?\d{3,4}[A-Z]?)/i);
  if (roomMatch) return roomMatch[1].replace(/\s+/g, '').toUpperCase();
  return formatted.length > 14 ? formatted.slice(0, 14) : formatted;
};

const formatSessionTypeLabel = (session: string): string => {
  if (!session) return 'Teoría';
  if (/LABORATORIO|LAB/i.test(session)) return 'Laboratorio';
  if (/TALLER/i.test(session)) return 'Taller';
  if (/SEMINARIO|SEM/i.test(session)) return 'Seminario';
  return 'Teoría';
};

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number
): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    if (ctx.measureText(testLine).width <= maxWidth) {
      currentLine = testLine;
    } else {
      if (currentLine) {
        lines.push(currentLine);
        currentLine = word;
        if (lines.length >= maxLines) break;
      } else {
        // Single long word
        let truncated = word;
        while (truncated.length > 1 && ctx.measureText(truncated + '…').width > maxWidth) {
          truncated = truncated.slice(0, -1);
        }
        lines.push(truncated + (truncated.length < word.length ? '…' : ''));
        currentLine = '';
        if (lines.length >= maxLines) break;
      }
    }
  }
  if (currentLine && lines.length < maxLines) {
    lines.push(currentLine);
  }
  if (lines.length === maxLines && words.length > 0) {
    const last = lines[maxLines - 1];
    if (ctx.measureText(last).width > maxWidth) {
      let trimmed = last;
      while (trimmed.length > 1 && ctx.measureText(trimmed + '…').width > maxWidth) {
        trimmed = trimmed.slice(0, -1);
      }
      lines[maxLines - 1] = trimmed + '…';
    }
  }
  return lines;
}

/**
 * Renders the full 6-day weekly schedule directly onto a high-DPI HTML5 Canvas
 * with exact Grafton Swiss contrast, crisp 1px gridlines, and 45° diagonal lab hatches.
 * Never includes the day-navigation switcher and never crops to a single day.
 */
export async function exportScheduleToPNG(
  courses: Course[],
  selectedSections: Record<string, string>,
  optionName: string
): Promise<void> {
  if (typeof document === 'undefined') return;

  // Wait for web fonts if available so JetBrains Mono & Space Grotesk render crisply
  if (document.fonts && document.fonts.ready) {
    await document.fonts.ready.catch(() => {});
  }

  const blocks: ExportBlock[] = [];
  Object.entries(selectedSections).forEach(([courseCode, secNum]) => {
    const course = courses.find(c => c.code === courseCode);
    if (!course) return;
    const section = course.sections.find(s => s.sectionNumber === secNum);
    if (!section) return;

    section.sessions.forEach(sess => {
      blocks.push({
        course,
        sectionNumber: secNum,
        sessionGroup: sess.sessionGroup,
        day: sess.day,
        startTime: sess.startTime,
        endTime: sess.endTime,
        startMinutes: sess.startMinutes,
        endMinutes: sess.endMinutes,
        location: sess.location,
      });
    });
  });

  // Compute day hours map
  const dayHoursMap: Record<string, number> = {};
  for (const day of DAYS) {
    const mins = blocks
      .filter(b => b.day === day)
      .reduce((acc, b) => acc + Math.max(0, b.endMinutes - b.startMinutes), 0);
    dayHoursMap[day] = Math.round((mins / 60) * 10) / 10;
  }

  // Dynamic time bounds (always at least 07:00 - 21:00)
  const startHour = 7;
  let endHour = 21;
  if (blocks.length > 0) {
    const maxEndMin = Math.max(...blocks.map(b => b.endMinutes));
    endHour = Math.max(21, Math.min(23, Math.ceil(maxEndMin / 60) + 1));
  }
  const totalHours = endHour - startHour;
  const totalMinutes = totalHours * 60;

  // Layout dimensions (logical CSS pixels, rendered at 2x DPI)
  const SCALE = 2;
  const TIME_COL_W = 68;
  const DAY_COL_W = 196;
  const HEADER_H = 42;
  const SLOT_H = 54;
  const GRID_W = TIME_COL_W + DAYS.length * DAY_COL_W;
  const GRID_H = HEADER_H + totalHours * SLOT_H;

  const canvas = document.createElement('canvas');
  canvas.width = GRID_W * SCALE;
  canvas.height = GRID_H * SCALE;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.scale(SCALE, SCALE);
  ctx.textBaseline = 'middle';

  const MONO_FONT = '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace';
  const SANS_FONT = '"Space Grotesk", "Inter", system-ui, -apple-system, sans-serif';

  // 1. Base Canvas Background
  ctx.fillStyle = '#F7F6F2';
  ctx.fillRect(0, 0, GRID_W, GRID_H);

  // 2. Header Row (HORA | Lunes (5h) | ... | Sábado)
  ctx.fillStyle = '#E8E6E0';
  ctx.fillRect(0, 0, GRID_W, HEADER_H);

  // Header HORA label
  ctx.fillStyle = '#5A5852';
  ctx.font = `600 11px ${MONO_FONT}`;
  ctx.textAlign = 'center';
  ctx.fillText('HORA', TIME_COL_W / 2, HEADER_H / 2);

  // Header Day columns
  DAYS.forEach((day, idx) => {
    const x = TIME_COL_W + idx * DAY_COL_W;
    const hrs = dayHoursMap[day] || 0;
    const dayTitle = DAY_NAMES[day];

    ctx.textAlign = 'center';
    if (hrs > 0) {
      ctx.font = `700 13.5px ${SANS_FONT}`;
      const titleW = ctx.measureText(dayTitle).width;
      ctx.font = `600 11.5px ${MONO_FONT}`;
      const hrsText = `(${hrs}h)`;
      const hrsW = ctx.measureText(hrsText).width;
      const gap = 5;
      const startX = x + DAY_COL_W / 2 - (titleW + gap + hrsW) / 2;

      ctx.textAlign = 'left';
      ctx.fillStyle = '#141416';
      ctx.font = `700 13.5px ${SANS_FONT}`;
      ctx.fillText(dayTitle, startX, HEADER_H / 2);

      ctx.fillStyle = '#5A5852';
      ctx.font = `600 11.5px ${MONO_FONT}`;
      ctx.fillText(hrsText, startX + titleW + gap, HEADER_H / 2);
    } else {
      ctx.fillStyle = '#141416';
      ctx.font = `700 13.5px ${SANS_FONT}`;
      ctx.fillText(dayTitle, x + DAY_COL_W / 2, HEADER_H / 2);
    }
  });

  // 3. Time Labels Column Background
  ctx.fillStyle = '#ECEAE4';
  ctx.fillRect(0, HEADER_H, TIME_COL_W, totalHours * SLOT_H);

  // 4. Hour Horizontal Gridlines & Labels
  for (let i = 0; i < totalHours; i++) {
    const y = HEADER_H + i * SLOT_H;
    const hourStr = `${(startHour + i).toString().padStart(2, '0')}:00`;

    ctx.fillStyle = '#5A5852';
    ctx.font = `500 11px ${MONO_FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(hourStr, TIME_COL_W / 2, y + 6);

    // Horizontal line across entire grid
    ctx.strokeStyle = '#D4D1C9';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, y + 0.5);
    ctx.lineTo(GRID_W, y + 0.5);
    ctx.stroke();
  }

  // Header bottom border (stronger hairline)
  ctx.strokeStyle = '#B8B5AD';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, HEADER_H + 0.5);
  ctx.lineTo(GRID_W, HEADER_H + 0.5);
  ctx.stroke();

  // Vertical Day Column Dividers
  for (let i = 0; i <= DAYS.length; i++) {
    const x = TIME_COL_W + i * DAY_COL_W;
    ctx.strokeStyle = '#C6C3BB';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x + 0.5, 0);
    ctx.lineTo(x + 0.5, GRID_H);
    ctx.stroke();
  }

  // Outer Frame Border
  ctx.strokeStyle = '#18181A';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(0.75, 0.75, GRID_W - 1.5, GRID_H - 1.5);

  // 5. Render Scheduled Course Blocks
  ctx.textBaseline = 'top';
  DAYS.forEach((day, dayIdx) => {
    const dayBlocks = blocks.filter(b => b.day === day);
    const colX = TIME_COL_W + dayIdx * DAY_COL_W;

    dayBlocks.forEach(block => {
      const topRatio = (block.startMinutes - startHour * 60) / totalMinutes;
      const heightRatio = Math.max((block.endMinutes - block.startMinutes) / totalMinutes, 0.04);

      const bx = colX + 3;
      const bw = DAY_COL_W - 6;
      const by = HEADER_H + topRatio * (totalHours * SLOT_H) + 1.5;
      const bh = heightRatio * (totalHours * SLOT_H) - 3;

      const pigment = getGraftonPigment(block.course.code);
      const isLab = isLaboratorySession(block.sessionGroup);
      const durationMinutes = block.endMinutes - block.startMinutes;

      // Subtle tactile shadow
      ctx.fillStyle = 'rgba(24, 24, 26, 0.07)';
      ctx.fillRect(bx + 1.5, by + 1.5, bw, bh);

      // Block background fill
      ctx.fillStyle = pigment.bg;
      ctx.fillRect(bx, by, bw, bh);

      // Crisp 45° diagonal hatch pattern for Laboratory / Practice blocks
      if (isLab) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(bx, by, bw, bh);
        ctx.clip();

        ctx.strokeStyle = pigment.hatch;
        ctx.lineWidth = 3.5;
        const step = 11;
        for (let d = -bh; d < bw + bh; d += step) {
          ctx.beginPath();
          ctx.moveTo(bx + d, by + bh);
          ctx.lineTo(bx + d + bh, by);
          ctx.stroke();
        }
        ctx.restore();
      }

      // Crisp 1px border
      ctx.strokeStyle = pigment.border;
      ctx.lineWidth = 1.25;
      ctx.strokeRect(bx + 0.5, by + 0.5, bw - 1, bh - 1);

      // Solid 4px left accent bar
      ctx.fillStyle = pigment.bar;
      ctx.fillRect(bx, by, 4, bh);

      // Inner content padding
      const padLeft = bx + 9;
      const padRight = bx + bw - 6;
      const innerW = padRight - padLeft;
      let cursorY = by + 6;

      // Room Pill
      const roomLabel = formatCompactRoom(block.location);
      ctx.font = `700 10px ${MONO_FONT}`;
      const pillTextW = ctx.measureText(roomLabel).width;
      const pillW = Math.min(innerW, pillTextW + 10);
      const pillH = 16;

      ctx.fillStyle = '#FAF9F5';
      ctx.fillRect(padLeft, cursorY, pillW, pillH);
      ctx.strokeStyle = '#9E9B93';
      ctx.lineWidth = 1;
      ctx.strokeRect(padLeft + 0.5, cursorY + 0.5, pillW - 1, pillH - 1);

      ctx.fillStyle = '#141416';
      ctx.textAlign = 'left';
      ctx.fillText(roomLabel, padLeft + 5, cursorY + 3, innerW - 8);
      cursorY += pillH + 5;

      // Course Title
      ctx.fillStyle = pigment.text;
      ctx.font = `700 12px ${SANS_FONT}`;
      const maxTitleLines = durationMinutes <= 60 ? 1 : 2;
      const titleLines = wrapText(ctx, block.course.name, innerW, maxTitleLines);
      titleLines.forEach(line => {
        if (cursorY + 14 <= by + bh - 18) {
          ctx.fillText(line, padLeft, cursorY);
          cursorY += 14.5;
        }
      });

      // Bottom Section: Meta row (Code · Badge) + Time range
      const timeY = by + bh - 16;
      ctx.fillStyle = pigment.text;
      ctx.font = `700 10.5px ${MONO_FONT}`;
      const timeStr =
        durationMinutes <= 60
          ? `${block.course.code} · ${block.startTime}–${block.endTime}`
          : `${block.startTime}–${block.endTime}`;
      ctx.fillText(timeStr, padLeft, timeY);

      if (durationMinutes > 60 && timeY - 22 > cursorY) {
        const metaY = timeY - 21;
        const codeStr = `${block.course.code} ·`;
        ctx.font = `600 10.5px ${MONO_FONT}`;
        ctx.fillStyle = pigment.subtext;
        ctx.fillText(codeStr, padLeft, metaY + 2);
        const codeW = ctx.measureText(codeStr).width;

        const kindLabel = formatSessionTypeLabel(block.sessionGroup);
        ctx.font = `700 10px ${SANS_FONT}`;
        const badgeTextW = ctx.measureText(kindLabel).width;
        const badgeW = badgeTextW + 10;
        const badgeX = padLeft + codeW + 4;

        if (badgeX + badgeW <= padRight) {
          ctx.fillStyle = '#FAF9F5';
          ctx.fillRect(badgeX, metaY, badgeW, 16);
          ctx.strokeStyle = pigment.border;
          ctx.lineWidth = 1;
          ctx.strokeRect(badgeX + 0.5, metaY + 0.5, badgeW - 1, 15);
          ctx.fillStyle = pigment.text;
          ctx.fillText(kindLabel, badgeX + 5, metaY + 3);
        }
      }
    });
  });

  // Trigger download
  const dataUrl = canvas.toDataURL('image/png');
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = `Horario_UTEC_${optionName.replace(/\s+/g, '_')}.png`;
  a.click();
}

