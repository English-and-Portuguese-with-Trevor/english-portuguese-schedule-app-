---
name: ship
description: Push to main the banked way in any of Trevor's repos: one push per repo at the end of the session or when Trevor says to ship, after the tests and build, with the GitHub Actions budget in mind (3,000 minutes a month for the whole account). Use whenever you are about to git push, or Trevor says "ship", "push", "deploy" or "send it". The same file in every repo.
---

# Ship (push to main)

Every push to `main` is a full deploy on GitHub Actions, and the organization (English-and-Portuguese-with-Trevor, GitHub Team) gets 3,000 Actions minutes a month for all its repos together. On 2026-10-23 it had used 2,772 (about 200 lessons deploys alone), so Trevor made the rule: **bank changes and push once**. Past the limit, GitHub stops the workflows for the rest of the month (the Actions budget is $0 unless Trevor raises it), so the sites could not be deployed until the 1st. The quota resets on the 1st of each month.

## What a push costs
GitHub bills every job rounded up to a whole minute; each deploy is one job.

| Repo | A push to main |
| --- | --- |
| lessons | about 4 min (tests 2 min, build, smoke test, uploads, deploy) |
| landing (`english-and-portuguese-with-trevor.github.io`), activities | 2 to 3 min |
| flashcards, dailies, conversations, notebook | about 2 min |
| schedule app (`english-portuguese-schedule-app-`) | free: a public repo (Vercel deploys it; the smoke run costs nothing) |

Also on the clock: the landing's daily database backup (about 2 min a day) and the lessons repo's nightly `translations.yml` (about 3 min a night). A push that changes only Markdown files, `docs/` or `.claude/` (lessons: `notes/`, `drafts/` too; dailies: `ideas/`) starts no deploy.

## Steps
1. **Commit as you go, don't push.** Keep working on `main` locally (or the session's branch); every finished change gets its own commit with a clear message. Pushing after each change is what used the budget up.
2. **Push when one of these is true:** Trevor says to ship, push, deploy or send it; the session is ending with committed work (never leave commits only in the container); or a fix students are waiting on can't wait (say so in the reply).
3. **Before the push:** `npx vitest run` and `npm run build` (plus `npm run smoke` when the change touches a page the smoke spec checks). The push hook runs the tests again; a red run blocks the push.
4. **One push per repo.** `git fetch origin main`, make sure `main` is up to date, then `git push -u origin main` once. In the lessons repo the deploys queue instead of canceling, so two pushes are two full runs; elsewhere a second push cancels the first run but its minutes are still spent. A change that touches several repos (the shared files, the account menu) is one push per repo, all at the end.
5. **Near the end of the month, or when in doubt, estimate the account's usage first** (the billing API isn't reachable from a session; Trevor reads the exact figure at https://github.com/organizations/English-and-Portuguese-with-Trevor/settings/billing). Where `gh` works:
   ```bash
   M=$(date -u +%Y-%m-01)
   runs() { local p=1 n total=0; while :; do
     n=$(gh api "repos/English-and-Portuguese-with-Trevor/$1/actions/runs?per_page=100&page=$p&created=>=$M" --jq '.workflow_runs | length')
     total=$((total + n)); [ "$n" -lt 100 ] && break; p=$((p + 1)); done; echo "$total"; }
   for r in lessons:4 english-and-portuguese-with-trevor.github.io:3 activities:3 flashcards:2 dailies:2 conversations:2 notebook:2; do
     n=$(runs "${r%%:*}"); echo "${r%%:*}: $n runs, about $((n * ${r##*:})) min"
   done
   ```
   (Page by hand: `gh api --paginate` follows links the session's proxy refuses.)    Add the lines up. Under about 100 minutes left in the month, push only fixes, and ask Trevor before anything else.
6. **Tell Trevor in one line** what went out and which repos deployed.

## Never
- Push to find out whether CI passes: run the tests and build here first.
- Push an empty commit, or a docs-only commit, to "kick" a deploy.
- Re-run a workflow by hand, except the lessons repo's **Lesson translations** when a hand translation must show before the nightly run.
- Add a job to a `deploy.yml`, or move the test, smoke or upload steps back into jobs of their own: every job costs at least a billed minute.
