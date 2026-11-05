import type { Tool } from './index.ts';
import { S } from './s.ts';
import { op } from '../op.ts';
import { st, targets } from '../ids.ts';
import { titles } from '../wp.ts';

export const rm: Tool = {
  name: 'rm',
  description: 'Apaga work packages PERMANENTEMENTE (o OpenProject não tem lixeira; filhos também são apagados). Sempre pede confirmação. Para encerrar, prefira up com status fechado.',
  write: true,
  inputSchema: {
    type: 'object',
    properties: { alvos: S.alvos, cf: S.cf },
    required: ['alvos'],
  },
  async preview(a) {
    const ids = targets(a.alvos, 20);
    return `APAGAR PERMANENTEMENTE ${ids.length} work package(s) (sem lixeira, filhos incluídos):\n${await titles(ids)}`;
  },
  async run(a) {
    const ids = targets(a.alvos, 20);
    const out: string[] = [];
    for (const id of ids) {
      try { await op('DELETE', `/work_packages/${id}`); out.push(`#${id} apagado`); }
      catch (e: any) { out.push(`#${id} erro: ${e.message}`); }
      if (st.atual === id) st.atual = 0;
    }
    st.lista = st.lista.filter(x => !ids.includes(x));
    return out.join('\n');
  },
};
