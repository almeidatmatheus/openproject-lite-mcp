import type { Tool } from './index.ts';
import { S } from './s.ts';
import { op, idOf, type J } from '../op.ts';
import { hfmt } from '../lib.ts';
import { table, clean, cut, L } from '../fmt.ts';
import { st, one } from '../ids.ts';
import { getWp, listWps } from '../wp.ts';

export const rd: Tool = {
  name: 'rd',
  description: 'Lê um work package: resumo (campos + descrição curta), completo (descrição inteira, anexos, relações), atividade (comentários e mudanças) ou filhos.',
  inputSchema: {
    type: 'object',
    properties: {
      id: S.id,
      modo: { type: 'string', enum: ['resumo', 'completo', 'atividade', 'filhos'], description: 'padrão: resumo' },
      n: { type: 'integer', minimum: 1, maximum: 100, description: 'atividade: últimas N entradas (padrão 20)' },
    },
  },
  async run(a) {
    const id = one(a.id);
    const modo = a.modo ?? 'resumo';
    if (modo === 'filhos') {
      st.atual = id;
      return listWps({ pj: null, filters: [{ parent: { operator: '=', values: [String(id)] } }], sort: 'id', n: 100 });
    }
    if (modo === 'atividade') return activity(id, a.n ?? 20);

    const w = await getWp(id);
    st.atual = id;
    const pai = w._links?.parent?.href ? `#${idOf(w._links.parent.href)} ${cut(L(w, 'parent'), 50)}` : '';
    const lines = [
      `#${w.id} ${L(w, 'type')} · ${L(w, 'status')} · ${L(w, 'priority')}`,
      `assunto: ${w.subject}`,
      kv({ projeto: L(w, 'project'), resp: L(w, 'assignee'), contato: L(w, 'responsible'), autor: L(w, 'author'), versao: L(w, 'version'), pai }),
      kv({
        inicio: w.startDate, fim: w.dueDate, data: w.date, estim: hfmt(w.estimatedTime), restante: hfmt(w.remainingTime),
        gasto: hfmt(w.spentTime), '%': w.percentageDone ?? '',
      }),
      kv({ criado: (w.createdAt ?? '').slice(0, 10), atualizado: (w.updatedAt ?? '').slice(0, 16).replace('T', ' ') }),
    ];
    const desc = clean(w.description?.raw ?? w.description?.html, modo === 'completo' ? 20_000 : 1500);
    lines.push('---', desc || '(sem descrição)');

    if (modo === 'completo') {
      const [att, rel] = await Promise.all([
        op('GET', `/work_packages/${id}/attachments`).catch(() => null),
        op('GET', `/work_packages/${id}/relations`).catch(() => null),
      ]);
      const files: J[] = att?._embedded?.elements ?? [];
      if (files.length) lines.push('---', 'anexos:', table(['nome', 'kb', 'tipo'], files.map(f => [f.fileName, Math.ceil((f.fileSize ?? 0) / 1024), f.contentType])));
      const rels: J[] = rel?._embedded?.elements ?? [];
      if (rels.length) {
        lines.push('---', 'relações:', table(['tipo', 'de', 'para'], rels.map(r => [
          r.type ?? r.name,
          `#${idOf(r._links?.from?.href)} ${cut(L(r, 'from'), 40)}`,
          `#${idOf(r._links?.to?.href)} ${cut(L(r, 'to'), 40)}`,
        ])));
      }
    }
    return lines.filter(Boolean).join('\n');
  },
};

const kv = (o: Record<string, unknown>) => Object.entries(o).filter(([, v]) => v !== '' && v !== null && v !== undefined).map(([k, v]) => `${k}: ${v}`).join(' | ');

async function activity(id: number, n: number): Promise<string> {
  const r = await op('GET', `/work_packages/${id}/activities`);
  st.atual = id;
  const els: J[] = r?._embedded?.elements ?? [];
  if (!els.length) return 'sem atividade';
  const rows = els.slice(-n).map(e => {
    const what = [clean(e.comment?.raw ?? e.comment?.html, 1500), ...(e.details ?? []).map((d: J) => clean(d.raw ?? d.html, 200))].filter(Boolean).join(' · ');
    return [(e.createdAt ?? '').slice(0, 16).replace('T', ' '), L(e, 'user') || `#${idOf(e._links?.user?.href)}`, what];
  });
  return `${els.length} entradas${els.length > n ? ` (últimas ${n})` : ''}\n${table(['quando', 'quem', 'o que'], rows)}`;
}
