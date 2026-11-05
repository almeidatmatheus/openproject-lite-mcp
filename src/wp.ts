// work package helpers shared by tools: listing, field patch building, short previews

import { op, qs, href, idOf, type J } from './op.ts';
import { day, iso, norm, fail } from './lib.ts';
import { table, cut, L, WP_COLS, wpRow } from './fmt.ts';
import { st, one } from './ids.ts';
import { status, priority, typeOf, types, version, user } from './ref.ts';

export const SORT: Record<string, string[][]> = {
  atualizado: [['updatedAt', 'desc']],
  fim: [['dueDate', 'asc']],
  prioridade: [['priority', 'desc']],
  criado: [['createdAt', 'desc']],
  id: [['id', 'desc']],
};

export async function listWps(o: { pj: J | null; filters: J[]; sort?: string; n?: number; pag?: number }): Promise<string> {
  const n = o.n ?? 25, pag = o.pag ?? 1;
  const path = o.pj ? `/projects/${o.pj.id}/work_packages` : '/work_packages';
  // filters is always sent: without it OpenProject applies its own default (open only)
  const r = await op('GET', path + qs({ filters: o.filters, sortBy: SORT[o.sort ?? 'atualizado'], pageSize: n, offset: pag }));
  const els: J[] = r?._embedded?.elements ?? [];
  st.lista = els.map(w => w.id);
  if (!els.length) return pag > 1 ? `nada na página ${pag}` : 'nenhum work package';
  const total = r.total ?? els.length;
  const head = `${total} itens · pág ${pag}/${Math.max(1, Math.ceil(total / n))}`;
  return o.pj
    ? `${head}\n${table(WP_COLS, els.map(wpRow))}`
    : `${head}\n${table(['proj', ...WP_COLS], els.map(w => [L(w, 'project'), ...wpRow(w)]))}`;
}

export const getWp = (id: number): Promise<J> => op('GET', `/work_packages/${id}`);

const clears = (v: unknown) => v === '' || ['nenhum', 'nenhuma', 'limpar', 'remover'].includes(norm(String(v)));

// builds the create/update body from tool args; pid = project for members/versions/types
export async function patchFrom(a: J, pid: number, cur?: J): Promise<J> {
  const b: J = {};
  const ln: J = {};
  if (a.assunto !== undefined) b.subject = a.assunto;
  if (a.desc !== undefined) b.description = { format: 'markdown', raw: a.desc };

  let milestone = false;
  if (a.tipo !== undefined) {
    const t = await typeOf(a.tipo, pid);
    ln.type = { href: href(t) };
    milestone = !!t.isMilestone;
  } else if (cur) {
    const t = (await types(pid)).find(x => x.id === idOf(cur._links?.type?.href));
    milestone = !!t?.isMilestone;
  } else {
    const ts = await types(pid);
    const t = ts.find(x => x.isDefault) ?? ts[0];
    if (t) { ln.type = { href: href(t) }; milestone = !!t.isMilestone; }
  }

  if (a.status !== undefined) ln.status = { href: href(await status(a.status)) };
  if (a.prio !== undefined) ln.priority = { href: href(await priority(a.prio)) };
  if (a.resp !== undefined) { const u = await user(a.resp, pid); ln.assignee = { href: u ? href(u) : null }; }
  if (a.versao !== undefined) ln.version = { href: clears(a.versao) ? null : href(await version(a.versao, pid)) };
  if (a.pai !== undefined) ln.parent = { href: clears(a.pai) ? null : `/api/v3/work_packages/${one(a.pai)}` };

  if (milestone) {
    const d = a.fim ?? a.inicio;
    if (d !== undefined) b.date = day(d);
  } else {
    if (a.inicio !== undefined) b.startDate = day(a.inicio);
    if (a.fim !== undefined) b.dueDate = day(a.fim);
  }
  if (a.estimativa !== undefined) b.estimatedTime = a.estimativa === 0 ? null : iso(a.estimativa);
  if (a.pct !== undefined) b.percentageDone = a.pct;
  if (Object.keys(ln).length) b._links = ln;
  return b;
}

// human summary of the field args (for previews and results)
export function changes(a: J): string {
  const names: Record<string, string> = { assunto: 'assunto', tipo: 'tipo', status: 'status', prio: 'prio', resp: 'resp', versao: 'versão', pai: 'pai', inicio: 'início', fim: 'fim', estimativa: 'estimativa(h)', pct: '%' };
  const parts = Object.entries(names).filter(([k]) => a[k] !== undefined).map(([k, n]) => `${n}=${a[k] === '' ? '(limpar)' : a[k]}`);
  if (a.desc !== undefined) parts.push(`descrição (${String(a.desc).length} caracteres)`);
  return parts.join(', ');
}

export async function titles(ids: number[]): Promise<string> {
  const rows = await Promise.all(ids.map(async id => {
    try { const w = await getWp(id); return `#${id} ${cut(w.subject ?? '', 70)} [${L(w, 'status')}]`; }
    catch (e: any) { return `#${id} (${e.message})`; }
  }));
  return rows.join('\n');
}

export function requireSome(a: J, keys: string[]): void {
  if (!keys.some(k => a[k] !== undefined)) fail(`nada para alterar; informe um de: ${keys.join(', ')}`);
}
