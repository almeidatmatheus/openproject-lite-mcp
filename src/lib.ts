// shared helpers: config, errors, name matching, dates, durations

export function cfg() {
  const e = process.env;
  return {
    url: (e.OPENPROJECT_URL ?? '').trim().replace(/\/+$/, ''),
    key: (e.OPENPROJECT_API_KEY ?? '').trim(),
    project: (e.OPENPROJECT_PROJECT ?? '').trim(),
    confirm: new Set((e.OPENPROJECT_MCP_CONFIRM ?? 'rm').split(',').map(s => s.trim().toLowerCase()).filter(Boolean)),
  };
}

// error shown to the model as-is (no stack)
export class UserErr extends Error {}
export const fail = (m: string): never => { throw new UserErr(m); };

export const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

// fuzzy pick by name: exact > prefix > substring; ambiguous/missing -> error with options
export function pick<T>(items: T[], name: (x: T) => string, q: string, what: string): T {
  const n = norm(q);
  for (const test of [(s: string) => s === n, (s: string) => s.startsWith(n), (s: string) => s.includes(n)]) {
    const hit = items.filter(x => test(norm(name(x))));
    if (hit.length === 1) return hit[0];
    if (hit.length > 1) return fail(`${what} "${q}" ambíguo: ${hit.map(name).slice(0, 30).join(', ')}`);
  }
  return fail(`${what} "${q}" não encontrado. Opções: ${items.map(name).slice(0, 40).join(', ') || '(nenhuma)'}`);
}

const pad = (n: number) => String(n).padStart(2, '0');
export const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const addDays = (n: number, base = new Date()) => { const d = new Date(base); d.setDate(d.getDate() + n); return d; };

// '' / 'limpar' -> null (clears the date)
export function day(s: string): string | null {
  const v = norm(s);
  if (v === '' || v === 'limpar' || v === 'nenhuma') return null;
  if (v === 'hoje') return ymd(new Date());
  if (v === 'amanha') return ymd(addDays(1));
  if (v === 'ontem') return ymd(addDays(-1));
  const rel = /^([+-]\d+)d?$/.exec(v);
  if (rel) return ymd(addDays(Number(rel[1])));
  const br = /^(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?$/.exec(v);
  if (br) return `${br[3] ?? new Date().getFullYear()}-${pad(+br[2])}-${pad(+br[1])}`;
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  return fail(`data inválida "${s}" (use AAAA-MM-DD, DD/MM, hoje, amanha, +3, -1)`);
}

// ISO 8601 duration <-> hours
export function hours(d?: string | null): number | null {
  if (!d) return null;
  const m = /^P(?:(\d+(?:\.\d+)?)D)?(?:T(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?)?$/.exec(d);
  if (!m) return null;
  const h = Number(m[1] ?? 0) * 24 + Number(m[2] ?? 0) + Number(m[3] ?? 0) / 60 + Number(m[4] ?? 0) / 3600;
  return Math.round(h * 100) / 100;
}
export function iso(h: number): string {
  if (!Number.isFinite(h) || h < 0) fail(`horas inválidas: ${h}`);
  const t = Math.round(h * 60);
  return `PT${Math.floor(t / 60)}H${t % 60}M`;
}
export const hfmt = (d?: string | null) => { const h = hours(d); return h === null ? '' : `${h}h`; };
