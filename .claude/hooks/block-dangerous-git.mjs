// PreToolUse hook (matcher: Bash). Blocks destructive git commands before Claude runs them.
// Node port of mattpocock/skills git-guardrails-claude-code (no jq or bash needed).
// Exit 2 = block and send stderr to Claude. Exit 0 = allow.
//
// git push uses an exact allowlist. The only push that gets through is:
//   git push [-u | --set-upstream] <remote> <branch>
// where <branch> is plain letters, digits, . _ / - and is not main or master.
// Anything else that mentions git and push is blocked: other options, refspecs (a:b),
// HEAD, a bare "git push", variables, quotes, backslashes, ( ) ` $ and so on. The user
// pushes main, forces and deletes themselves.
//
// Known limit: this reads the command text only. Scripts (npm run, node -e) can still run git.

// "git", optional global options (-C dir, -c k=v, --no-pager, ...), then the subcommand.
const GIT = String.raw`\bgit(?:\.exe)?(?:\s+(?:-[Cc]\s+\S+|--?[A-Za-z][\w-]*(?:=\S+)?))*\s+`;

const BLOCKED = [
  [new RegExp(GIT + String.raw`reset\s+--hard\b`), 'git reset --hard'],
  [new RegExp(GIT + String.raw`clean\s+-\S*f`), 'git clean -f'],
  [new RegExp(GIT + String.raw`branch\s+-D\b`), 'git branch -D'],
  [new RegExp(GIT + String.raw`(?:checkout|restore)\s+\.(?:\s|$)`), 'git checkout . / git restore .'],
  // Aliases could hide a push (git config alias.pm "push origin main"; git -c alias.p=push p).
  [/\bgit\b.*\balias\./, 'git alias (could hide a push)'],
];

const PROTECTED_BRANCHES = new Set(['main', 'master']);
const ALLOWED_PUSH =
  /^\s*git\s+push(?:\s+(?:-u|--set-upstream))?\s+([A-Za-z0-9._-]+)\s+([A-Za-z0-9._/-]+)\s*$/;

function block(command, label, why) {
  console.error(
    `BLOCKED: '${command}' matches '${label}'${why ? ` (${why})` : ''}. The user has prevented you from running this. Ask them to run it themselves.`,
  );
  process.exit(2);
}

// Returns a reason if this command segment is a push that must be blocked, else null.
function pushProblem(segment) {
  if (!/\bgit/i.test(segment) || !/\bpush\b/i.test(segment)) return null; // not a push
  const m = segment.match(ALLOWED_PUSH);
  if (!m) {
    return 'only "git push [-u] <remote> <branch>" is allowed, with a plain branch name';
  }
  const [, remote, branch] = m;
  if (remote.startsWith('-')) return 'bad remote';
  if (branch.startsWith('-') || branch.startsWith('/') || branch.endsWith('/')) {
    return 'bad branch name';
  }
  if (branch.includes('..') || branch.split('/').some((part) => part === '' || part === '.')) {
    return 'bad branch name';
  }
  const name = branch.replace(/^refs\/heads\//, '').toLowerCase();
  if (PROTECTED_BRANCHES.has(name) || name === 'head') return `pushes ${branch}`;
  return null;
}

let raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => (raw += chunk));
process.stdin.on('end', () => {
  let command = '';
  try {
    command = JSON.parse(raw)?.tool_input?.command ?? '';
  } catch {
    // Unreadable input: allow, so a bad payload cannot lock Claude out of Bash.
    process.exit(0);
  }

  for (const [pattern, label] of BLOCKED) {
    if (pattern.test(command)) block(command, label);
  }

  // Check each command in a chain (; & | && || newline) on its own.
  for (const segment of command.split(/[;&|\n]+/)) {
    let problem;
    try {
      problem = pushProblem(segment);
    } catch {
      problem = 'could not read this command';
    }
    if (problem) block(command, 'git push', problem);
  }
  process.exit(0);
});
