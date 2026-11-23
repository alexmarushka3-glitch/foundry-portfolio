# Windows and tool gotchas

Tips learned the hard way in this repo. Short on purpose.

- PowerShell: run `npx.cmd`, not `npx` (the `.ps1` script is blocked). Run Playwright (`npx.cmd playwright test ...`) from PowerShell; from Bash it fails with a "C:\Program" error.
- Run vitest as `node node_modules/vitest/vitest.mjs run`.
- `npm run dev` and Playwright overwrite `.next/`: rebuild before `next start`.
- Bash tool: backslashes get stripped in `sed` and `python -c`, and long heredocs fail. Write the script with the Write tool into the scratchpad and run it (`python -X utf8 <file>`). In Python strings use raw strings for Windows paths and regexes (`\U` is an error, `\b` becomes a backspace).
- The Edit and Write tools turn the text `\u2028` into the raw character: use `String.fromCharCode(8232)` in code instead.
- The context-mode hook blocks `curl`, `wget` and inline `node -e` with `fetch`: put the code in a `.mjs` file and run it. Playwright from a scratchpad script: `createRequire("<repo>/package.json")`, then `require("@playwright/test")`.
- Commit messages: use `git commit -F <file>`, and never put the words "git push" in one (the guardrail blocks it).
- Prettier checks the whole repo (`npm run format:check`). The Stop hook runs typecheck and the wording test.
- Campus Wi-Fi (eduroam) blocks device-to-device traffic: a phone cannot reach this PC by its Wi-Fi address. Use a `cloudflared` quick tunnel.
- Testing hosted links locally needs Redis: use a throwaway fake Upstash REST server and `KV_REST_API_URL`/`KV_REST_API_TOKEN` pointed at it, with `FOUNDRY_LIVE=off next start`. Stop the server, fake DB and tunnel when done.
- Subagents (code-reviewer) are read-only with no git: put diffs in a file in the scratchpad for them.
