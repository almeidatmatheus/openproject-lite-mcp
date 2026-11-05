import type { Tool } from './index.ts';
import { S } from './s.ts';
import type { J } from '../op.ts';
import { project } from '../ref.ts';
import { listWps } from '../wp.ts';

export const find: Tool = {
  name: 'find',
  description: 'Busca work packages por texto. Mesma saída do ls.',
  inputSchema: {
    type: 'object',
    properties: {
      texto: { type: 'string', description: 'palavras ou #id' },
      em: { type: 'string', enum: ['tudo', 'assunto'], description: 'tudo = assunto, descrição e comentários (padrão); assunto = só título ou id' },
      fechados: { type: 'boolean', description: 'incluir fechados (padrão false)' },
      pj: S.pj,
      n: S.n,
      pag: S.pag,
    },
    required: ['texto'],
  },
  async run(a) {
    const pj = await project(a.pj);
    const f: J[] = [(a.em ?? 'tudo') === 'tudo'
      ? { search: { operator: '**', values: [a.texto] } }
      : { subjectOrId: { operator: '**', values: [a.texto.replace(/^#/, '')] } }];
    if (!a.fechados) f.push({ status: { operator: 'o', values: [] } });
    return listWps({ pj, filters: f, sort: 'atualizado', n: a.n, pag: a.pag });
  },
};
