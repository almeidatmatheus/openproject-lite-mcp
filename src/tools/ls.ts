import type { Tool } from './index.ts';
import { S } from './s.ts';
import { href, idOf, type J } from '../op.ts';
import { ymd, addDays, fail } from '../lib.ts';
import { project, status, typeOf, version, user, isMe, isNobody } from '../ref.ts';
import { listWps } from '../wp.ts';
import { filter as cfFilter } from '../cf.ts';

export const ls: Tool = {
  name: 'ls',
  description: 'Lista work packages, uma linha por WP (id|tipo|status|prio|resp|fim|%|assunto).',
  inputSchema: {
    type: 'object',
    properties: {
      pj: S.pj,
      filtro: {
        type: 'string',
        enum: ['abertos', 'meus', 'atrasados', 'semana', 'sem_resp', 'fechados', 'todos'],
        description: 'abertos (padrão); meus = abertos atribuídos a mim; atrasados = abertos com prazo vencido; semana = abertos que vencem em 7 dias; sem_resp = abertos sem responsável',
      },
      status: { type: 'string', description: 'só este status (substitui aberto/fechado)' },
      tipo: { type: 'string', description: 'só este tipo' },
      resp: { type: 'string', description: "só deste responsável: nome, 'eu' ou 'ninguem'" },
      versao: { type: 'string', description: 'só desta versão (exige projeto)' },
      campo: { type: 'string', description: "campo personalizado: 'Nome=valor' (texto: contém; listas e pessoas: igual; 'Nome=' = vazio). Exige projeto. Ex.: 'Orca ID=task_123'" },
      ordem: { type: 'string', enum: ['atualizado', 'fim', 'prioridade', 'criado', 'id'], description: 'padrão: atualizado' },
      n: S.n,
      pag: S.pag,
    },
  },
  async run(a) {
    const pj = await project(a.pj);
    const fl = a.filtro ?? 'abertos';
    const f: J[] = [];
    if (a.status) f.push({ status: { operator: '=', values: [String((await status(a.status)).id)] } });
    else if (fl === 'fechados') f.push({ status: { operator: 'c', values: [] } });
    else if (fl !== 'todos') f.push({ status: { operator: 'o', values: [] } });

    if (fl === 'meus') f.push({ assignee: { operator: '=', values: ['me'] } });
    if (fl === 'sem_resp') f.push({ assignee: { operator: '!*', values: [] } });
    if (fl === 'atrasados') f.push({ dueDate: { operator: '<>d', values: ['', ymd(addDays(-1))] } });
    if (fl === 'semana') f.push({ dueDate: { operator: '<>d', values: [ymd(new Date()), ymd(addDays(7))] } });

    if (a.resp !== undefined) {
      if (isMe(a.resp)) f.push({ assignee: { operator: '=', values: ['me'] } });
      else if (isNobody(a.resp)) f.push({ assignee: { operator: '!*', values: [] } });
      else f.push({ assignee: { operator: '=', values: [String(idOf(href(await user(a.resp, pj?.id))))] } });
    }
    if (a.tipo) f.push({ type: { operator: '=', values: [String((await typeOf(a.tipo, pj?.id)).id)] } });
    if (a.versao) {
      if (!pj) fail('filtrar por versão exige o projeto (pj)');
      f.push({ version: { operator: '=', values: [String((await version(a.versao, pj.id)).id)] } });
    }
    if (a.campo) {
      if (!pj) fail('filtrar por campo exige o projeto (pj)');
      f.push(...(await cfFilter(a.campo, pj.id)));
    }
    return listWps({ pj, filters: f, sort: a.ordem ?? (fl === 'atrasados' || fl === 'semana' ? 'fim' : 'atualizado'), n: a.n, pag: a.pag });
  },
};
