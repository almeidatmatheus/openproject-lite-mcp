// tool registry: atomic, non-overlapping tools with short names

import { cx } from './cx.ts';
import { ls } from './ls.ts';
import { find } from './find.ts';
import { rd } from './rd.ts';
import { nw } from './new.ts';
import { up } from './up.ts';
import { cm } from './cm.ts';
import { rm } from './rm.ts';
import { tm } from './tm.ts';
import { rel } from './rel.ts';
import { cfg } from '../lib.ts';

export type Tool = {
  name: string;
  description: string;
  inputSchema: any;
  write?: boolean;
  readOnly?: (a: any) => boolean; // per-call: this call doesn't write (skips confirmation)
  preview?: (a: any) => Promise<string>; // tools that can require confirmation
  run: (a: any) => Promise<string>;
};

const ALL: Tool[] = [ls, find, rd, nw, up, cm, rel, tm, rm, cx];

// OPENPROJECT_MCP_DISABLE=rm,tm hides tools entirely (they can't be called)
export const tools: Tool[] = ALL.filter(t => !cfg().disable.has(t.name));
