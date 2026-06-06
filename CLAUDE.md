# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this project is

QuizForge is a serverless online quiz platform for university exams (Applicazioni di Bioinformatica — Genetica Umana — MedTec, Università del Sannio). It runs entirely on Google Sheets + Google Apps Script with static HTML frontends hosted on GitHub Pages. There is no build step, no package manager, and no local server.

**Live URL:** `https://franapoli.github.io/Esami/`
**Test data repo:** `https://github.com/franapoli/Esami.git` (cloned locally in `test/`, gitignored)

## Local development

Open HTML files directly in a browser, or use the local Python server:
```
python3 -m http.server 3456
```
Then open `http://localhost:3456/quiz_v2.html?id=<EXAM_ID>` or `admin_v2.html`.

## Pushing to GitHub (required to test live)

The working directory (`/Users/francesco/Library/CloudStorage/Dropbox/Claude/QuizForge/`) has **no git remote**. The GitHub remote lives only in `test/` (the local clone of `https://github.com/franapoli/Esami.git`).

After editing `admin_v2.html`, `quiz_v2.html`, or `quiz_apps_script_v2.js`:

1. Copy the changed files into `test/`:
   ```
   cp admin_v2.html quiz_v2.html quiz_apps_script_v2.js test/
   ```
2. Commit and push from `test/`:
   ```
   git -C test add admin_v2.html quiz_v2.html quiz_apps_script_v2.js
   git -C test commit -m "..."
   git -C test push
   ```

The pre-push hook in `test/.git/hooks/pre-push` auto-commits a BUILD update before pushing, so the admin panel shows the correct hash. **Always push after committing** — the live site at `https://franapoli.github.io/Esami/` is the only way to verify results.

## Deployment of Apps Script

The Apps Script backend must be deployed manually via the Google Apps Script web editor:
- Open the Apps Script project linked to `SHEET_RESULTS_ID` / `SHEET_QUESTIONS_ID`
- Paste/update `quiz_apps_script_v2.js`
- Bump `VERSION` constant before deploying
- Deploy as **Web App**: execute as *Me*, accessible by *Anyone*
- Copy the new deployment URL into `SCRIPT_URL` in both HTML files

The two HTML files (`quiz_v2.html`, `admin_v2.html`) are standalone static pages.

## Architecture

**Two Google Sheets:**
- **Questions Sheet** (`SHEET_QUESTIONS_ID = "1qrDVCr4yxBHD3qINQSl-Jk4hIU-O4OS4NVHXa3nbOzQ"`): tabs `questions` (question repository) and `tracce` (exam tracks).
- **Results Sheet** (`SHEET_RESULTS_ID = "1WQ1fnjN-j3o5yxjtH66qkmPIO532Y5t-DTSSK0MhOgA"`): one tab per `track_id`, plus `_meta` (track mirror) and `_config` (admin password).

**Apps Script (`quiz_apps_script_v2.js`)** — single `doPost` dispatcher. Actions:
- `getTrack` — resolves a track ID into ordered questions
- `verifyTrackPassword` — checks per-track access password
- `getAllTracks` / `setTrack` / `createTrack` — admin: list/update/create tracks
- `getQuestions` — admin: full question repository
- `addQuestion` — admin: append a question
- `setQuestionStato` — admin: toggle `bozza`/`verificato` on a single question
- `getMonitor` / `getResults` — admin: read student progress/scores
- `init` / `update` / `finalize` — exam lifecycle
- `resetPractice` — practice mode: delete previous attempt row
- `abandon` — delete student row (abandon in progress)

## Column schemas

**Questions sheet** (0-based):

| Const | Col | Content |
|-------|-----|---------|
| `Q_ID` | A | Unique ID (`q_xxxxxx`) |
| `Q_CORSO` | B | Course slug (e.g. `bioinf`) |
| `Q_CATEGORIA` | C | Category |
| `Q_SOTTOCATEG` | D | Subcategory |
| `Q_TAGS` | E | Comma-separated tags for random-pick filtering |
| `Q_STATO` | F | `bozza` \| `verificato` (default `verificato` for empty cells) |
| `Q_TIPO` | G | `mc` \| `fitb` \| `match` \| `free` \| `multi-fitb` \| `cloze` |
| `Q_TESTO` | H | Question text |
| `Q_OPTIONS` | I | JSON array of options (mc/match left-side); `[]` for other types |
| `Q_CORRETTA` | J | Letter A–Z (mc), exact string (fitb), JSON array of right-side answers (match) |
| `Q_PUNTI` | K | Points (default 1) |
| `Q_PLACEHOLDER` | L | Hint text shown in fitb input |
| `Q_DATA` | M | JSON for complex types: `multi-fitb` (`{boxes:[],cols}`) and `cloze` (`{dropdowns:[]}`) |

**Tracce sheet** (0-based):

