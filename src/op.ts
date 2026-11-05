// minimal OpenProject API v3 client: Basic auth with user "apikey", retry on 429/503, readable errors

import { cfg, fail, UserErr } from './lib.ts';

export type J = any;

export class OpErr extends UserErr {
  status: number;
  constructor(status: number, m: string) { super(m); this.status = status; }
}

export function qs(p: Record<string, unknown>): string {
  const u = new URLSearchParams();
  for (const [k, v] of Object.entries(p)) if (v !== undefined && v !== null) u.set(k, typeof v === 'string' ? v : JSON.stringify(v));
  const s = u.toString();
  return s ? '?' + s : '';
}

const TLS = /SELF_SIGNED|UNABLE_TO_VERIFY|CERT_/;

export async function op(method: string, path: string, body?: unknown): Promise<J> {
  const c = cfg();
  if (!c.url || !c.key) fail('configure OPENPROJECT_URL e OPENPROJECT_API_KEY (veja o README).');
  const url = /^https?:/.test(path) ? path : c.url + (path.startsWith('/api/') ? path : '/api/v3' + path);
  const headers: Record<string, string> = {
    authorization: 'Basic ' + Buffer.from('apikey:' + c.key).toString('base64'),
    accept: 'application/hal+json, application/json',
  };
  if (body !== undefined) headers['content-type'] = 'application/json';
  for (let i = 0; ; i++) {
    let r: Response;
    try {
      r = await fetch(url, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(30_000) });
    } catch (e: any) {
      const why = String(e?.cause?.code ?? e?.cause?.message ?? e?.message ?? e);
      if (i === 0 && method === 'GET' && !TLS.test(why)) continue;
      return fail(`sem conexão com ${c.url}: ${why}` + (TLS.test(why) ? ' — certificado próprio? defina NODE_EXTRA_CA_CERTS=/caminho/ca.pem' : ''));
    }
    if ((r.status === 429 || r.status === 503) && i < 3) {
      await new Promise(s => setTimeout(s, 1000 * (Number(r.headers.get('retry-after')) || 2 ** i)));
      continue;
    }
    const t = await r.text();
    let j: J = null;
    try { j = t ? JSON.parse(t) : null; } catch { /* not json */ }
    if (r.ok) return j;
    throw new OpErr(r.status, errMsg(r.status, j, t));
  }
}

function errMsg(s: number, j: J, t: string): string {
  const base = ({ 401: 'chave API inválida ou expirada', 403: 'sem permissão', 404: 'não encontrado (ou sem acesso)', 409: 'conflito: o item mudou no meio', 422: 'dados inválidos' } as Record<number, string>)[s] ?? `erro ${s}`;
  const errs = j?._embedded?.errors;
  const msgs: string[] = Array.isArray(errs) ? errs.map((e: J) => e.message) : j?.message ? [j.message] : [];
  if (msgs.length) return `${base}: ${msgs.join('; ')}`;
  return j || !t ? base : `${base}: ${t.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 200)}`;
}

// all pages of a collection (reference data; capped)
export async function all(path: string, p: Record<string, unknown> = {}): Promise<J[]> {
  const out: J[] = [];
  for (let off = 1; off <= 20; off++) {
    const r = await op('GET', path + qs({ ...p, pageSize: 500, offset: off }));
    const els: J[] = r?._embedded?.elements ?? [];
    out.push(...els);
    if (!els.length || !r?.total || out.length >= r.total) break;
  }
  return out;
}

export const href = (x: J): string => x?._links?.self?.href;
export const idOf = (h?: string | null): number => (h ? Number(String(h).split('/').pop()) : 0);
