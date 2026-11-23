// PreToolUse hook for the GitHub MCP server (.mcp.json, tools named mcp__github__*).
// The Bash hook (block-dangerous-git.mjs) never sees these calls, so this one covers the tools
// that merge a pull request, delete anything, or write files straight to a branch (push_files and
// create_or_update_file can write to main, which skips the never-push-to-main rule). They get a
// permission prompt (permissionDecision "ask" with a short reason), not a block. Exit 0 either way.
//
// The settings.json matcher picks the tools; this script checks the tool name again so a loose
// matcher can never ask for a read tool. Any other tool, or an unreadable payload, is allowed.
// update_pull_request and issue_write are left out on purpose.
const ASK_TOOLS = /^mcp__github__(merge_pull_request|delete_.+|push_files|create_or_update_file)$/;

// Plain text only, and short: tool input comes from the model and may hold anything.
const plain = (v, max) =>
  typeof v === 'string' || typeof v === 'number'
    ? String(v)
        .replace(/[^\w.\-/]/g, '')
        .slice(0, max)
    : '';

let raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => (raw += chunk));
process.stdin.on('end', () => {
  let tool = '';
  let input = null;
  try {
    const payload = JSON.parse(raw);
    tool = typeof payload?.tool_name === 'string' ? payload.tool_name : '';
    input = payload?.tool_input;
  } catch {
    process.exit(0); // unreadable payload: allow, so a bad payload cannot lock Claude out
  }
  if (!ASK_TOOLS.test(tool)) process.exit(0);

  const i = input && typeof input === 'object' ? input : {};
  const repo = i.owner && i.repo ? `${plain(i.owner, 30)}/${plain(i.repo, 30)}` : '';
  const merge = tool.endsWith('merge_pull_request');
  const write = tool.endsWith('push_files') || tool.endsWith('create_or_update_file');
  const pr = merge && i.pullNumber ? `#${plain(i.pullNumber, 8)}` : '';
  const branch = write && i.branch ? `@${plain(i.branch, 30)}` : '';
  const target = repo ? ` on ${repo}${pr}${branch}` : '';
  const what = merge
    ? 'merges a pull request'
    : write
      ? 'writes files straight to a branch'
      : 'deletes something';
  const reason = `${tool} ${what}${target}; confirm with Alex first`.slice(0, 118);

  const decision = {
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'ask',
      permissionDecisionReason: reason,
    },
  };
  process.stdout.write(JSON.stringify(decision) + '\n', () => process.exit(0));
});
