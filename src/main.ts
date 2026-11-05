// entry: stdio MCP server (default) | whoami | check

import { stdio } from './mcp.ts';
import { op } from './op.ts';
import { cfg } from './lib.ts';

const cmd = process.argv[2] ?? 'stdio';

if (cmd === 'stdio') {
  const c = cfg();
  if (!c.url || !c.key) process.stderr.write('[openproject-lite-mcp] aviso: OPENPROJECT_URL/OPENPROJECT_API_KEY não definidos; as ferramentas vão devolver erro de configuração.\n');
  stdio();
} else if (cmd === 'whoami' || cmd === 'check') {
  try {
    const [root, me] = await Promise.all([op('GET', ''), op('GET', '/users/me')]);
    console.log(`ok: ${me.name} (${me.login ?? me.id}) em ${root?.instanceName ?? cfg().url}${root?.coreVersion ? ' v' + root.coreVersion : ''}`);
  } catch (e: any) {
    console.error('erro: ' + (e?.message ?? e));
    process.exit(1);
  }
} else {
  console.error('uso: node src/main.ts [stdio|whoami|check]');
  process.exit(2);
}
