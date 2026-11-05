import type { Tool } from './index.ts';
import { S } from './s.ts';
import { op } from '../op.ts';
import { st, one } from '../ids.ts';
import { titles } from '../wp.ts';

export const cm: Tool = {
  name: 'cm',
  description: 'Comenta em um work package (markdown; @menções seguem as regras do OpenProject). Visível para a equipe.',
  write: true,
  inputSchema: {
    type: 'object',
    properties: {
      id: S.id,
      texto: { type: 'string', description: 'comentário em markdown' },
      notificar: { type: 'boolean', description: 'enviar notificações (padrão true)' },
      cf: S.cf,
    },
    required: ['texto'],
  },
  async preview(a) {
    return `comentar em ${await titles([one(a.id)])}:\n${a.texto}`;
  },
  async run(a) {
    const id = one(a.id);
    await op('POST', `/work_packages/${id}/activities?notify=${a.notificar !== false}`, { comment: { raw: a.texto } });
    st.atual = id;
    return `comentado em #${id}`;
  },
};
