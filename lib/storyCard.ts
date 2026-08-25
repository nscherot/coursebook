// Renders a 1080x1920 Instagram-Story-sized share card on a canvas.
// Pure client-side; returns a PNG blob. No external assets except the
// scorecard photo (loaded with CORS from Supabase public storage).

export type StoryCardData = {
  rank: number;
  listTitle: string;      // "Nate's Top 50"
  courseName: string;
  location: string;
  playedOn: string | null; // "2026-08-07"
  score: number | null;
  note?: string;
  photoUrl: string | null; // scorecard photo (public URL) or null
  siteName?: string;       // "Coursebook"
};

const W = 1080;
const H = 1920;

// Palette (matches the site)
const INK = "#14130f";
const CREAM = "#fcfcfb";
const CREAM2 = "#f4f3ef";
const GREEN = "#14684a";
const GREEN_DARK = "#0d4733";
const MUTED = "#8a887f";
const BORDER = "#e3e1d9";

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

function fmtDate(iso: string | null): string {
  if (!iso) return "";
  try {
    const d = new Date(iso + "T12:00:00");
    return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  } catch {
    return iso;
  }
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function fitText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, startPx: number, minPx: number, font: (px: number) => string): number {
  let px = startPx;
  ctx.font = font(px);
  while (ctx.measureText(text).width > maxWidth && px > minPx) {
    px -= 4;
    ctx.font = font(px);
  }
  return px;
}

export async function renderStoryCard(data: StoryCardData): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  const serif = (px: number) => `600 ${px}px Georgia, "Times New Roman", serif`;
  const serifBold = (px: number) => `700 ${px}px Georgia, "Times New Roman", serif`;
  const sans = (px: number) => `500 ${px}px -apple-system, "Helvetica Neue", Arial, sans-serif`;
  const sansBold = (px: number) => `700 ${px}px -apple-system, "Helvetica Neue", Arial, sans-serif`;

  // ---- background: deep green with subtle vertical tone shift ----
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, GREEN_DARK);
  bg.addColorStop(0.5, GREEN);
  bg.addColorStop(1, GREEN_DARK);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // faint contour rings (golf-green vibe)
  ctx.strokeStyle = "rgba(252,252,251,0.06)";
  ctx.lineWidth = 3;
  for (let i = 0; i < 7; i++) {
    ctx.beginPath();
    ctx.ellipse(W / 2, H - 180, 200 + i * 130, 90 + i * 60, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  // ---- safe margins: keep content within y 250..1670 ----
  const M = 84; // side margin
  const cardX = M, cardW = W - M * 2;

  // ---- cream content card ----
  const cardY = 280, cardH = 1330;
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.35)";
  ctx.shadowBlur = 40;
  ctx.shadowOffsetY = 16;
  roundRect(ctx, cardX, cardY, cardW, cardH, 36);
  ctx.fillStyle = CREAM;
  ctx.fill();
  ctx.restore();

  // ---- rank badge overlapping card top ----
  const badgeR = 110;
  const badgeCX = W / 2, badgeCY = cardY + 10;
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.3)";
  ctx.shadowBlur = 24;
  ctx.beginPath();
  ctx.arc(badgeCX, badgeCY, badgeR, 0, Math.PI * 2);
  ctx.fillStyle = GREEN;
  ctx.fill();
  ctx.restore();
  ctx.lineWidth = 10;
  ctx.strokeStyle = CREAM;
  ctx.beginPath();
  ctx.arc(badgeCX, badgeCY, badgeR, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = CREAM;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const rankText = `#${data.rank}`;
  const rankPx = fitText(ctx, rankText, badgeR * 1.5, 96, 56, serifBold);
  ctx.font = serifBold(rankPx);
  ctx.fillText(rankText, badgeCX, badgeCY + 6);

  // ---- list title above card, below badge? -> under badge inside card ----
  let y = cardY + badgeR + 70;
  ctx.fillStyle = MUTED;
  ctx.font = sansBold(34);
  ctx.fillText(data.listTitle.toUpperCase(), W / 2, y);
  y += 84;

  // ---- course name ----
  ctx.fillStyle = INK;
  const namePx = fitText(ctx, data.courseName, cardW - 120, 92, 52, serif);
  ctx.font = serif(namePx);
  // wrap to 2 lines if needed even after shrink
  const words = data.courseName.split(" ");
  if (ctx.measureText(data.courseName).width > cardW - 120 && words.length > 1) {
    const mid = Math.ceil(words.length / 2);
    const l1 = words.slice(0, mid).join(" ");
    const l2 = words.slice(mid).join(" ");
    ctx.fillText(l1, W / 2, y);
    y += namePx + 14;
    ctx.fillText(l2, W / 2, y);
  } else {
    ctx.fillText(data.courseName, W / 2, y);
  }
  y += 74;

  // ---- location ----
  ctx.fillStyle = MUTED;
  const locPx = fitText(ctx, data.location, cardW - 160, 40, 28, sans);
  ctx.font = sans(locPx);
  ctx.fillText(data.location, W / 2, y);
  y += 80;

  // ---- photo (polaroid) or fallback flag art ----
  const photoAreaH = 620;
  if (data.photoUrl) {
    try {
      const img = await loadImage(data.photoUrl);
      const frameW = cardW - 160;
      const frameH = photoAreaH;
      const frameX = (W - frameW) / 2;
      const frameY = y;
      ctx.save();
      ctx.translate(W / 2, frameY + frameH / 2);
      ctx.rotate(-0.015);
      ctx.translate(-W / 2, -(frameY + frameH / 2));
      ctx.save();
      ctx.shadowColor = "rgba(0,0,0,0.25)";
      ctx.shadowBlur = 30;
      ctx.shadowOffsetY = 10;
      ctx.fillStyle = "#ffffff";
      roundRect(ctx, frameX, frameY, frameW, frameH, 12);
      ctx.fill();
      ctx.restore();
      const pad = 22;
      const iw = frameW - pad * 2;
      const ih = frameH - pad * 2 - 40;
      const scale = Math.max(iw / img.width, ih / img.height);
      const sw = iw / scale, sh = ih / scale;
      const sx = (img.width - sw) / 2, sy = (img.height - sh) / 2;
      ctx.save();
      roundRect(ctx, frameX + pad, frameY + pad, iw, ih, 8);
      ctx.clip();
      ctx.drawImage(img, sx, sy, sw, sh, frameX + pad, frameY + pad, iw, ih);
      ctx.restore();
      ctx.fillStyle = MUTED;
      ctx.font = sans(26);
      ctx.fillText("the proof ⛳", W / 2, frameY + frameH - 26);
      ctx.restore();
    } catch {
      drawFlagArt(ctx, y, photoAreaH);
    }
  } else {
    drawFlagArt(ctx, y, photoAreaH);
  }
  y += photoAreaH + 88;

  // ---- date + score row ----
  const dateStr = fmtDate(data.playedOn);
  const hasScore = data.score != null;
  if (hasScore) {
    ctx.fillStyle = MUTED;
    ctx.font = sansBold(30);
    ctx.fillText(dateStr ? `PLAYED ${dateStr.toUpperCase()}` : "ROUND LOGGED", W / 2, y);
    y += 96;
    ctx.fillStyle = GREEN;
    ctx.font = serifBold(150);
    const scoreStr = String(data.score);
    ctx.fillText(scoreStr, W / 2, y + 10);
    const sw2 = ctx.measureText(scoreStr).width;
    ctx.fillStyle = MUTED;
    ctx.font = sans(34);
    ctx.textAlign = "left";
    ctx.fillText("shot", W / 2 - sw2 / 2 - 90, y + 8);
    ctx.textAlign = "center";
    y += 90;
  } else {
    ctx.fillStyle = MUTED;
    ctx.font = sansBold(30);
    ctx.fillText(dateStr ? `PLAYED ${dateStr.toUpperCase()}` : "", W / 2, y + 20);
    y += 110;
  }

  // ---- footer branding on green ----
  ctx.fillStyle = CREAM;
  ctx.font = serifBold(44);
  ctx.fillText(`⛳ ${data.siteName || "Coursebook"}`, W / 2, cardY + cardH + 96);
  ctx.fillStyle = "rgba(252,252,251,0.75)";
  ctx.font = sans(28);
  ctx.fillText("rank the courses you've played", W / 2, cardY + cardH + 150);

  return new Promise((resolve) => canvas.toBlob((b) => resolve(b!), "image/png"));
}

