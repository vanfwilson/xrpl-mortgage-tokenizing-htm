import fs from 'node:fs';
import path from 'node:path';
import fontkit from '@pdf-lib/fontkit';
import { PDFDocument, PDFFont, PDFPage, StandardFonts, degrees, rgb } from 'pdf-lib';

export const BLANK = '____________';
export const usd = (n: number) => (Number.isNaN(n) ? '$' + BLANK : n.toLocaleString('en-US', { style: 'currency', currency: 'USD' }));
export const usdPlain = (n: number) => (Number.isNaN(n) ? BLANK : n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
export const mdy = (iso: string) => { if (!iso || iso.startsWith('_')) return '____/____/______'; const [y, m, d] = iso.split('-'); return `${m}/${d}/${y}`; };

export interface Pen { page: PDFPage; font: PDFFont; bold: PDFFont; size: number }

/** Handwriting fonts (SIL Open Font License, assets/fonts/). Each signer is assigned one hand, consistently. */
const SCRIPT_FONTS = ['Cedarville-Cursive.ttf', 'GreatVibes-Regular.ttf', 'Sacramento-Regular.ttf', 'ReenieBeanie.ttf'];
export interface Pens { font: PDFFont; bold: PDFFont; scripts: PDFFont[] }

export async function pens(doc: PDFDocument): Promise<Pens> {
  doc.registerFontkit(fontkit);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const scripts: PDFFont[] = [];
  for (const f of SCRIPT_FONTS) {
    const fp = path.join('assets', 'fonts', f);
    if (fs.existsSync(fp)) scripts.push(await doc.embedFont(fs.readFileSync(fp), { subset: true }));
  }
  return { font, bold, scripts };
}

/** Which hand a signer uses: stable per name so the same person signs the same way on every page. */
export function handFor(name: string, scripts: PDFFont[]): PDFFont | undefined {
  if (!scripts.length) return undefined;
  let h = 0; for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return scripts[h % scripts.length];
}

/** Draw text at PDF points (origin bottom-left). */
export function text(p: Pen, x: number, y: number, s: string, opts: { size?: number; bold?: boolean; maxWidth?: number } = {}) {
  const f = opts.bold ? p.bold : p.font;
  let size = opts.size ?? p.size;
  if (opts.maxWidth) while (size > 5 && f.widthOfTextAtSize(s, size) > opts.maxWidth) size -= 0.5;
  p.page.drawText(s, { x, y, size, font: f, color: rgb(0, 0, 0) });
}

export function xmark(p: Pen, x: number, y: number, size = 8) {
  p.page.drawText('X', { x, y, size, font: p.bold, color: rgb(0, 0, 0) });
}

/** Footer stamp on every page: synthetic marker + machine-readable anchor for the scanner. */
export function stampPages(doc: PDFDocument, font: PDFFont, anchor: string) {
  const n = doc.getPageCount();
  doc.getPages().forEach((page, i) => {
    const { width } = page.getSize();
    const s = `SYNTHETIC TEST DOCUMENT - NOT A REAL TRANSACTION   |   ${anchor}   |   PAGE ${i + 1}/${n}`;
    page.drawText(s, { x: 24, y: 8, size: 6.5, font, color: rgb(0.35, 0.35, 0.35) });
    page.drawRectangle({ x: width - 60, y: 4, width: 36, height: 12, borderColor: rgb(0, 0, 0), borderWidth: 1 });
  });
}

/**
 * Signature in blue ink: the signer's actual name rendered in a handwriting font, sized to the
 * line, slightly slanted, with a pen underline. Each name gets a consistent hand (font), slant and
 * size from a hash of the name, so Jordan A. Sandbox signs the same way on every page and differently
 * from Jane Q. Placeholder. Clearly synthetic; survives print → scan as a signature-shaped mark.
 */
export function signature(page: PDFPage, name: string, x: number, y: number, width = 150, opts: { date?: string; font?: PDFFont; scripts?: PDFFont[] } = {}) {
  if (!name || name.startsWith('_')) return; // blank template: leave the line unsigned
  const ink = rgb(0.10, 0.22, 0.72);
  let h = 0; for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const hand = opts.scripts ? handFor(name, opts.scripts) : undefined;
  const slant = -2 - (h % 5); // -2° … -6°
  if (hand) {
    let size = 22;
    while (size > 11 && hand.widthOfTextAtSize(name, size) > width) size -= 1;
    const w = hand.widthOfTextAtSize(name, size);
    page.drawText(name, { x: x + 4, y: y + 4, size, font: hand, color: ink, rotate: degrees(slant) });
    page.drawSvgPath(`M 0 0 C ${(w * 0.3).toFixed(1)} -3 ${(w * 0.7).toFixed(1)} 3 ${(w + 6).toFixed(1)} -1 C ${(w + 14).toFixed(1)} -3 ${(w + 8).toFixed(1)} 5 ${(w - 4).toFixed(1)} 4`, { x: x + 2, y: y + 2, borderColor: ink, borderWidth: 0.9, borderLineCap: 1 });
  } else {
    // Fallback if the fonts are missing: a stroke-based scribble.
    const rnd = () => { h = (h * 1664525 + 1013904223) >>> 0; return h / 2 ** 32; };
    const letters = Math.max(6, Math.min(14, name.replace(/[^A-Za-z]/g, '').length)); const step = width / letters;
    let d = `M 0 ${6 + rnd() * 6}`; let cx = 0;
    for (let i = 0; i < letters; i++) { const hh = 8 + rnd() * 18; d += ` C ${(cx + step * 0.3).toFixed(1)} ${(hh + rnd() * 6).toFixed(1)} ${(cx + step * 0.7).toFixed(1)} ${(-2 + rnd() * 5).toFixed(1)} ${(cx + step).toFixed(1)} ${(4 + rnd() * 6).toFixed(1)}`; cx += step; }
    page.drawSvgPath(d, { x, y: y + 26, borderColor: ink, borderWidth: 1.4, borderLineCap: 1 });
  }
  if (opts.date && opts.font) page.drawText(opts.date, { x: x + width + 24, y, size: 9, font: opts.font, color: ink });
}

/** Simple typeset paragraph writer for from-scratch documents. */
export class Writer {
  y: number;
  scripts: PDFFont[] = [];
  constructor(public page: PDFPage, public font: PDFFont, public bold: PDFFont, public margin = 54, top = 738, scripts: PDFFont[] = []) { this.y = top; this.scripts = scripts; }
  get width() { return this.page.getSize().width - this.margin * 2; }
  h(s: string, size = 13) { this.y -= size + 6; this.page.drawText(s, { x: this.margin, y: this.y, size, font: this.bold }); this.y -= 4; }
  kv(k: string, v: string, size = 9.5) { this.y -= size + 3; this.page.drawText(k, { x: this.margin, y: this.y, size, font: this.bold }); this.page.drawText(v, { x: this.margin + 190, y: this.y, size, font: this.font }); }
  p(s: string, size = 9.5) {
    let line = '';
    for (const w of s.split(' ')) {
      const t = line ? `${line} ${w}` : w;
      if (this.font.widthOfTextAtSize(t, size) > this.width) { this.y -= size + 3; this.page.drawText(line, { x: this.margin, y: this.y, size, font: this.font }); line = w; }
      else line = t;
    }
    if (line) { this.y -= size + 3; this.page.drawText(line, { x: this.margin, y: this.y, size, font: this.font }); }
    this.y -= 4;
  }
  row(cols: Array<[number, string, boolean?]>, size = 9) { this.y -= size + 4; for (const [x, s, b] of cols) this.page.drawText(s, { x: this.margin + x, y: this.y, size, font: b ? this.bold : this.font }); }
  rule() { this.y -= 6; this.page.drawLine({ start: { x: this.margin, y: this.y }, end: { x: this.margin + this.width, y: this.y }, thickness: 0.7 }); this.y -= 4; }
  gap(n = 8) { this.y -= n; }
  sig(label: string, signer?: string, date?: string) {
    this.y -= 30;
    if (signer) signature(this.page, signer, this.margin + 6, this.y + 2, 190, { date, font: this.font, scripts: this.scripts });
    this.page.drawLine({ start: { x: this.margin, y: this.y }, end: { x: this.margin + 240, y: this.y }, thickness: 0.8 });
    this.page.drawText(label, { x: this.margin, y: this.y - 10, size: 8, font: this.font });
    this.y -= 14; // keep the next paragraph clear of the label
  }
}
