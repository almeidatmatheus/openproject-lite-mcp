// custom fields: discovered from the work package schema (per project + type), read, written and filtered by name

import { op, all, href, idOf, type J } from './op.ts';
import { fail, pick, norm, day } from './lib.ts';
import { memo, types, user } from './ref.ts';
import { clean } from './fmt.ts';

export type CF = { key: string; id: number; name: string; type: string; multi: boolean; allowed?: J[]; allowedHref?: string };

export const schema = (pid: number, tid: number): Promise<J> => memo(`sc${pid}-${tid}`, () => op('GET', `/work_packages/schemas/${pid}-${tid}`));

export function fields(sc: J): CF[] {
  return Object.entries(sc ?? {})
    .filter(([k]) => /^customField\d+$/.test(k))
    .map(([key, v]: [string, J]) => ({
      key,
      id: Number(key.slice(11)),
      name: v.name,
      type: String(v.type ?? '').replace(/^\[\]/, ''),
      multi: String(v.type ?? '').startsWith('[]'),
      allowed: v._embedded?.allowedValues,
      allowedHref: v._links?.allowedValues?.href,
    }));
}

// union of the custom fields of every type in a project (for filters)
export async function projectFields(pid: number): Promise<CF[]> {
  const seen = new Map<string, CF>();
  for (const t of await types(pid)) {
    try { for (const f of fields(await schema(pid, t.id))) seen.set(f.key, f); } catch { /* type without schema */ }
  }
  return [...seen.values()];
}

const LINK_TYPES = new Set(['CustomOption', 'User', 'Version', 'Principal', 'Group']);

// "Nome=valor; Outro=x" (or one per line). '' after = clears.
export function parse(s: string): [string, string][] {
  return s.split(/[;\n]+/).map(p => p.trim()).filter(Boolean).map(p => {
    const i = p.indexOf('=');
    if (i < 1) fail(`campo inválido "${p}" (use Nome=valor; Outro=valor)`);
    return [p.slice(0, i).trim(), p.slice(i + 1).trim()];
  });
}

async function options(f: CF): Promise<J[]> {
  if (f.allowed?.length) return f.allowed;
  if (!f.allowedHref) return [];
  return memo('ao' + f.allowedHref, () => all(f.allowedHref!.replace(/^.*\/api\/v3/, '')));
}
const optName = (o: J) => o.value ?? o.name ?? '';

// writes into body / body._links
export async function apply(body: J, spec: string, pid: number, tid: number): Promise<void> {
  const fs = fields(await schema(pid, tid));
  for (const [name, raw] of parse(spec)) {
    const f = fs.find(x => x.key === name || String(x.id) === name.replace(/^cf/i, '')) ?? pick(fs, x => x.name, name, 'campo');
    const empty = raw === '' || ['limpar', 'nenhum', 'nenhuma'].includes(norm(raw));
    if (LINK_TYPES.has(f.type)) {
      body._links ??= {};
      const vals = empty ? [] : f.multi ? raw.split(',').map(s => s.trim()).filter(Boolean) : [raw];
      const hrefs: (string | null)[] = [];
      for (const v of vals) {
        if (f.type === 'User' || f.type === 'Principal') { const u = await user(v, pid); hrefs.push(u ? href(u) : null); }
        else { const opts = await options(f); hrefs.push(href(opts.find(o => String(o.id) === v) ?? pick(opts, optName, v, `opção de ${f.name}`))); }
      }
      body._links[f.key] = f.multi ? hrefs.map(h => ({ href: h })) : { href: hrefs[0] ?? null };
      continue;
    }
    if (empty) { body[f.key] = null; continue; }
    switch (f.type) {
      case 'Integer': { const n = Number(raw); if (!Number.isInteger(n)) fail(`${f.name} deve ser inteiro`); body[f.key] = n; break; }
      case 'Float': { const n = Number(raw.replace(',', '.')); if (!Number.isFinite(n)) fail(`${f.name} deve ser número`); body[f.key] = n; break; }
      case 'Boolean': body[f.key] = ['true', 'sim', '1', 'yes', 's'].includes(norm(raw)); break;
      case 'Date': body[f.key] = day(raw); break;
      case 'Formattable': body[f.key] = { format: 'markdown', raw }; break;
      default: body[f.key] = raw;
    }
  }
}

// "Nome: valor" lines for rd
export async function show(w: J): Promise<string[]> {
  const pid = idOf(w._links?.project?.href), tid = idOf(w._links?.type?.href);
  let fs: CF[];
  try { fs = fields(await schema(pid, tid)); } catch { return []; }
  const out: string[] = [];
  for (const f of fs) {
    let v: unknown = w[f.key];
    const l = w._links?.[f.key];
    if (Array.isArray(l)) v = l.map((x: J) => x.title).filter(Boolean).join(', ');
    else if (l && l.href) v = l.title ?? idOf(l.href);
    else if (v && typeof v === 'object') v = clean((v as J).raw ?? (v as J).html, 500);
    if (v !== undefined && v !== null && v !== '') out.push(`${f.name}: ${v}`);
  }
  return out;
}

// ls filter: "Nome=valor" -> customFieldN filter (text: contains; lists/users: equals)
export async function filter(spec: string, pid: number): Promise<J[]> {
  const fs = await projectFields(pid);
  const out: J[] = [];
  for (const [name, raw] of parse(spec)) {
    const f = fs.find(x => x.key === name) ?? pick(fs, x => x.name, name, 'campo');
    let v = raw, oper = '=';
    if (raw === '') { out.push({ [f.key]: { operator: '!*', values: [] } }); continue; }
    if (f.type === 'CustomOption') { const opts = await options(f); v = String((opts.find(o => String(o.id) === raw) ?? pick(opts, optName, raw, `opção de ${f.name}`)).id); }
    else if (f.type === 'User' || f.type === 'Principal') v = String(idOf(href(await user(raw, pid))));
    else if (f.type === 'Date') v = day(raw)!;
    else if (f.type === 'Boolean') v = ['true', 'sim', '1', 's'].includes(norm(raw)) ? 't' : 'f';
    else if (f.type === 'String' || f.type === 'Formattable') oper = '~';
    out.push({ [f.key]: { operator: oper, values: [v] } });
  }
  return out;
}