| Const | Col | Content |
|-------|-----|---------|
| `T_ID` | A | Track ID (format below) |
| `T_MODALITA` | F | `exam` \| `practice` |
| `T_STATO` | G | `open` \| `closed` |
| `T_ITEMS` | H | JSON array of `{type:"fixed",id}` or `{type:"random",categoria?,sottocateg?,tag?}` |
| `T_PASSWORD` | I | Per-track access password (exam only; empty = no password) |

**Results sheet** (1-based for `getRange`):

| Const | Col | Content |
|-------|-----|---------|
| `COL_QIDS` | 9 | Comma-separated question IDs assigned to this student |
| `COL_ANS_FIRST` | 10 | Start of answer columns: `Ans1, Pt1, Ans2, Pt2, …` |

Answers are stored as raw index (mc), text (fitb/free/multi-fitb), or JSON (match/cloze). Points per question follow immediately in the next column.

## Question types

| Type | `correct` field | Notes |
|------|----------------|-------|
| `mc` | option index 0-N (after shuffle) | Options stored as JSON array; supports any number of options; shuffled client-side |
| `fitb` | exact string | Single text input |
| `match` | array of right-side answers (parallel to left) | Click-to-pair UI; no drag-drop |
| `free` | `null` | Large textarea; not auto-scored |
| `multi-fitb` | array of correct strings | Layout defined by `boxes[].cols` in Q_DATA |
| `cloze` | array of correct option indices | Text stored with `{{N}}` markers; split into text + `<select>` at render; **do not add `q.text` separately for cloze** |

## Track items (T_ITEMS)

Tracks store an ordered JSON array mixing fixed and random slots:
```json
[
  {"type": "fixed", "id": "q_a3f9b2"},
  {"type": "random", "categoria": "Genetica", "tag": "BRCA", "punti": 2}
]
```
Random slot fields are all optional: `categoria`, `sottocateg`, `tag`, `punti`. Omit a field to mean "any".

`resolveTraccia()` processes items in order; a shared `usedIds` Set ensures no question is picked twice (across both fixed and random slots). If a random slot has no eligible candidates (pool exhausted or filters too narrow), it is silently skipped.

**Important:** the `_count` field added by the admin UI to random items for local display is stripped by `cleanItemsForSave()` before any write to the sheet — it is never persisted.

## Exam vs practice mode

| | exam | practice |
|--|------|----------|
| Student form | required | visible (still saved) |
| Apps Script calls | init + update + finalize | init + update + finalize + resetPractice |
| Saves to Sheets | yes | yes (multiple attempts allowed) |
| One attempt | yes | no — `resetPractice` deletes previous row |
| Final result | score only | score + correct answers shown |
| Access password | optional (`T_PASSWORD`) | ignored |
| Open/closed check | yes | no (always accessible) |

## EXAM_ID format

```
<slug>-<YYYY-MM-DD>-<6char-alphanumeric-random>
```
Example: `quiz-vhl-2026-05-28-j94owo`. **Never change EXAM_ID after students have used it** — it is the sheet tab name. Claude generates the 6-char suffix when creating a new track.

## Admin panel (`admin_v2.html`)

- **Login screen** shows `BUILD` constant (auto-updated by pre-push hook) and script `VERSION` (fetched after login from `getAllTracks` response).
- **Tracce tab**: select existing track or `+ Crea nuova traccia` (`__new__`). Selecting `__new__` switches to the Domande tab with `currentTrack = null`.
- **Domande tab**: three modes — `new` (blank form), `edit` (loaded track, open), `readonly` (closed track). "Duplica traccia" copies items + metadata then calls `setDomandeMode("new", keepItems=true)`.
- Switching tabs or changing tracks when there is an unsaved new track triggers a confirmation guard (`hasUnsavedNewTrack()`).
- **Question browser** (left pane): 5 filters (categoria, sottocategoria, tag, punti, stato). Click row = preview; `←` button = add fixed slot. "Aggiungi casuale" adds a `{type:"random",…}` slot with current filters and a count of matches.
- **Preview modal**: `previewQuestion(id, event)` — shows full text, options with correct highlighted. Letter→index conversion uses `charCodeAt(0)-65` so 5+ options work correctly.
- `toggleStato(id)` — toggles `bozza`/`verificato` on a question via `setQuestionStato`; works from browser row badge and from preview modal.
- `cleanItemsForSave(items)` — strips `_count` (and any other `_`-prefixed local fields) from random slots before sending to the server.
- **Links to both Google Sheets** in header after login.
- `saveTrack()` sends `track_password` (not `password`) to avoid collision with the admin auth field.

## BUILD auto-update (pre-push hook)

`test/.git/hooks/pre-push` updates `const BUILD = "…"` in both `admin_v2.html` (in the test repo and in the main repo at the absolute path) to the current short commit hash, then auto-commits. The BUILD in admin reflects the commit *before* the current push (inherent limitation — hash is only known after commit).

## Admin authentication

Password stored in `_config` tab of Results Sheet (key `admin_password`). Default: `cambiami`.
