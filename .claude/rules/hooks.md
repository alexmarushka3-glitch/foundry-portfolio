---
paths:
  - ".claude/hooks/**"
---

# Hook rules

- Hooks fail safe: if a hook gets bad, empty or unparseable input, or throws, it allows the action. A broken hook must never block Alex's work.
- Every hook change gets tests. Add or update a test case for each new or changed behavior, including the bad-input case.
- Run `npm test` before pushing.
