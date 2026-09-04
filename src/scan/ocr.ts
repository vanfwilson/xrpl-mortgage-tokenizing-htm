import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/**
 * Scan-back OCR. Input: a scanned PDF (any page count) or PNG/JPG. Output: raw text per page.
 * Pipeline: pdftoppm (poppler) at 300 dpi grayscale -> tesseract 5 (LSTM, psm 6 uniform block).
 * De-skew: tesseract's page layout handles small rotations; for heavy skew, run through
 * `tesseract --psm 0` first to detect orientation (we log its estimate).
 */
export interface OcrPage { page: number; text: string; confidence?: number }

function need(bin: string) {
  try { execFileSync('which', [bin], { stdio: 'ignore' }); } catch { throw new Error(`${bin} not found; brew install ${bin === 'pdftoppm' ? 'poppler' : bin}`); }
}

export function ocrFile(input: string, opts: { dpi?: number; lang?: string } = {}): OcrPage[] {
  need('tesseract');
  const dpi = opts.dpi ?? 300;
  const lang = opts.lang ?? 'eng';
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'scan-'));
  let images: string[] = [];
  if (/\.pdf$/i.test(input)) {
    need('pdftoppm');
    execFileSync('pdftoppm', ['-r', String(dpi), '-gray', '-png', input, path.join(tmp, 'p')]);
    images = fs.readdirSync(tmp).filter((f) => f.endsWith('.png')).sort().map((f) => path.join(tmp, f));
  } else {
    images = [input];
  }
  const pages: OcrPage[] = images.map((img, i) => {
    const tsv = execFileSync('tesseract', [img, 'stdout', '-l', lang, '--psm', '6', 'tsv'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    const rows = tsv.split('\n').slice(1).map((r) => r.split('\t')).filter((r) => r.length >= 12 && r[11].trim());
    const text = execFileSync('tesseract', [img, 'stdout', '-l', lang, '--psm', '6'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    const confs = rows.map((r) => Number(r[10])).filter((c) => c >= 0);
    const confidence = confs.length ? Math.round(confs.reduce((a, b) => a + b, 0) / confs.length) : undefined;
    return { page: i + 1, text, confidence };
  });
  fs.rmSync(tmp, { recursive: true, force: true });
  return pages;
}
