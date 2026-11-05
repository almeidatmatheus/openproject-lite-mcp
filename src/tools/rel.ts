import type { Tool } from './index.ts';
import { S } from './s.ts';
import { op, idOf, OpErr, type J } from '../op.ts';
import { fail } from '../lib.ts';
import { table, cut, L } from '../fmt.ts';
import { st, one } from '../ids.ts';
import { titles } from '../wp.ts';

// pt name -> API type (from the perspective of the first work package)
const TYPES: Record<string, string> = {
  bloqueia: 'blocks', bloqueado_por: 'blocked',
  precede: 'precedes', segue: 'follows',
  requer: 'requires', requerido_por: 'required',
  inclui: 'includes', parte_de: 'partof',
  duplica: 'duplicates', duplicado_por: 'duplicated',
  relaciona: 'relates',
};
const PT = Object.fromEntries(Object.entries(TYPES).map(([k, v]) => [v, k]));

// relation seen from work package `id`
function view(id: number, r: J) {
  const from = idOf(r._links?.from?.href), to = idOf(r._links?.to?.href);
  const mine = from === id;
  const type = mine ? r.type : (r.reverseType ?? r.type);
  const other = mine ? to : from;
  return { rid: r.id, type: PT[type] ?? type, other, title: L(r, mine ? 'to' : 'from'), lag: r.lag ?? r.delay ?? '' };
}

export const relTable = (id: number, rels: J[]) =>
  table(['rel', 'tipo', 'wp', 'lag'], rels.map(r => { const v = view(id, r); return [v.rid, v.type, `#${v.other} ${cut(v.title, 50)}`, v.lag]; }));

export const rel: Tool = {
  name: 'rel',
  description: 'Relações/dependências entre work packages: listar, criar (bloqueia, precede, requer, relaciona...) ou remover. O tipo é lido a partir do id: "#12 bloqueia #15".',
  write: true,
  inputSchema: {
    type: 'object',
    properties: {
      acao: { type: 'string', enum: ['listar', 'criar', 'remover'], description: 'padrão: listar' },
      id: S.id,
      tipo: { type: 'string', enum: Object.keys(TYPES), description: 'criar: id <tipo> para. precede = para só começa depois de id' },
      para: { type: 'string', description: 'criar/remover: id do outro WP' },
      rel: { type: 'integer', minimum: 1, description: 'remover: id da relação (coluna rel do listar); alternativa a para' },
      lag: { type: 'integer', minimum: 0, description: 'criar precede/segue: dias de folga entre os dois' },
      nota: { type: 'string', description: 'criar: descrição da relação' },
      cf: S.cf,
    },
  },
  readOnly: a => (a.acao ?? 'listar') === 'listar',
  async preview(a) {
    const id = one(a.id);
    if (a.acao === 'criar') return `criar relação: #${id} ${a.tipo ?? '?'} #${a.para ?? '?'}\n${await titles([id, ...(a.para ? [one(a.para)] : [])])}`;
    return `remover relação ${a.rel ? '#' + a.rel : `entre #${id} e #${a.para ?? '?'}`}`;
  },
  async run(a) {
    const id = one(a.id);
    const acao = a.acao ?? 'listar';
    if (acao === 'listar') {
      const els = await list(id);
      st.atual = id;
      return els.length ? `${els.length} relações de #${id}\n${relTable(id, els)}` : `#${id} não tem relações`;
    }
    if (acao === 'criar') {
      if (!a.tipo) fail('informe tipo');
      if (!a.para) fail('informe para (id do outro WP)');
      const to = one(a.para);
      if (to === id) fail('um WP não pode se relacionar com ele mesmo');
      const body: J = { type: TYPES[a.tipo], _links: { to: { href: `/api/v3/work_packages/${to}` } } };
      if (a.nota) body.description = a.nota;
      if (a.lag !== undefined) body.lag = a.lag;
      let r: J;
      try {
        r = await op('POST', `/work_packages/${id}/relations`, body);
      } catch (e) {
        // OpenProject < 14 calls it "delay"
        if (!(e instanceof OpErr && e.status === 422 && a.lag !== undefined && /lag/i.test(e.message))) throw e;
        delete body.lag; body.delay = a.lag;
        r = await op('POST', `/work_packages/${id}/relations`, body);
      }
      st.atual = id;
      return `relação ${r.id} criada: #${id} ${a.tipo} #${to}`;
    }
    // remover
    let rid = a.rel as number | undefined;
    if (!rid) {
      if (!a.para) fail('informe rel ou para');
      const to = one(a.para);
      const hits = (await list(id)).filter(r => view(id, r).other === to);
      if (!hits.length) fail(`#${id} não tem relação com #${to}`);
      if (hits.length > 1) fail(`há ${hits.length} relações entre #${id} e #${to}; informe rel: ${hits.map(r => `${r.id} (${view(id, r).type})`).join(', ')}`);
      rid = hits[0].id;
    }
    await op('DELETE', `/relations/${rid}`);
    return `relação ${rid} removida`;
  },
};

async function list(id: number): Promise<J[]> {
  const r = await op('GET', `/work_packages/${id}/relations`);
  return r?._embedded?.elements ?? [];
}
