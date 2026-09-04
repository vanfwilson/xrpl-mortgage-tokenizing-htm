import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb } from 'pdf-lib';

export const usd = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
export const usdPlain = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const mdy = (iso: string) => { const [y, m, d] = iso.split('-'); return `${m}/${d}/${y}`; };

export interface Pen { page: PDFPage; font: PDFFont; bold: PDFFont; size: number }

export async function pens(doc: PDFDocument) {
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  return { font, bold };
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

/** Simple typeset paragraph writer for from-scratch documents. */
export class Writer {
  y: number;
  constructor(public page: PDFPage, public font: PDFFont, public bold: PDFFont, public margin = 54, top = 738) { this.y = top; }
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
  sig(label: string) { this.y -= 28; this.page.drawLine({ start: { x: this.margin, y: this.y }, end: { x: this.margin + 240, y: this.y }, thickness: 0.8 }); this.page.drawText(label, { x: this.margin, y: this.y - 10, size: 8, font: this.font }); }
}
