// reference data (projects, statuses, types, people...) with a short cache, resolved by name

import { op, all, qs, type J } from './op.ts';
import { cfg, fail, pick, norm } from './lib.ts';

const cache = new Map<string, { t: number; v: Promise<any> }>();
export function memo<T>(k: string, fn: () => Promise<T>, ttl = 300_000): Promise<T> {
  const c = cache.get(k);
  if (c && Date.now() - c.t < ttl) return c.v;
  const v = fn();
  cache.set(k, { t: Date.now(), v });
  v.catch(() => cache.delete(k));
  return v;
}

export const me = () => memo('me', () => op('GET', '/users/me'), 3_600_000);
export const projects = () => memo('pj', () => all('/projects', { sortBy: [['name', 'asc']] }));
export const statuses = () => memo('st', () => all('/statuses'));
export const priorities = () => memo('pr', () => all('/priorities'));
export const types = (pid?: number) => memo('ty' + (pid ?? ''), () => all(pid ? `/projects/${pid}/types` : '/types'));
export const members = (pid: number) => memo('mb' + pid, () => all(`/projects/${pid}/available_assignees`));
export const versions = (pid: number) => memo('vs' + pid, () => all(`/projects/${pid}/versions`));

const by = (xs: J[], q: string, what: string): J => xs.find(x => String(x.id) === String(q).trim()) ?? pick(xs, x => x.name, String(q), what);

// null = all projects
export async function project(q?: string): Promise<J | null> {
  const v = (q ?? cfg().project).trim();
  if (!v || norm(v) === 'todos') return null;
  const ps = await projects();
  return ps.find(p => p.identifier === v || String(p.id) === v) ?? pick(ps, p => p.name, v, 'projeto');
}
export async function needProject(q?: string): Promise<J> {
  return (await project(q)) ?? fail('informe o projeto (pj) ou defina OPENPROJECT_PROJECT; veja cx projetos');
}

export const status = async (q: string) => by(await statuses(), q, 'status');
export const priority = async (q: string) => by(await priorities(), q, 'prioridade');
export const typeOf = async (q: string, pid?: number) => by(await types(pid), q, 'tipo');
export const version = async (q: string, pid: number) => by(await versions(pid), q, 'versão');

export const isMe = (q: string) => ['eu', 'me', 'mim'].includes(norm(q));
export const isNobody = (q: string) => ['', 'ninguem', 'nenhum'].includes(norm(q));

// person by name: project members when known, otherwise any visible principal
export async function user(q: string, pid?: number): Promise<J | null> {
  if (isMe(q)) return me();
  if (isNobody(q)) return null;
  if (pid) return by(await members(pid), q, 'pessoa');
  const r = await op('GET', '/principals' + qs({ filters: [{ any_name_attribute: { operator: '~', values: [q] } }], pageSize: 50 }));
  return by(r?._embedded?.elements ?? [], q, 'pessoa');
}
