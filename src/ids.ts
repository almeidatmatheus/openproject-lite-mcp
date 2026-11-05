// work package ids: 123, #123, 'atual', 'ultimo', 'lista', '1,2,3'

import { fail, norm } from './lib.ts';

export const st = { atual: 0, lista: [] as number[] };

export function one(v: unknown): number {
  const s = norm(v === undefined || v === null || v === '' ? 'atual' : String(v)).replace(/^#/, '');
  if (s === 'atual') return st.atual || fail("nenhum work package 'atual' ainda; informe o id");
  if (s === 'ultimo') return st.lista[0] ?? fail('nenhuma listagem ainda');
  if (/^\d+$/.test(s)) return Number(s);
  return fail(`id inválido: ${v}`);
}

export function many(v: unknown): number[] {
  if (Array.isArray(v)) return [...new Set(v.flatMap(x => many(x)))];
  const s = norm(String(v ?? 'atual'));
  if (s === 'lista') return st.lista.length ? [...st.lista] : fail('nenhuma listagem ainda');
  if (/[,;\s]/.test(s)) return many(s.split(/[,;\s]+/).filter(Boolean));
  return [one(s)];
}

export function targets(v: unknown, max = 50): number[] {
  const ids = many(v);
  if (ids.length > max) fail(`máximo de ${max} itens por chamada (recebi ${ids.length})`);
  return ids;
}
