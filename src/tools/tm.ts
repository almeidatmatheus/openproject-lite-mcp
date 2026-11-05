import type { Tool } from './index.ts';
import { S } from './s.ts';
import { op, all, href, idOf, OpErr, type J } from '../op.ts';
import { day, iso, hours, ymd, addDays, pick, fail } from '../lib.ts';
import { table, cut, L, clean } from '../fmt.ts';
import { st, one } from '../ids.ts';
import { user, isMe } from '../ref.ts';
import { titles } from '../wp.ts';

export const tm: Tool = {
  name: 'tm',
  description: 'Horas: listar lançamentos (padrão: meus, esta semana) ou lançar horas em um work package.',
  write: true,
  inputSchema: {
    type: 'object',
    properties: {
      acao: { type: 'string', enum: ['listar', 'lancar'], description: 'padrão: listar' },
      periodo: { type: 'string', enum: ['hoje', 'semana', 'semana_passada', 'mes', 'mes_passado'], description: 'listar: padrão semana' },
      quem: { type: 'string', description: "listar: 'eu' (padrão), 'todos' ou nome" },
      id: { ...S.id, description: "WP: em lancar é obrigatório na prática (padrão atual); em listar filtra por WP" },
      horas: { type: 'number', minimum: 0.01, maximum: 24, description: 'lancar: horas (1.5 = 1h30)' },
      data: { type: 'string', description: 'lancar: dia (padrão hoje; AAAA-MM-DD, DD/MM, ontem, -2)' },
      comentario: { type: 'string', description: 'lancar: comentário' },
      atividade: { type: 'string', description: 'lancar: atividade (ex.: Development), se a instância exigir' },
      cf: S.cf,
    },
  },
  readOnly: a => (a.acao ?? 'listar') === 'listar',
  async preview(a) {
    return `lançar ${a.horas ?? '?'}h em ${day(a.data ?? 'hoje')} no ${await titles([one(a.id)])}${a.comentario ? `\ncomentário: ${a.comentario}` : ''}`;
  },
  async run(a) {
    return (a.acao ?? 'listar') === 'lancar' ? log(a) : list(a);
  },
};

function range(p: string): [string, string] {
  const t = new Date();
  const dow = (t.getDay() + 6) % 7; // monday = 0
  switch (p) {
    case 'hoje': return [ymd(t), ymd(t)];
    case 'semana_passada': return [ymd(addDays(-dow - 7, t)), ymd(addDays(-dow - 1, t))];
    case 'mes': return [ymd(new Date(t.getFullYear(), t.getMonth(), 1)), ymd(t)];
    case 'mes_passado': return [ymd(new Date(t.getFullYear(), t.getMonth() - 1, 1)), ymd(new Date(t.getFullYear(), t.getMonth(), 0))];
    default: return [ymd(addDays(-dow, t)), ymd(t)];
  }
}

const wpLink = (e: J) => e._links?.entity ?? e._links?.workPackage;

async function list(a: J): Promise<string> {
  const [from, to] = range(a.periodo ?? 'semana');
  const f: J[] = [{ spentOn: { operator: '<>d', values: [from, to] } }];
  const quem = a.quem ?? 'eu';
  if (isMe(quem)) f.push({ user: { operator: '=', values: ['me'] } });
  else if (quem.toLowerCase() !== 'todos') f.push({ user: { operator: '=', values: [String(idOf(href(await user(quem))))] } });
  if (a.id !== undefined) f.push({ work_package: { operator: '=', values: [String(one(a.id))] } });
  const els = await all('/time_entries', { filters: f, sortBy: [['spent_on', 'desc']] });
  if (!els.length) return `nenhuma hora de ${from} a ${to}`;
  const total = els.reduce((s, e) => s + (hours(e.hours) ?? 0), 0);
  const rows = els.map(e => [e.spentOn, `#${idOf(wpLink(e)?.href)} ${cut(wpLink(e)?.title ?? '', 40)}`, hours(e.hours), L(e, 'activity'), L(e, 'user'), cut(clean(e.comment?.raw), 60)]);
  return `${els.length} lançamentos · ${Math.round(total * 100) / 100}h · ${from} a ${to}\n${table(['dia', 'wp', 'h', 'atividade', 'quem', 'comentário'], rows)}`;
}

async function log(a: J): Promise<string> {
  if (a.horas === undefined) fail('informe horas');
  const id = one(a.id);
  const wp = `/api/v3/work_packages/${id}`;
  const base: J = { hours: iso(a.horas), spentOn: day(a.data ?? 'hoje'), ...(a.comentario ? { comment: { raw: a.comentario } } : {}) };
  // OpenProject 15+ links time entries to "entity"; older versions use "workPackage"
  for (const key of ['entity', 'workPackage']) {
    const links: J = { [key]: { href: wp } };
    try {
      if (a.atividade) {
        const form = await op('POST', '/time_entries/form', { ...base, _links: links });
        const allowed: J[] = form?._embedded?.schema?.activity?._embedded?.allowedValues ?? [];
        links.activity = { href: href(pick(allowed, x => x.name, a.atividade, 'atividade')) };
      }
      const e = await op('POST', '/time_entries', { ...base, _links: links });
      st.atual = id;
      return `lançado ${hours(e.hours)}h em ${e.spentOn} no #${id}${L(e, 'activity') ? ' · ' + L(e, 'activity') : ''}`;
    } catch (e) {
      if (key === 'entity' && e instanceof OpErr && (e.status === 422 || e.status === 400) && /entity|work ?package/i.test(e.message)) continue;
      throw e;
    }
  }
  return '';
}
