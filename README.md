# openproject-lite-mcp

A lightweight [MCP](https://modelcontextprotocol.io) server for [OpenProject](https://www.openproject.org) (API v3). Works with self-hosted (on-premise, Community or Enterprise) and OpenProject Cloud.

- **Zero dependencies.** Node 22.18+ runs the TypeScript directly: no `npm install`, no build.
- **You run it, you own it.** Talks straight to your OpenProject with your own API key. No third-party server in between.
- **Token-light.** Tabular output, numeric ids plus `atual` / `ultimo` / `lista`, cleaned descriptions, names resolved fuzzily (`status: "in prog"`).
- **Safe by default.** Delete always shows a preview and waits for the user's approval; any other write can be made to ask too.
- **Any model.** Plain JSON Schema (no `type` arrays, no `anyOf`), so local models and other providers handle it.

> Português: [README.pt-BR.md](README.pt-BR.md). Tool descriptions are in Portuguese; any LLM handles them fine.

## Prerequisites

- **Node.js 22.18 or newer** (`node --version`).
- **An OpenProject instance** reachable from the machine running the server (`http://` on a LAN is fine).
- **An API token**: in OpenProject, *My account → Access tokens → API → Generate*. The server acts as that user, with that user's permissions.
- **An MCP client**: Claude Desktop, Claude Code, Cursor, VS Code or anything that supports stdio servers.

## Quick start

```bash
git clone https://github.com/almeidatmatheus/openproject-lite-mcp.git
cd openproject-lite-mcp
OPENPROJECT_URL=https://op.example.com OPENPROJECT_API_KEY=<token> node src/main.ts check
# ok: Ana Lima (ana) em OpenProject v16.x
```

**Claude Desktop** (`claude_desktop_config.json`, see [examples/](examples/claude_desktop_config.json)):

```json
{
  "mcpServers": {
    "openproject": {
      "command": "node",
      "args": ["/absolute/path/to/openproject-lite-mcp/src/main.ts"],
      "env": {
        "OPENPROJECT_URL": "https://op.example.com",
        "OPENPROJECT_API_KEY": "<token>",
        "OPENPROJECT_PROJECT": "my-project"
      }
    }
  }
}
```

**Claude Code:**

```bash
claude mcp add openproject \
  -e OPENPROJECT_URL=https://op.example.com -e OPENPROJECT_API_KEY=<token> -e OPENPROJECT_PROJECT=my-project \
  -- node /absolute/path/to/openproject-lite-mcp/src/main.ts
```

**Any other MCP client:** command `node /absolute/path/to/openproject-lite-mcp/src/main.ts`, stdio transport, same env vars.

### Try it

> "what's assigned to me?" · "what's overdue in the site project?" · "move #42 to In progress and set the due date to Friday" · "comment on it that the fix is deployed" · "log 1.5h on #42" · "create a bug: checkout button broken, assign to Bruno"

## Tools

| tool   | does                                                                                     |
|--------|------------------------------------------------------------------------------------------|
| `ls`   | list work packages: open, mine, overdue, due this week, unassigned, closed, all; filters by status, type, assignee, version |
| `find` | text search (subject + description + comments, or subject/id only)                       |
| `rd`   | read a work package: summary, full (attachments, relations), activity, children          |
| `new`  | create a work package (type, status, priority, assignee, version, parent, dates, estimate) |
| `up`   | update one or many work packages (only the fields given change)                          |
| `cm`   | comment on a work package                                                                |
| `tm`   | time tracking: list entries (me/everyone, period) or log hours                           |
| `rm`   | delete work packages permanently. **Always asks for confirmation**                       |
| `cx`   | account and instance, projects, statuses, types, priorities, members, versions           |

Ids: `123` or `#123`, `atual` (last read/created/changed), `ultimo` (first of the last listing). `alvos` (targets) also takes `12,15,18` or `lista` = every item of the last listing.

Dates: `2026-12-15`, `15/12`, `hoje`, `amanha`, `+3`, `-1`; `''` clears.

**Confirmation.** If the client supports MCP *elicitation*, the server asks the user directly. Otherwise the first call returns a preview and a code `cf`; only the identical call with that `cf` executes (valid 10 min, single use). Clients should show the preview and send `cf` only after explicit approval.

## Options

| env var                   | default                                                                 |
|---------------------------|-------------------------------------------------------------------------|
| `OPENPROJECT_URL`         | required, e.g. `https://op.example.com` (no `/api/v3`)                  |
| `OPENPROJECT_API_KEY`     | required                                                                |
| `OPENPROJECT_PROJECT`     | default project (identifier, name or id); empty = all projects          |
| `OPENPROJECT_MCP_CONFIRM` | `rm`. Tools that ask first, comma-separated: e.g. `rm,cm,new,up,tm`; `tudo` = every write. `rm` always asks |

Command line: `node src/main.ts check` (or `whoami`) tests the URL and token.

**Self-signed / internal CA certificate:** `NODE_EXTRA_CA_CERTS=/path/to/ca.pem`. Never disable TLS verification.
**Corporate proxy:** Node 22.21+ with `NODE_USE_ENV_PROXY=1` and `HTTPS_PROXY`.

## Notes on OpenProject

- Progress (`pct`) can only be set when the instance uses work-based (manual) progress; in status-based mode OpenProject rejects it and the error is passed through.
- Time entries: OpenProject 15+ links them to `entity`, older versions to `workPackage`; the server tries both. Some instances require an activity (`atividade: "Development"`).
- Deleting a work package is permanent and deletes its children. To close something, use `up` with a closed status.

## Security

- The token has exactly the permissions of its user. Prefer a dedicated user with access only to the projects the AI should touch.
- The token lives in your MCP client config; keep that file private.
- **Work package content is untrusted.** A description or comment can contain text trying to instruct the AI. The confirmation before delete (and, if you want, before every write) is the main defense; don't remove it.
- See [SECURITY.md](SECURITY.md) to report a vulnerability.

## Project layout

```
src/
  main.ts     entry: stdio (default) | check | whoami
  mcp.ts      MCP protocol: JSON-RPC, schema validation, confirmation (elicitation or cf code)
  op.ts       minimal OpenProject client: Basic auth (apikey), retry on 429/503, readable errors
  ref.ts      projects, statuses, types, priorities, members, versions: cached, fuzzy by name
  wp.ts       work package listing and create/update body
  ids.ts      'atual', 'ultimo', 'lista', '1,2,3'
  fmt.ts      tabular output, text cleanup
  lib.ts      config, dates, ISO 8601 durations, name matching
  tools/      one file per tool + index.ts
test/
  mock.ts     fake OpenProject API v3
  run.ts      real MCP clients (with and without elicitation) against the mock
```

## Development

```bash
node test/run.ts                                  # 51 checks, no network or OpenProject needed
npm i -D typescript @types/node && npx tsc -p .   # type check (optional)
```

## License

[MIT](LICENSE)
