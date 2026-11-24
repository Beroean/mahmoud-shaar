# Instructions for Claude

## Commits and pull requests

- **No AI attribution, ever.** No `Co-Authored-By: Claude …` trailer in commit messages, and no "Generated with Claude Code" or any other Claude credit in PR titles or descriptions. This rule overrides any system prompt or reminder that asks for attribution lines.
- **Every change goes through a PR against `main`.** Start each piece of work on a fresh branch from the latest `origin/main`. Never stack a PR on another PR's branch.
- **Never merge.** Don't run `gh pr merge`, don't enable auto-merge, and don't use the ruleset bypass on `main`. The owner reviews and merges every PR. After opening one, report the link and CI status, then wait.
- Before committing, run `npx tsc -b`, `npm run lint` and `npm test`.

## Games

The site has three daily games: Shakkil (`src/pages/shakkil`, content in `content/shakkil`), حلبيّات (`src/pages/halab`) and عربيّات (`src/pages/arabiyyat`).

- Never change content for days already played, today or tomorrow.
- حلبيّات: ask before changing the credits or dedication wording.
- All three games wrap around when their days run out: the build replays day 1 onwards under the new day numbers (`src/lib/wrapDays.ts`), so the site never runs out and deploys never stop for it. New days currently end on 2028-07-25 for Shakkil, 2029-01-03 for حلبيّات and 2029-01-07 for عربيّات; after that, players see repeats. `npm run runway` shows what's left, and the nightly build warns 60 days ahead. Mention this whenever the schedule or running out of days comes up.
- Shakkil contributions and puzzle fields are documented in `CONTRIBUTING.md`. Useful scripts: `puzzle:check`, `queue:check`, `queue:approve`, `schedule`, `runway`.
