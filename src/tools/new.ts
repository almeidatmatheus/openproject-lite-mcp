import type { Tool } from './index.ts';
import { S, FIELDS } from './s.ts';
import { op } from '../op.ts';
import { L } from '../fmt.ts';
import { st } from '../ids.ts';
import { project, needProject } from '../ref.ts';
import { patchFrom, changes } from '../wp.ts';

export const nw: Tool = {
  name: 'new',
  description: 'Cria um work package. Sem tipo usa o tipo padrão do projeto. O criado vira o atual.',
  write: true,
  inputSchema: {
    type: 'object',
    properties: { pj: S.pj, ...FIELDS, notificar: { type: 'boolean', description: 'enviar notificações (padrão true)' }, cf: S.cf },
    required: ['assunto'],
  },
  async preview(a) {
    const p = await project(a.pj);
    return `criar em ${p ? p.name : '(projeto não definido)'}: ${changes(a)}`;
  },
  async run(a) {
    const p = await needProject(a.pj);
    const body = await patchFrom(a, p.id);
    const w = await op('POST', `/projects/${p.id}/work_packages?notify=${a.notificar !== false}`, body);
    st.atual = w.id;
    return `criado #${w.id} "${w.subject}" · ${L(w, 'type')} · ${L(w, 'status')}${L(w, 'assignee') ? ' · ' + L(w, 'assignee') : ''} em ${p.name}`;
  },
};
