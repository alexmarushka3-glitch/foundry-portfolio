// PreToolUse hook (matcher: Bash). Blocks destructive git commands before Claude runs them.
// Node port of mattpocock/skills git-guardrails-claude-code (no jq or bash needed).
// Exit 2 = block and send stderr to Claude. Exit 0 = allow.
//
// git push uses an exact allowlist. The only push that gets through is:
//   git push [-u | --set-upstream] <remote> <branch>
// where <branch> is plain letters, digits, . _ / - and is not main or master, and the remote
// has no remote.<name>.push setting. Anything else that mentions git (or a variable or backtick
// that could hide it) next to the word push is blocked: other options, refspecs (a:b), HEAD,
// a bare "git push", quotes, backslashes, ( ) $ and so on. The user pushes main, forces and
// deletes themselves.
//
// Also blocked: reset --hard, clean with -f/--force, branch -D (or -d with -f), checkout/restore
// of ".", git aliases, and git hidden behind a shell variable.
//
// A side effect: a commit message or PR body that contains the words "git push" is blocked.
// Write the message to a file and use `git commit -F <file>` instead.
//
// Known limits: this reads the command text only. Scripts (npm run, node -e) can still run
// git, and aliases already in ~/.gitconfig are not checked.
import { execFileSync } from 'node:child_process';

const PROTECTED_BRANCHES = new Set(['main', 'master']);
const ALLOWED_PUSH =
  /^\s*git\s+push(?:\s+(?:-u|--set-upstream))?\s+([A-Za-z0-9._-]+)\s+([A-Za-z0-9._/-]+)\s*$/;
// Global git options that take their value as the next word.
const GLOBAL_WITH_VALUE = new Set(['-C', '-c', '--git-dir', '--work-tree', '--namespace', '--exec-path', '--super-prefix']);

function block(command, label, why) {
  console.error(
    `BLOCKED: '${command}' matches '${label}'${why ? ` (${why})` : ''}. The user has prevented you from running this. Ask them to run it themselves.`,
  );
  process.exit(2);
}

// Strips quotes, and closing brackets or backticks left over from (git ...) or $(git ...).
const unquote = (s) => s.replace(/^["']+|["')`]+$/g, '');
// "git", "git.exe", a full path to git, or git glued to ( $( or a backtick.
const isGitWord = (w) => /(^|[\/\\(`$])git(\.exe)?$/i.test(w);

// Finds the git subcommand and its arguments in one command segment, or null if no git.
function parseGit(segment) {
  const words = segment.trim().split(/\s+/).map(unquote);
  const at = words.findIndex(isGitWord);
  if (at === -1) return null;
  let i = at + 1;
  while (i < words.length && words[i].startsWith('-')) {
    i += GLOBAL_WITH_VALUE.has(words[i]) ? 2 : 1;
  }
  if (i >= words.length) return null;
  return { sub: words[i], args: words.slice(i + 1) };
}

// Flags in an argument list: short letters from clusters like -fd, and long names.
function flagsOf(args) {
  const letters = new Set();
  const longs = new Set();
  for (const a of args) {
    if (a === '--') continue;
    if (a.startsWith('--')) longs.add(a.split('=')[0]);
    else if (a.startsWith('-') && a.length > 1) for (const c of a.slice(1)) letters.add(c);
  }
  return { letters, longs };
}

function destructiveProblem(segment) {
  const git = parseGit(segment);
  if (!git) return null;
  const { sub, args } = git;
  const { letters, longs } = flagsOf(args);
  const force = letters.has('f') || longs.has('--force');
  if (sub === 'reset' && longs.has('--hard')) return 'git reset --hard';
  if (sub === 'clean' && force) return 'git clean -f';
  if (sub === 'branch') {
    if (letters.has('D')) return 'git branch -D';
    if ((letters.has('d') || longs.has('--delete')) && force) return 'git branch -d -f';
  }
  // checkout/restore over the whole tree: ".", "./", ":/" (the repo root), with or without "--".
  if (sub === 'checkout' || sub === 'restore') {
    const wholeTree = args.some((a) => a === '.' || a === './' || a === ':/' || a === ':/.');
    const stagedOnly =
      sub === 'restore' && longs.has('--staged') && !longs.has('--worktree') && !letters.has('W');
    if (wholeTree && !stagedOnly) return `git ${sub} .`;
    if (sub === 'checkout' && force) return 'git checkout -f';
  }
  if (sub === 'stash' && (args[0] === 'clear' || args[0] === 'drop')) return `git stash ${args[0]}`;
  if (sub === 'update-ref' && (letters.has('d') || longs.has('--delete'))) return 'git update-ref -d';
  return null;
}

function currentSetting(args, cwd) {
  try {
    return execFileSync('git', ['config', '--get-all', ...args], {
      cwd: cwd || undefined,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return ''; // git config exits 1 when nothing is set
  }
}

// Returns a reason if this command segment is a push that must be blocked, else null.
function pushProblem(segment, cwd) {
  const mentionsPush = /\bpush\b/i.test(segment);
  // "git" as its own word (so .github and github.com are not mistaken for it), or a variable or
  // backtick that could hide it.
  const mentionsGit =
    /\bgit(\.exe)?\b/i.test(segment) || /\$[A-Za-z_{(]/.test(segment) || /`/.test(segment);
  if (!mentionsPush || !mentionsGit) return null; // not a push
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
  // Plain branch names only: no refs/... (tags, Gerrit refs/for/main) and no origin/main style.
  if (/^(refs|origin|upstream|remotes)\//i.test(branch)) return `unusual ref name ${branch}`;
  const name = branch.toLowerCase();
  if (PROTECTED_BRANCHES.has(name) || name === 'head') return `pushes ${branch}`;
  if (currentSetting([`remote.${remote}.push`], cwd)) {
    return `remote.${remote}.push is set in git config, which could send this to another branch`;
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

  // Join line continuations, and drop harmless redirects (2>&1, >/dev/null) so "&" in them
  // is not read as a command separator.
  const text = command
    .replace(/\\\r?\n/g, ' ')
    .replace(/\s*\d?>&\d\b/g, ' ')
    .replace(/\s*\d?>>?\s*\/dev\/null\b/g, ' ');

  if (/\bgit\b.*\balias\./.test(text)) block(command, 'git alias', 'could hide a push');
  // git run through a variable: g=git; $g push ...  /  $g reset --hard
  if (/=\s*["']?git(\.exe)?["']?(\s|;|&|\||$)/.test(text)) {
    block(command, 'git hidden behind a variable');
  }

  // A cd or pushd in the same command changes which repo a later push goes to, and the config
  // check below only sees the starting folder. So a push after a cd is blocked.
  const hasPush = text.split(/[;&|\n]+/).some((s) => pushProblem(s, cwd) !== null || ALLOWED_PUSH.test(s));
  if (hasPush && /(^|[;&|\n(]\s*)(cd|pushd)\b/.test(text)) {
    block(command, 'git push', 'cd or pushd in the same command');
  }

  // Check each command in a chain (; & | && || newline) on its own.
  for (const segment of text.split(/[;&|\n]+/)) {
    let pushWhy = null;
    let destructive = null;
    try {
      pushWhy = pushProblem(segment, cwd);
      if (!pushWhy) destructive = destructiveProblem(segment);
    } catch {
      pushWhy = 'could not read this command';
    }
    if (pushWhy) block(command, 'git push', pushWhy);
    if (destructive) block(command, destructive);
  }
  process.exit(0);
});
