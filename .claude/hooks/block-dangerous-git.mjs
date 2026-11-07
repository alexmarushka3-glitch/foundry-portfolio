// PreToolUse hook (matcher: Bash). Blocks destructive git commands before Claude runs them.
// Node port of mattpocock/skills git-guardrails-claude-code (no jq or bash needed).
// Exit 2 = block and send stderr to Claude. Exit 0 = allow.

const BLOCKED = [
  [/\bgit\s+push\b/, 'git push'],
  [/\bgit\s+reset\s+--hard\b/, 'git reset --hard'],
  [/\bgit\s+clean\s+-\S*f/, 'git clean -f'],
  [/\bgit\s+branch\s+-D\b/, 'git branch -D'],
  [/\bgit\s+(?:checkout|restore)\s+\.(?:\s|$)/, 'git checkout . / git restore .'],
];

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
    if (pattern.test(command)) {
      console.error(
        `BLOCKED: '${command}' matches '${label}'. The user has prevented you from running this. Ask them to run it themselves.`,
      );
      process.exit(2);
    }
  }
  process.exit(0);
});
