// Stop hook. Before Claude finishes a turn that changed source files, run the typecheck and
// the wording test (tests/copy.test.ts). If either fails, exit 2: the output goes back to
// Claude, which has to fix it before it can stop. Exit 0 = allow.

import { spawnSync } from 'node:child_process';

const SOURCE = /^(app|components|lib|scripts|tests|docs|public)\/|^(package\.json|tsconfig\.json|next\.config\.ts|vitest\.config\.ts)$/;
const CHECKS = [
  ['typecheck', 'npm run typecheck'],
  ['wording test (tests/copy.test.ts)', 'npm test -- tests/copy.test.ts'],
];

let raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => (raw += chunk));
process.stdin.on('end', () => {
  let input = {};
  try {
    input = JSON.parse(raw);
  } catch {
    process.exit(0);
  }

  // Claude is already continuing because of this hook: let it stop, so a failure it cannot fix
  // does not loop.
  if (input.stop_hook_active) process.exit(0);

  const root = process.env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd();

  // Skip chat-only turns: run the checks only when source files have uncommitted changes.
  const status = spawnSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' });
  if (status.status !== 0) process.exit(0);
  const changed = status.stdout
    .split('\n')
    .filter(Boolean)
    .map((line) => line.slice(3).replace(/^"|"$/g, '').split(' -> ').pop());
  if (!changed.some((file) => SOURCE.test(file))) process.exit(0);

  for (const [label, command] of CHECKS) {
    const run = spawnSync(command, { cwd: root, shell: true, encoding: 'utf8', timeout: 150000 });
    if (run.status !== 0) {
      const output = `${run.stdout ?? ''}${run.stderr ?? ''}`.trim().split('\n').slice(-40).join('\n');
      console.error(`Do not finish yet: the ${label} failed. Fix it, then check again.\n\n${output}`);
      process.exit(2);
    }
  }
  process.exit(0);
});
