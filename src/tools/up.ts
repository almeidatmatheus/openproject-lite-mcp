import type { Tool } from './index.ts';
import { S, FIELDS } from './s.ts';
import { op, idOf, OpErr, type J } from '../op.ts';
import { L, cut } from '../fmt.ts';
import { st, targets } from '../ids.ts';
import { getWp, patchFrom, changes, titles, requireSome } from '../wp.ts';

const { assunto, desc, desc_add, campos, tipo, status, prio, resp, versao, pai, inicio, fim, estimativa } = FIELDS;
const KEYS = ['assunto', 'desc', 'desc_add', 'campos', 'tipo', 'status', 'prio', 'resp', 'versao', 'pai', 'inicio', 'fim', 'estimativa', 'pct'];

export const up: Tool = {
  name: 'up',
  description: 'Altera campos de um ou vários work packages (status, responsável, prazo, prioridade, %, campos personalizados...). Só os campos informados mudam. Para registrar progresso, prefira cm (comentário) a mexer na descrição.',
  write: true,
  inputSchema: {
    type: 'object',
    properties: {
      alvos: S.alvos,
      status, resp, prio, fim, inicio,
      pct: { type: 'integer', minimum: 0, maximum: 100, description: '% concluído (se o projeto usar progresso manual)' },
      campos, desc_add, assunto, desc, tipo, versao, pai, estimativa,
      notificar: { type: 'boolean', description: 'enviar notificações (padrão true)' },
      cf: S.cf,
    },
  },
  async preview(a) {
    requireSome(a, KEYS);
    return `alterar ${changes(a)} em:\n${await titles(targets(a.alvos))}`;
  },
  async run(a) {
    requireSome(a, KEYS);
    const ids = targets(a.alvos);
    const out: string[] = [];
    for (const id of ids) {
      try {
        const w = await save(id, a);
        st.atual = id;
        out.push(`#${id} ok · ${L(w, 'status')} · ${L(w, 'assignee') || 'sem resp'} · fim ${w.dueDate ?? w.date ?? '-'} · ${cut(w.subject ?? '', 60)}`);
      } catch (e: any) {
        if (!(e instanceof Error) || ids.length === 1) throw e;
        out.push(`#${id} erro: ${e.message}`);
      }
    }
    return out.join('\n');
  },
};

// PATCH with lockVersion; one retry when someone else changed it meanwhile
async function save(id: number, a: J): Promise<J> {
  for (let i = 0; ; i++) {
    const cur = await getWp(id);
    const body = { lockVersion: cur.lockVersion, ...(await patchFrom(a, idOf(cur._links?.project?.href), cur)) };
    try {
      return await op('PATCH', `/work_packages/${id}?notify=${a.notificar !== false}`, body);
    } catch (e) {
      if (e instanceof OpErr && e.status === 409 && i === 0) continue;
      throw e;
    }
  }
}
