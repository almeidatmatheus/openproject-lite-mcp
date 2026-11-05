// real MCP client (stdio, JSON-RPC) against the mock OpenProject. No network, no account.
// node test/run.ts

import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { start, KEY } from './mock.ts';

const MAIN = fileURLToPath(new URL('../src/main.ts', import.meta.url));
const mock = await start();

type Elicit = (params: any) => any;

function client(env: Record<string, string>, opts: { elicit?: Elicit } = {}) {
  const p = spawn(process.execPath, [MAIN], { env: { PATH: process.env.PATH ?? '', ...env }, stdio: ['pipe', 'pipe', 'pipe'] });
  let seq = 0, buf = '';
  const waits = new Map<number, (m: any) => void>();
  p.stdout.setEncoding('utf8');
  p.stdout.on('data', (d: string) => {
    buf += d;
    let i: number;
    while ((i = buf.indexOf('\n')) >= 0) {
      const m = JSON.parse(buf.slice(0, i));
      buf = buf.slice(i + 1);
      if (m.method === 'elicitation/create') {
        p.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: m.id, result: opts.elicit!(m.params) }) + '\n');
      } else waits.get(m.id)?.(m);
    }
  });
  const rpc = (method: string, params: any = {}) => new Promise<any>(res => {
    const id = ++seq;
    waits.set(id, res);
    p.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
  });
  const call = async (name: string, args: any = {}) => {
    const r = await rpc('tools/call', { name, arguments: args });
    return { text: r.result.content[0].text as string, err: !!r.result.isError };
  };
  const init = () => rpc('initialize', { protocolVersion: '2025-06-18', capabilities: opts.elicit ? { elicitation: {} } : {}, clientInfo: { name: 'test', version: '1' } });
  return { rpc, call, init, close: () => p.kill() };
}

let ok = 0, bad = 0;
function check(name: string, cond: unknown, info?: unknown) {
  if (cond) { ok++; console.log('  ok  ' + name); }
  else { bad++; console.log('  FAIL ' + name + (info !== undefined ? '\n       ' + String(typeof info === 'string' ? info : JSON.stringify(info)).replace(/\n/g, '\n       ') : '')); }
}

const ENV = { OPENPROJECT_URL: mock.url + '/', OPENPROJECT_API_KEY: KEY, OPENPROJECT_PROJECT: 'site' };
const db = mock.db;

// --- main client (no elicitation -> cf codes)
const c = client(ENV);
const ini = await c.init();
check('initialize', ini.result.serverInfo.name === 'openproject-lite-mcp' && ini.result.protocolVersion === '2025-06-18');
const tl = await c.rpc('tools/list');
const names = tl.result.tools.map((t: any) => t.name).sort().join(',');
check('tools/list: 9 ferramentas', names === 'cm,cx,find,ls,new,rd,rm,tm,up', names);
check('schemas sem type arrays', !JSON.stringify(tl.result.tools).includes('"type":['));
check('rm marcado destrutivo', tl.result.tools.find((t: any) => t.name === 'rm').annotations.destructiveHint === true);

let r = await c.call('cx');
check('cx conta', /Ana Lima/.test(r.text) && /Site Novo/.test(r.text) && /v16/.test(r.text), r.text);
r = await c.call('cx', { acao: 'projetos' });
check('cx projetos', /site\|Site Novo/.test(r.text) && /app\|App Mobile/.test(r.text), r.text);
r = await c.call('cx', { acao: 'prioridades' });
check('429 com retry', /Immediate/.test(r.text) && db.requests.filter(x => x.endsWith('/priorities')).length === 2, r.text);
r = await c.call('cx', { acao: 'membros', pj: 'App' });
check('cx membros por nome de projeto', /Carla Dias/.test(r.text) && !/Bruno/.test(r.text), r.text);