function drawFlagArt(ctx: CanvasRenderingContext2D, y: number, h: number) {
  // Simple flag-on-green illustration when there's no photo.
  const cx = W / 2, base = y + h - 60;
  ctx.save();
  ctx.fillStyle = CREAM2;
  roundRect(ctx, (W - (W - 244)) / 2, y, W - 244, h, 12);
  ctx.fill();
  ctx.strokeStyle = BORDER;
  ctx.lineWidth = 2;
  roundRect(ctx, (W - (W - 244)) / 2, y, W - 244, h, 12);
  ctx.stroke();
  // green mound
  ctx.fillStyle = "#cfe0d5";
  ctx.beginPath();
  ctx.ellipse(cx, base, 300, 70, 0, 0, Math.PI * 2);
  ctx.fill();
  // hole
  ctx.fillStyle = "#5a6e63";
  ctx.beginPath();
  ctx.ellipse(cx + 60, base - 6, 26, 10, 0, 0, Math.PI * 2);
  ctx.fill();
  // pole
  ctx.strokeStyle = "#8a887f";
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.moveTo(cx + 60, base - 10);
  ctx.lineTo(cx + 60, y + 110);
  ctx.stroke();
  // flag
  ctx.fillStyle = GREEN;
  ctx.beginPath();
  ctx.moveTo(cx + 64, y + 110);
  ctx.lineTo(cx + 234, y + 152);
  ctx.lineTo(cx + 64, y + 194);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}
