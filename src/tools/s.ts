// shared schema pieces (plain JSON Schema types only, so any LLM/provider accepts them)

export const S = {
  pj: { type: 'string', description: "projeto: identificador, nome ou id. Padrão: OPENPROJECT_PROJECT; 'todos' = todos" },
  id: { type: 'string', description: "id do WP (123 ou #123), 'atual' ou 'ultimo'. Padrão: atual" },
  alvos: { type: 'string', description: "'123', '12,15,18', 'atual' ou 'lista' (toda a última listagem). Padrão: atual" },
  cf: { type: 'string', description: 'código de confirmação devolvido na prévia. Só envie depois que o usuário aprovar.' },
  n: { type: 'integer', minimum: 1, maximum: 100, description: 'itens por página (padrão 25)' },
  pag: { type: 'integer', minimum: 1, description: 'página (padrão 1)' },
};

const DATE = "AAAA-MM-DD, DD/MM, hoje, amanha, +3, -1; '' limpa";

export const FIELDS = {
  assunto: { type: 'string', description: 'título' },
  desc: { type: 'string', description: 'descrição em markdown. SUBSTITUI a descrição inteira; para registrar progresso use cm, para acrescentar use desc_add' },
  desc_add: { type: 'string', description: 'texto acrescentado ao fim da descrição atual (sem apagar nada)' },
  campos: { type: 'string', description: "campos personalizados: 'Nome=valor; Outro=valor' ('' após = limpa; listas múltiplas: a,b). Veja cx campos" },
  tipo: { type: 'string', description: 'nome do tipo (Task, Bug, Milestone...)' },
  status: { type: 'string', description: 'nome do status' },
  prio: { type: 'string', description: 'nome da prioridade' },
  resp: { type: 'string', description: "responsável: nome, 'eu' ou 'ninguem'" },
  versao: { type: 'string', description: "versão/sprint pelo nome; '' remove" },
  pai: { type: 'string', description: "id do WP pai; '' remove" },
  inicio: { type: 'string', description: `data de início (${DATE})` },
  fim: { type: 'string', description: `prazo (${DATE}). Em marcos vira a data do marco` },
  estimativa: { type: 'number', minimum: 0, description: 'trabalho estimado em horas (0 limpa)' },
};
