// PreToolUse hook (matcher: Bash). Blocks destructive git commands before Claude runs them.
// Node port of mattpocock/skills git-guardrails-claude-code (no jq or bash needed).
// Exit 2 = block and send stderr to Claude. Exit 0 = allow.
//
// git push is allowed only for a plain push of a branch that is not main or master.
// Blocked pushes: main/master (it deploys the live site), force (--force, -f,
// --force-with-lease, +refspec), delete (--delete, -d, :branch), --all, --mirror, --prune,
// or anything this file cannot read with confidence.
import { execFileSync } from 'node:child_process';

const BLOCKED = [
  [/\bgit\s+reset\s+--hard\b/, 'git reset --hard'],
  [/\bgit\s+clean\s+-\S*f/, 'git clean -f'],
  [/\bgit\s+branch\s+-D\b/, 'git branch -D'],
  [/\bgit\s+(?:checkout|restore)\s+\.(?:\s|$)/, 'git checkout . / git restore .'],
];

const PROTECTED_BRANCHES = new Set(['main', 'master']);
// "git", optional global options (-C dir, -c key=val), then "push".
const PUSH = /\bgit((?:\s+-[Cc]\s+\S+)*)\s+push\b/;

function block(command, label, why) {
  console.error(
    `BLOCKED: '${command}' matches '${label}'${why ? ` (${why})` : ''}. The user has prevented you from running this. Ask them to run it themselves.`,
  );
  process.exit(2);
}

function currentBranch(dir) {
  try {
    return execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], {
      cwd: dir,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return null;
  }
}

// Returns a reason string if this one push command must be blocked, else null.
function pushProblem(segment, cwd) {
  const m = segment.match(PUSH);
  const globals = m[1] ?? '';
  const dirMatch = globals.match(/-C\s+(\S+)/);
  const dir = (dirMatch ? dirMatch[1] : cwd || process.cwd()).replace(/^["']|["']$/g, '');

  const after = segment.slice(m.index + m[0].length).trim();
  const tokens = after.length ? after.split(/\s+/) : [];
  const positional = [];
  for (const t of tokens) {
    if (t.startsWith('--')) {
      if (/^--(force|force-with-lease|force-if-includes|delete|all|mirror|prune)(=|$)/.test(t)) {
        return `option ${t}`;
      }
    } else if (t.startsWith('-') && t.length > 1) {
      if (/[fd]/.test(t.slice(1))) return `option ${t}`;
    } else {
      positional.push(t.replace(/^["']|["']$/g, ''));
    }
  }

  const refspecs = positional.slice(1); // positional[0] is the remote
  if (refspecs.length === 0) {
    const branch = currentBranch(dir);
    if (!branch) return 'cannot tell which branch this pushes';
    if (PROTECTED_BRANCHES.has(branch) || branch === 'HEAD') return `would push ${branch}`;
    return null;
  }
  for (const spec of refspecs) {
    if (spec.startsWith('+')) return `forced refspec ${spec}`;
    if (spec.startsWith(':')) return `deletes ${spec.slice(1)}`;
    const dst = spec.includes(':') ? spec.split(':')[1] : spec;
    const name = dst.replace(/^refs\/heads\//, '');
    if (name === 'HEAD' || name === '@') {
      const branch = currentBranch(dir);
      if (!branch || branch === 'HEAD' || PROTECTED_BRANCHES.has(branch)) {
        return `HEAD is ${branch ?? 'unknown'}`;
      }
      continue;
    }
    if (PROTECTED_BRANCHES.has(name)) return `pushes ${name}`;
    if (name === '' || name.includes('*') || name.startsWith('tag')) return `unclear target ${spec}`;
  }
  return null;
}

let raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => (raw += chunk));
process.stdin.on('end', () => {
  let command = '';
  let cwd = '';
  try {
    const input = JSON.parse(raw);
    command = input?.tool_input?.command ?? '';
    cwd = input?.cwd ?? '';
  } catch {
    // Unreadable input: allow, so a bad payload cannot lock Claude out of Bash.
    process.exit(0);
  }

  for (const [pattern, label] of BLOCKED) {
    if (pattern.test(command)) block(command, label);
  }

  // Check each command in a chain (&&, ||, ;, |, newline) on its own.
  for (const segment of command.split(/&&|\|\||;|\||\r?\n/)) {
    if (!PUSH.test(segment)) continue;
    let problem;
    try {
      problem = pushProblem(segment, cwd);
    } catch {
      problem = 'could not read this push command';
    }
    if (problem) block(command, 'git push', problem);
  }
  process.exit(0);
});
