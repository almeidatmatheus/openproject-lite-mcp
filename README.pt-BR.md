# openproject-lite-mcp

Servidor [MCP](https://modelcontextprotocol.io) leve para o [OpenProject](https://www.openproject.org) (API v3). Funciona com instalação própria (on-premise, Community ou Enterprise) e com o OpenProject Cloud.

- **Zero dependências.** Node 22.18+ roda o TypeScript direto: sem `npm install`, sem build.
- **Você roda, você controla.** Fala direto com o seu OpenProject usando a sua chave de API. Nenhum servidor de terceiros no meio.
- **Econômico em tokens.** Saída tabular, ids numéricos mais `atual` / `ultimo` / `lista`, descrições limpas, nomes resolvidos por aproximação (`status: "in prog"`).
- **Seguro por padrão.** Apagar sempre mostra uma prévia e espera aprovação; outras escritas também podem pedir.
- **Qualquer modelo.** JSON Schema simples (sem arrays de `type`, sem `anyOf`), então modelos locais e outros provedores funcionam.

> English: [README.md](README.md).

## Pré-requisitos

- **Node.js 22.18 ou mais novo** (`node --version`).
- **Uma instância do OpenProject** acessível da máquina onde o servidor roda (`http://` na rede local serve).
- **Um token de API**: no OpenProject, *Minha conta → Tokens de acesso → API → Gerar*. O servidor age como esse usuário, com as permissões dele.
- **Um cliente MCP**: Claude Desktop, Claude Code, Cursor, VS Code ou qualquer um que aceite servidores stdio.

## Começo rápido

```bash
git clone https://github.com/almeidatmatheus/openproject-lite-mcp.git
cd openproject-lite-mcp
OPENPROJECT_URL=https://op.empresa.com OPENPROJECT_API_KEY=<token> node src/main.ts check
# ok: Ana Lima (ana) em OpenProject v16.x
```

**Claude Desktop** (`claude_desktop_config.json`, veja [examples/](examples/claude_desktop_config.json)):

```json
{
  "mcpServers": {
    "openproject": {
      "command": "node",
      "args": ["/caminho/absoluto/openproject-lite-mcp/src/main.ts"],
      "env": {
        "OPENPROJECT_URL": "https://op.empresa.com",
        "OPENPROJECT_API_KEY": "<token>",
        "OPENPROJECT_PROJECT": "meu-projeto"
      }
    }
  }
}
```

**Claude Code:**

```bash
claude mcp add openproject \
  -e OPENPROJECT_URL=https://op.empresa.com -e OPENPROJECT_API_KEY=<token> -e OPENPROJECT_PROJECT=meu-projeto \
  -- node /caminho/absoluto/openproject-lite-mcp/src/main.ts
```

**Outros clientes MCP:** comando `node /caminho/absoluto/openproject-lite-mcp/src/main.ts`, transporte stdio, mesmas variáveis.

### Experimente

> "o que está comigo?" · "o que está atrasado no projeto site?" · "passa o #42 para Em andamento com prazo sexta" · "comenta que a correção subiu" · "lança 1,5h no #42" · "cria um bug: botão de checkout quebrado, atribui ao Bruno"

## Ferramentas

| ferramenta | faz                                                                                   |
|------------|---------------------------------------------------------------------------------------|
| `ls`       | lista WPs: abertos, meus, atrasados, vencem na semana, sem responsável, fechados, todos; filtros por status, tipo, responsável, versão |
| `find`     | busca por texto (assunto + descrição + comentários, ou só assunto/id)                 |
| `rd`       | lê um WP: resumo, completo (anexos, relações), atividade, filhos                      |
| `new`      | cria WP (tipo, status, prioridade, responsável, versão, pai, datas, estimativa)       |
| `up`       | altera um ou vários WPs (só os campos informados mudam)                               |
| `cm`       | comenta em um WP                                                                      |
| `tm`       | horas: listar lançamentos (eu/todos, período) ou lançar horas                         |
| `rm`       | apaga WPs permanentemente. **Sempre pede confirmação**                                |
| `cx`       | conta e instância, projetos, status, tipos, prioridades, membros, versões             |

Ids: `123` ou `#123`, `atual` (último lido/criado/alterado), `ultimo` (1º da última listagem). `alvos` também aceita `12,15,18` ou `lista` = todos da última listagem.

Datas: `2026-12-15`, `15/12`, `hoje`, `amanha`, `+3`, `-1`; `''` limpa.

**Confirmação.** Se o cliente suporta *elicitation* do MCP, o servidor pergunta direto ao usuário. Senão, a primeira chamada devolve uma prévia e um código `cf`; só a chamada idêntica com esse `cf` executa (vale 10 min, uso único).

## Opções

| variável                  | padrão                                                                  |
|---------------------------|-------------------------------------------------------------------------|
| `OPENPROJECT_URL`         | obrigatória, ex.: `https://op.empresa.com` (sem `/api/v3`)              |
| `OPENPROJECT_API_KEY`     | obrigatória                                                             |
| `OPENPROJECT_PROJECT`     | projeto padrão (identificador, nome ou id); vazio = todos               |
| `OPENPROJECT_MCP_CONFIRM` | `rm`. Ferramentas que pedem confirmação, separadas por vírgula: ex. `rm,cm,new,up,tm`; `tudo` = toda escrita. `rm` sempre pede |

Linha de comando: `node src/main.ts check` (ou `whoami`) testa URL e token.

**Certificado próprio / CA interna:** `NODE_EXTRA_CA_CERTS=/caminho/ca.pem`. Nunca desligue a verificação TLS.
**Proxy corporativo:** Node 22.21+ com `NODE_USE_ENV_PROXY=1` e `HTTPS_PROXY`.

## Observações sobre o OpenProject

- `%` concluído só pode ser alterado se a instância usa progresso por trabalho (manual); no modo por status o OpenProject recusa e o erro é repassado.
- Horas: o OpenProject 15+ liga o lançamento a `entity`, versões antigas a `workPackage`; o servidor tenta os dois. Algumas instâncias exigem atividade (`atividade: "Development"`).
- Apagar um WP é permanente e apaga os filhos. Para encerrar, use `up` com um status fechado.

## Segurança

- O token tem exatamente as permissões do usuário dele. Prefira um usuário dedicado, com acesso só aos projetos que a IA deve mexer.
- O token fica na configuração do seu cliente MCP; mantenha esse arquivo privado.
- **Conteúdo de WP não é confiável.** Uma descrição ou comentário pode ter texto tentando instruir a IA. A confirmação antes de apagar (e, se quiser, antes de toda escrita) é a principal defesa; não remova.
- Veja [SECURITY.md](SECURITY.md) para reportar vulnerabilidades.

## Desenvolvimento

```bash
node test/run.ts                                  # 51 verificações, sem rede nem OpenProject
npm i -D typescript @types/node && npx tsc -p .   # checagem de tipos (opcional)
```

## Licença

[MIT](LICENSE)