r = await c.call('ls');
check('ls padrão: abertos do projeto', r.text.startsWith('4 itens') && /^id\|tipo\|status/m.test(r.text) && !/Lançamento antigo/.test(r.text) && !/push/.test(r.text), r.text);
r = await c.call('ls', { filtro: 'meus' });
check('ls meus', /Tela de login/.test(r.text) && /Bug no checkout/.test(r.text) && !/Configurar CI/.test(r.text), r.text);
r = await c.call('ls', { filtro: 'atrasados' });
check('ls atrasados', r.text.startsWith('1 itens') && /Tela de login/.test(r.text), r.text);
r = await c.call('ls', { filtro: 'sem_resp' });
check('ls sem_resp', /Subtarefa/.test(r.text) && r.text.startsWith('1 itens'), r.text);
r = await c.call('ls', { pj: 'todos', filtro: 'todos', n: 2 });
check('ls todos os projetos paginado', /^6 itens · pág 1\/3/.test(r.text) && /^proj\|id/m.test(r.text), r.text);
r = await c.call('ls', { resp: 'bruno' });
check('ls resp por nome', /Configurar CI/.test(r.text) && r.text.startsWith('1 itens'), r.text);
r = await c.call('ls', { tipo: 'bug' });
check('ls por tipo', /Bug no checkout/.test(r.text) && r.text.startsWith('1 itens'), r.text);
r = await c.call('ls', { filtro: 'abertissimos' });
check('enum inválido', r.err && /filtro deve ser um de/.test(r.text), r.text);
r = await c.call('ls', { xyz: 1 });
check('argumento desconhecido', r.err && /argumento desconhecido: xyz/.test(r.text), r.text);

r = await c.call('find', { texto: 'sso' });
check('find na descrição', /Tela de login/.test(r.text), r.text);
r = await c.call('find', { texto: 'sso', em: 'assunto' });
check('find só assunto', r.text === 'nenhum work package', r.text);
r = await c.call('find', { texto: 'antigo', fechados: true });
check('find incluindo fechados', /Lançamento antigo/.test(r.text), r.text);

