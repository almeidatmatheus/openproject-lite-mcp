import type { Tool } from './index.ts';
import { S } from './s.ts';
import { op } from '../op.ts';
import { cfg } from '../lib.ts';
import { table } from '../fmt.ts';
import { me, projects, project, needProject, statuses, types, priorities, members, versions } from '../ref.ts';

export const cx: Tool = {
  name: 'cx',
  description: 'Contexto: conta e instância, projetos, status, tipos, prioridades, membros (pessoas atribuíveis) e versões de um projeto.',
  inputSchema: {
    type: 'object',
    properties: {
      acao: { type: 'string', enum: ['conta', 'projetos', 'status', 'tipos', 'prioridades', 'membros', 'versoes'], description: 'padrão: conta' },
      pj: S.pj,
    },
  },
  async run(a) {
    switch (a.acao ?? 'conta') {
      case 'conta': {
        const [u, root] = await Promise.all([me(), op('GET', '').catch(() => null)]);
        const p = await project().catch(() => null);
        return [
          `usuário: ${u.name} (${u.login ?? '#' + u.id})${u.admin ? ' · admin' : ''}`,
          `instância: ${root?.instanceName ?? ''} ${cfg().url}${root?.coreVersion ? ' v' + root.coreVersion : ''}`.replace(/\s+/g, ' ').trim(),
          `projeto padrão: ${p ? `${p.name} (${p.identifier})` : '(nenhum: listagens cobrem todos)'}`,
        ].join('\n');
      }
      case 'projetos': {
        const ps = await projects();
        return table(['id', 'ident', 'nome', 'ativo'], ps.map(p => [p.id, p.identifier, p.name, p.active === false ? 'não' : 'sim']));
      }
      case 'status':
        return table(['id', 'nome', 'fechado', 'padrão'], (await statuses()).map(s => [s.id, s.name, s.isClosed ? 'sim' : '', s.isDefault ? 'sim' : '']));
      case 'tipos': {
        const p = await project(a.pj);
        return table(['id', 'nome', 'marco', 'padrão'], (await types(p?.id)).map(t => [t.id, t.name, t.isMilestone ? 'sim' : '', t.isDefault ? 'sim' : '']));
      }
      case 'prioridades':
        return table(['id', 'nome', 'padrão'], (await priorities()).map(p => [p.id, p.name, p.isDefault ? 'sim' : '']));
      case 'membros': {
        const p = await needProject(a.pj);
        return table(['id', 'nome'], (await members(p.id)).map(u => [u.id, u.name]));
      }
      case 'versoes': {
        const p = await needProject(a.pj);
        return table(['id', 'nome', 'status', 'fim'], (await versions(p.id)).map(v => [v.id, v.name, v.status, v.endDate]));
      }
    }
    return '';
  },
};
