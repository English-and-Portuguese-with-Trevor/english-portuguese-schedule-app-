---
name: improve
description: Trevor's improvements list (docs/improvements.md in the landing repo, one list for every site) and the prompts that get its items done. Use when Trevor says "add to the list", "add this to the improvements document", "note that for later", "I want to improve…" without asking for it now, asks what's on the list, says he's ready to work on it or wants prompts for it, or says an item is done. The same file in every repo.
---

# The improvements list

One list for all of Trevor's sites: `docs/improvements.md` in the landing repo (`English-and-Portuguese-with-Trevor/english-and-portuguese-with-trevor.github.io`, branch `main`). Nothing else holds improvement ideas: no second list, no notes in other repos, no memory entries.

## Reaching it from any session
- Landing repo checked out: edit the file, commit it (message "Improvements: <what changed>") and push `main` right away. A commit that changes only `docs/` starts no deploy (the ship skill), and an item left only in a container is lost.
- Any other repo, or no repo: read and write it on GitHub directly, without cloning. In a cloud session, `mcp__github__get_file_contents` then `mcp__github__create_or_update_file` (path `docs/improvements.md`, branch `main`, the file's `sha`). On Trevor's computer, `gh api repos/English-and-Portuguese-with-Trevor/english-and-portuguese-with-trevor.github.io/contents/docs/improvements.md` (GET for the content and `sha`, PUT with the new base64 content). Never touch any other file in the landing repo from another repo's session.

## Adding an item
When Trevor says to add something to the list, add it and go back to what he was doing; don't start on it unless he says so.
1. Read the file (the format is at its top). Append under `## Open`:
   ```
   ### Short title
   - Added: <today> · Repo: <landing | lessons | flashcards | activities | dailies | conversations | notebook | schedule | several> · Status: open
   - <what's wrong today, or what he wants, in his words>
   - <where it lives, if known: page, component, file, CLAUDE.md rule>
   ```
2. Fill in what this session already knows (the file he's looking at, the rule it touches); ask only if the repo isn't clear from what he said. Two to five lines; a fresh session must understand it with no chat history.
3. Save as above and confirm in one line ("Added to the list: <title>").

## Making the prompts
When Trevor says he's ready to work on the list, asks for prompts, or names items to get ready:
1. Read the list. If he didn't say which items, show the open ones as one line each and ask which (or all).
2. Order them: one prompt per item, grouped by repo (one repo per session, his credits rule); items in the same repo that touch the same files can share a prompt. Anything that must land first (a migration, a shared file) goes first and the dependent prompt says so.
3. Write each prompt from this template, filled in from the list, the repo's CLAUDE.md and `docs/decisions.md`, and (when that repo is checked out) a quick look at the files named, so the session that gets it reads as little as possible:
   ```
   Repo: <name>. Read CLAUDE.md first.

   Goal: <one sentence>.

   Today: <what's wrong or missing, in Trevor's words>.
   Wanted: <what it should do or look like>.
   Where: <files, components, screens; "find it" when unknown>.
   Rules that apply: <the CLAUDE.md sections and decisions that bear on it, e.g. "Students see only what Trevor approves", every string in src/i18n/strings.js in es/pt/fr, keep it simple, no new dependency>.
   Done when: <the checks: npx vitest run, npm run build, npm run smoke when a checked page changes; what students will see>.
   Then: move "<title>" to Done in the landing repo's docs/improvements.md with today's date (the improve skill), commit, and push only per the ship skill.
   ```
4. Put the prompts in the chat, each in its own code block headed by its repo, in order, so Trevor pastes one per session. Nothing else in the reply but one line saying how many and in which order.

## Finishing an item
When a session ships an item, or Trevor says one is done: move its heading under `## Done`, change `Status: open` to `Status: done <date>` and add one line saying what shipped. Same save rules as above.

## Never
- Keep a copy of the list anywhere else, or start a second list.
- Write a prompt that depends on this chat: every prompt stands alone.
- Begin the work when Trevor only asked to add it to the list.
