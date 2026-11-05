// tabular output and text cleanup

import type { J } from './op.ts';

const cell = (v: unknown) => (v === null || v === undefined ? '' : String(v).replace(/\s+/g, ' ').replace(/\|/g, '/').trim());
export const table = (cols: string[], rows: unknown[][]) => [cols.join('|'), ...rows.map(r => r.map(cell).join('|'))].join('\n');

export const cut = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + '…' : s);

export function clean(s?: string | null, max = 4000): string {
  if (!s) return '';
  const t = s
    .replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|div|li|h\d|tr)>/gi, '\n').replace(/<li[^>]*>/gi, '- ').replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '[imagem]')
    .replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  return t.length > max ? `${t.slice(0, max)}\n…(+${t.length - max} caracteres; use modo completo)` : t;
}

export const L = (x: J, k: string): string => x?._links?.[k]?.title ?? '';

export const WP_COLS = ['id', 'tipo', 'status', 'prio', 'resp', 'fim', '%', 'assunto'];
export const wpRow = (w: J) => [w.id, L(w, 'type'), L(w, 'status'), L(w, 'priority'), L(w, 'assignee'), w.dueDate ?? w.date, w.percentageDone, cut(w.subject ?? '', 80)];