r = await c.call('rd', { id: '#1' });
check('rd resumo', /^#1 Task · In progress · Normal/.test(r.text) && /resp: Ana Lima/.test(r.text) && /Criar tela de login/.test(r.text) && !/\n\n\n/.test(r.text), r.text);
r = await c.call('rd', { modo: 'completo' });
check('rd atual completo com anexos', /wireframe\.png\|20\|image\/png/.test(r.text), r.text);
r = await c.call('rd', { id: 1, modo: 'filhos' });
check('rd filhos', /Subtarefa do login/.test(r.text), r.text);
r = await c.call('rd', { id: 999 });
check('rd 404', r.err && /não encontrado/.test(r.text), r.text);

r = await c.call('new', { assunto: 'Corrigir rodapé', tipo: 'bug', resp: 'eu', fim: '+3', prio: 'high', estimativa: 2.5, versao: 'v1', desc: '**urgente**' });
const created = db.wps.at(-1)!;
check('new', /^criado #7 "Corrigir rodapé" · Bug · New · Ana Lima em Site Novo/.test(r.text) && created.type === 3 && created.priority === 9 && created.est === 'PT2H30M' && created.version === 1 && created.desc === '**urgente**', r.text);
r = await c.call('new', { assunto: 'Go-live', tipo: 'Milestone', fim: '2026-12-01' });
check('new marco usa date', db.wps.at(-1)!.date === '2026-12-01' && db.wps.at(-1)!.dueDate === null, db.wps.at(-1));
r = await c.call('new', { assunto: 'x', resp: 'Carla' });
check('new resp fora do projeto lista opções', r.err && /pessoa "Carla" não encontrado. Opções: Ana Lima, Bruno Souza/.test(r.text), r.text);
r = await c.call('new', { tipo: 'bug' });
check('new sem assunto', r.err && /falta o argumento assunto/.test(r.text), r.text);

r = await c.call('up', { alvos: '7', status: 'in prog', pct: 50, fim: '15/12/2026' });
check('up', /^#7 ok · In progress/.test(r.text) && created.status === 7 && created.pct === 50 && created.dueDate === '2026-12-15', r.text);
db.conflictOnce = true;
r = await c.call('up', { resp: 'bruno' });
check('up atual com conflito 409 + retry', /^#7 ok · In progress · Bruno Souza/.test(r.text) && created.assignee === 2, r.text);
r = await c.call('up', { status: 'xpto' });
check('up status inválido lista opções', r.err && /status "xpto" não encontrado. Opções: New, In progress, Closed, Rejected/.test(r.text), r.text);
r = await c.call('up', { alvos: '7' });
check('up sem campos', r.err && /nada para alterar/.test(r.text), r.text);
r = await c.call('up', { resp: '', fim: '' });
check('up limpa resp e prazo', created.assignee === null && created.dueDate === null, created);
await c.call('ls', { filtro: 'meus' });
r = await c.call('up', { alvos: 'lista', prio: 'Immediate' });
check('up em lote (lista)', r.text.split('\n').length === 2 && db.wps.filter(w => w.assignee === 1 && w.status !== 12).every(w => w.priority === 10), r.text);

r = await c.call('cm', { id: 1, texto: 'Revisado, pode seguir.' });
check('cm sem confirmação por padrão', r.text === 'comentado em #1' && db.activities[1].at(-1)!.comment === 'Revisado, pode seguir.', r.text);
r = await c.call('rd', { modo: 'atividade' });
check('rd atividade', /Bruno Souza\|Começando hoje/.test(r.text) && /Ana Lima\|Revisado/.test(r.text), r.text);

r = await c.call('tm', { acao: 'lancar', id: 1, horas: 1.5, comentario: 'pair', atividade: 'dev' });
check('tm lancar com atividade', /^lançado 1\.5h em \d{4}-\d\d-\d\d no #1 · Development/.test(r.text) && db.time[0].hours === 'PT1H30M' && db.time[0].activity === 1, r.text);
await c.call('tm', { acao: 'lancar', id: 3, horas: 2, data: 'hoje' });
r = await c.call('tm');
check('tm listar semana', /^2 lançamentos · 3\.5h/.test(r.text) && /Tela de login/.test(r.text), r.text);
r = await c.call('tm', { id: 3, periodo: 'mes' });
check('tm listar por WP', /^1 lançamentos · 2h/.test(r.text), r.text);
r = await c.call('tm', { acao: 'lancar', id: 1, horas: 1, atividade: 'xyz' });
check('tm atividade inválida', r.err && /atividade "xyz" não encontrado. Opções: Development, Management/.test(r.text), r.text);

const before = db.wps.length;
r = await c.call('rm', { alvos: '7' });
const cf = /cf="([0-9a-f]+)"/.exec(r.text)?.[1];
check('rm sem cf devolve prévia', !!cf && /APAGAR PERMANENTEMENTE 1/.test(r.text) && /#7 Corrigir rodapé/.test(r.text) && db.wps.length === before, r.text);
r = await c.call('rm', { alvos: '8', cf });
check('rm cf com outros argumentos é recusado', r.err && /cf inválido/.test(r.text) && db.wps.length === before, r.text);
r = await c.call('rm', { alvos: '7', cf: 'zzzzzz' });
check('rm cf errado', r.err && db.wps.length === before, r.text);
r = await c.call('rm', { alvos: '7' });
const cf2 = /cf="([0-9a-f]+)"/.exec(r.text)![1];
r = await c.call('rm', { alvos: '7', cf: cf2 });
check('rm com cf apaga', r.text === '#7 apagado' && !db.wps.some(w => w.id === 7), r.text);
r = await c.call('rm', { alvos: '7', cf: cf2 });
check('cf não reutilizável', r.err && /cf inválido/.test(r.text), r.text);
c.close();

// --- elicitation-capable client
let asked = '';
let answer = true;
const e = client(ENV, { elicit: p => { asked = p.message; return answer ? { action: 'accept', content: { confirmar: true } } : { action: 'decline' }; } });
await e.init();
answer = false;
r = await e.call('rm', { alvos: '8' });
check('elicitation recusada', r.text.startsWith('cancelado') && db.wps.some(w => w.id === 8) && /Go-live/.test(asked), r.text);
answer = true;
r = await e.call('rm', { alvos: '8' });
check('elicitation aceita apaga', r.text === '#8 apagado' && !db.wps.some(w => w.id === 8), r.text);
e.close();

// --- confirmation configured for comments too
const k = client({ ...ENV, OPENPROJECT_MCP_CONFIRM: 'rm,cm,tm' });
await k.init();
r = await k.call('cm', { id: 2, texto: 'oi' });
check('OPENPROJECT_MCP_CONFIRM=cm pede prévia', /^PRÉVIA/.test(r.text) && /comentar em #2 Configurar CI/.test(r.text) && !db.activities[2], r.text);
r = await k.call('tm');
check('tm listar não pede confirmação', /lançamentos/.test(r.text), r.text);
k.close();

// --- bad key / no config
const b = client({ ...ENV, OPENPROJECT_API_KEY: 'wrong' });
await b.init();
r = await b.call('ls');
check('chave inválida', r.err && /chave API inválida/.test(r.text), r.text);
b.close();
const n = client({});
await n.init();
r = await n.call('cx');
check('sem configuração', r.err && /configure OPENPROJECT_URL/.test(r.text), r.text);
n.close();

await mock.close();
console.log(`\n${ok} ok, ${bad} falhas`);
process.exit(bad ? 1 : 0);
