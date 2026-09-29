# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this project is

QuizForge is a serverless online quiz platform for university exams (Applicazioni di Bioinformatica — Genetica Umana — MedTec, Università del Sannio). It runs entirely on Google Sheets + Google Apps Script with static HTML frontends hosted on GitHub Pages. There is no build step and no package manager.

**Live URL:** `https://franapoli.github.io/Esami/`
**GitHub remote:** `https://github.com/franapoli/Esami.git`

## Local development

Open HTML files directly in a browser, or use the local Python server:
```
python3 -m http.server 3456
```
Then open `http://localhost:3456/quiz_v2.html?id=<EXAM_ID>` or `admin_v2.html`. Always add `?test` when testing (see below), and a throwaway `&nocache=…` parameter: the Python server sends no cache headers and browsers happily serve stale pages.

## Two deployments: production and test

| env | script URL | used by |
|-----|-----------|---------|
| production | `config.json` → `script_url` | pages **without** `?test` |
| test | `TEST_SCRIPT_URL` constant in both HTML files | pages **with** `?test` (red "AMBIENTE DI TEST" banner) |

They are independent Apps Script deployments and drift apart easily. **Never touch production data while testing** — use `?test`. The version shown in the Apps Script editor is not necessarily the live one: `doGet` returns it on a plain GET (`curl -sL "<script url>"` → `{"version":"…"}`). When the page needs an action the deployed script lacks, the fallthrough answers "Azione «X» non disponibile nello script N" and the admin appends a "serve un nuovo deploy" hint (`versioneScriptHint()`).

## Pushing to GitHub (required to test live)

Git is initialized directly in the working directory `/Users/francesco/Library/CloudStorage/Dropbox/Claude/QuizForge/`. Push with:
```
git add admin_v2.html quiz_v2.html quiz_apps_script_v2.js
git commit -m "..."
git push
```

The pre-commit hook in `.git/hooks/pre-commit` aggiorna automaticamente `const BUILD` in `admin_v2.html` all'hash HEAD (il commit precedente) prima di ogni commit. Il BUILD riflette quindi il commit genitore — un solo `git push` è sufficiente per aggiornare il live.

## Deployment of Apps Script

The Apps Script backend must be deployed manually via the Google Apps Script web editor:
- Open the Apps Script project linked to `SHEET_RESULTS_ID` / `SHEET_QUESTIONS_ID`
- Paste/update `quiz_apps_script_v2.js`
- Bump `VERSION` constant before deploying
- Deploy as **Web App**: execute as *Me*, accessible by *Anyone*
- To update an existing deployment: Deploy → Gestisci deployment → pencil → Versione "Nuova versione". Creating a new deployment changes the URL (then `config.json` / `TEST_SCRIPT_URL` must be updated).
- `finalize` freezes scores with the code live at submission time: redeploying during an exam splits the cohort between two versions.

**The backend file is also loaded in the browser.** `admin_v2.html` (`loadAdminBackend()`) and `quiz_v2.html?preview` fetch `quiz_apps_script_v2.js` and evaluate it in an isolated scope to reuse `canonicalForm`, `buildQuestionObj`, `scoreAnswer`, `validateQuestion`, `lintQuestion`, `normalizeIncomingQuestion`. Top-level code must therefore stay browser-safe (no Apps Script calls outside functions). The browser uses the file published on GitHub Pages, so previews can differ from the deployed script until it is redeployed — the admin warns about version mismatch.

The two HTML files (`quiz_v2.html`, `admin_v2.html`) are standalone static pages.

## Architecture

**Two Google Sheets** (IDs stored in ScriptProperties; defaults hardcoded as fallback):
- **Questions Sheet** (`SHEET_QUESTIONS_ID_DEFAULT = "1qrDVCr4yxBHD3qINQSl-Jk4hIU-O4OS4NVHXa3nbOzQ"`): tabs `questions`, `tracce`, `esami`, `eliminate` (trash: deleted question rows + deletion date, created on first delete).
- **Results Sheet** (`SHEET_RESULTS_ID_DEFAULT = "1WQ1fnjN-j3o5yxjtH66qkmPIO532Y5t-DTSSK0MhOgA"`): one tab per `exam_id`, plus `Esami` (exam mirror) and `_config` (admin password + extra time).

Sheet IDs and the Apps Script URL (`SCRIPT_URL`) can be changed from the admin header without redeploying — they are stored in `ScriptProperties` and also saved in the HTML via `loadSheetConfig` / `saveSheetConfig`.

**Drive folder** (`1FCl15simn4Ev363a59aEfOq1qZF4T78H`): admin can list spreadsheets in this folder and create new Questions/Results sheets from the UI. New sheets are moved into the folder via `DriveApp` (requires `oauthScopes` in `appsscript.json` including `https://www.googleapis.com/auth/drive`).

**Apps Script (`quiz_apps_script_v2.js`)** — single `doPost` dispatcher. Actions:
- `getTrack` — returns exam metadata + counts (`n_questions`, `total_pts`) for the cover; duration includes `extra_time:EXAM_ID:all` from `_config`. **Never returns question content** (anti pre-exam harvesting).
- `verifyTrackPassword` — checks per-exam access password
- `getAllTracks` / `setTrack` / `createTrack` — admin: list/update/create **tracce** (templates)
- `getAllEsami` / `setEsame` / `createEsame` — admin: list/update/create **esami** (sessions)
- `getQuestions` — admin: full question repository
- `addQuestion` — admin: append a question as-is (legacy, no validation)
- `createQuestion` — admin: append a **validated** question (`{question}` → `{status:"ok",question}` or `{status:"invalid",errors}`); used by the editor ("salva come nuova")
- `createQuestions` — admin batch (3.4.0+): `{questions:[…]}`, all validated first (all-or-nothing → `{status:"invalid",invalid:[{index,errors}]}`), then written as one block; used by the Moodle import (falls back to one `createQuestion` per question on older scripts)
- `updateQuestion` — admin: overwrite a question; `expected` = the question as opened, returns `conflict` + current row if the sheet changed meanwhile
- `updateQuestionsMeta` — admin bulk edit (3.3.0+): `{ids, set:{categoria?,sottocateg?,stato?,punti?}, addTags?, removeTags?}`; writes only columns C–F and K of rows that actually change, never text/answers; returns `{questions, missing}`
- `deleteQuestions` — admin (3.5.0+): `{ids}`. Refuses everything (`status:"blocked"`, `blocked:[{id,exams}]`) if any question is assigned (`COL_QIDS`) to a student of an **open** exam. Otherwise copies the rows to the `eliminate` tab, deletes them (bottom-up, contiguous blocks) and removes them from tracce **fixed** slots (returns `tracce:[{track_id,removed,items}]`). `getQuestions` also returns the trash as `deleted`, used by the results detail so past exams stay readable.
- `setQuestionStato` — admin: toggle `bozza`/`verificato` on a single question
- `getQuestionStats` — admin: per-question answer statistics
- `getImages` — student: base64 images of the questions **assigned to that student** only (needs their row)
- `getImagesAdmin` — admin: images referenced by the bank or files inside the QuizForge Drive tree
- `listFolders` / `createFolder` / `uploadImage` — admin: browse/create folders and upload images, restricted to the QuizForge Drive tree (`folderPathInTree`, `folderInTree`)
- `getMonitor` / `getResults` — admin: read student progress/scores
- `init` — assigns questions **server-side** (ignores any client-sent IDs), stores them in `COL_QIDS`, returns the question objects (without correct answers) to render
- `update` — saves only the raw answer (no points); rejected after finalization; response includes `extra_minutes_individual` for per-student extra time
- `finalize` — recomputes the score **server-side** from `COL_QIDS`; ignores client score/pts; uses server timestamps; checks elapsed against `duration + extra_all + extra_individual`; freezes the score on first submit (re-finalize is idempotent → anti-oracle); returns correct answers only in practice
- `resetPractice` — practice mode: deletes previous row and re-assigns questions server-side
- `abandon` — delete student row (abandon in progress)
- `addExtraTime` — admin: adds (or subtracts) minutes for `scope:"all"` or a specific matricola; stored in `_config` as `extra_time:EXAM_ID:all` / `extra_time:EXAM_ID:MATRICOLA`
- `createSheet` — create a new Questions or Results spreadsheet in the Drive folder
- `getConfig` / `saveSheetConfig` — read/write ScriptProperties (sheet IDs, script URL)
- `listDriveFolder` — list spreadsheets in the configured Drive folder

## Security model (v2.12+) — anti-cheating

The exam is built so a student cannot extract answers or forge a score from the browser:

- **Correct answers never reach the client during an exam.** `buildQuestionObj(q, pos, withCorrect)` omits the `correct` field unless `withCorrect=true`. For `match` questions, `q.right` (the list of right-side display labels) is **always** sent — it is needed to render the UI. Only `q.correct` (the right-side labels, same as `q.right`) is withheld. `getTrack` returns no question content at all.
- **Questions are assigned server-side.** The client does not choose which questions are scored; `init`/`resetPractice` resolve the traccia on the server, store the IDs in `COL_QIDS`, and return the set. The client renders exactly that set and persists it in `localStorage` for resume (needed for random tracce).
- **Scoring is server-side.** `update` stores only raw answers; `finalize` recomputes the score from `COL_QIDS` via `scoreAnswer()`. Client-sent `score`/`pts` are ignored.
- **No score oracle.** In exam mode the score is frozen on first `finalize`; re-submitting different answers always returns the same stored score (idempotent), so a student cannot binary-search the answers by reading the score.
- **Server-side timing.** `finalize` computes elapsed from the server-recorded start (`COL_TS_START`, written at init) to server now; client timestamps are ignored. Submissions over `(duration + extra_all + extra_individual) + 60s` are flagged `⚠ oltre tempo` in `COL_ELAPSED`.
- **Concurrency.** `init`/`finalize` use `LockService` to avoid duplicate-row / double-submit races.

**Residual / operational risks (not code bugs):**
- The Questions Sheet holds the answer key — keep both sheets private (owner-only). Public read access defeats everything.
- Do **not** create a `practice` esame on the **same traccia** used by a live `exam`: practice reveals correct answers, which a student could then recognise in the real exam (same question IDs).
- The client time limit is enforced softly (flagged, not a hard server cutoff) — a student disabling the JS timer keeps working, but the overrun is recorded for the instructor.
- `abandon` lets a student reroll random questions (fresh draw, no answer knowledge).
- `free` questions are not auto-scored (manual grading by design).
- Images are private Drive files served as base64 by the script (`getImages`, cached in `CacheService` in chunks); a student only receives images of their assigned questions.

## Esami vs Tracce (v2.11+)

**Traccia** = reusable question-set template. Stored in the `tracce` tab of the Questions Sheet.
**Esame** = a contextualised exam session that references a traccia. Stored in the `esami` tab of the Questions Sheet. Multiple esami can reuse the same traccia.

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
| `Q_TIPO` | G | `mc` \| `multi-mc` \| `fitb` \| `match` \| `free` \| `multi-fitb` \| `cloze` |
| `Q_TESTO` | H | Question text — in the text format (below) it holds the whole question, answers included |
| `Q_OPTIONS` | I | Legacy: JSON array of options (mc/match left-side); `[]` in the text format |
| `Q_CORRETTA` | J | Legacy: letter A–Z (mc), letters `A,C` (multi-mc), exact string (fitb), JSON array of right-side answers (match); empty in the text format |
| `Q_PUNTI` | K | Points (default 1) |
| `Q_PLACEHOLDER` | L | Hint text shown in fitb input |
| `Q_DATA` | M | Legacy JSON for complex types: `multi-fitb` (`{boxes:[],cols}`) and `cloze` (`{dropdowns:[]}`); empty in the text format |

Text columns are written with number format `@` and a leading `'` before `= + - @` (`sheetText`) so Sheets does not turn answers into dates, numbers or formulas.

**Tracce sheet** (0-based, 3 columns):

| Const | Col | Content |
|-------|-----|---------|
| `T_ID` | A | Track ID (`t-<6char>`) |
| `T_NOME` | B | Track name |
| `T_ITEMS` | C | JSON array of `{type:"fixed",id}` or `{type:"random",categoria?,sottocateg?,tag?,punti?}` |

**Esami sheet** (0-based, 10 columns):

| Const | Col | Content |
|-------|-----|---------|
| `E_ID` | A | Exam ID (`YYYY-MM-DD-<6char>`) |
| `E_TRACCIA` | B | `traccia_id` reference |
| *(reserved)* | C | *(was exam name — no longer used)* |
| `E_DATA` | D | Date `YYYY-MM-DD` |
| `E_DURATA` | E | Duration in minutes |
| `E_CORSO` | F | Course name |
| `E_MODALITA` | G | `exam` \| `practice` |
| `E_STATO` | H | `open` \| `closed` |
| `E_PASSWORD` | I | Per-exam access password (exam only; empty = no password) |
| `E_SHUFFLE` | J | `"no"` = shuffle opzioni disabilitato; vuoto o `"si"` = abilitato (default) |

**Results sheet** (1-based for `getRange`):

| Const | Col | Content |
|-------|-----|---------|
| `COL_QIDS` | 9 | Comma-separated question IDs assigned to this student |
| `COL_ANS_FIRST` | 10 | Start of answer columns: `Ans1, Pt1, Ans2, Pt2, …` |

Answers are stored as raw index (mc), text (fitb/free/multi-fitb), or JSON (match/cloze). Points per question follow immediately in the next column.

**`_config` tab** (Results Sheet) — key/value pairs:

| Key | Value |
|-----|-------|
| `admin_password` | Admin password (default `cambiami`) |
| `extra_time:EXAM_ID:all` | Extra minutes for all students in that exam (cumulative; can be negative) |
| `extra_time:EXAM_ID:MATRICOLA` | Extra minutes for a specific student (cumulative; on top of "all") |

## Question text format (v3.0.0+)

A question can be written entirely in the Testo column; the editor shows and saves exactly this. `[[…]]` is an answer or an item, `*` at its start marks the correct one:

| Type | Syntax |
|------|--------|
| `mc` | question, then one option per line: `[[*giusta]]` `[[sbagliata]]` … |
| `multi-mc` | as mc, with `*` on every correct option |
| `fitb` | `Il codone di inizio è [[AUG]].` — the box appears in place |
| `multi-fitb` | every `[[risposta]]` becomes an inline box (also inside HTML tables); boxes weigh the same |
| `match` | instructions, then one pair per line: `[[Adenina => Timina]]` |
| `cloze` | inline menu `{{[[*locali]] [[globali]]}}`; reusable list `{{basi = [[A]] [[C]] [[G]] [[T]]}}` declared once (not shown), then `{{basi: 4}}` = menu from that list whose correct answer is item **4** (1-based position, never the text) |
| `free` | plain text |

Images: `[img:DRIVE_ID]` or `[img:DRIVE_ID|400]` (width in px), anywhere in the text. Text may contain HTML; tags are detected browser-style (`<` + letter, `/` or `!`), so `p < 0,05` is text.

`canonicalForm(q)` (server, also loaded in the browser) reduces the text format to the internal form (options / corretta / data) — the same form legacy rows already have, so **old rows with columns I, J, M keep working unchanged**. Everything that prepares, scores, validates or lints a question goes through it; the `*` markers never reach students. The editor converts legacy questions to the text format when opened (`questionToText`) only if the round trip is exact; otherwise it keeps the legacy form.

## Question types

| Type | `correct` field | Notes |
|------|----------------|-------|
| `mc` | option index 0-N (after shuffle) | Options stored as JSON array; supports any number of options; shuffled client-side |
| `multi-mc` | indices of the correct options | Checkboxes. Score = max(0, (right − wrong) / n_correct × punti) |
| `fitb` | exact string | Single text input |
| `match` | right-side labels (same as `q.right`) | `q.right` always sent; `q.correct` withheld during exam. Scoring: proportional — client sends indices into `right[]`, each correct match scores `punti/n`. Sheet `corretta` = JSON array of right-side label strings. |
| `free` | `null` | Large textarea; not auto-scored |
| `multi-fitb` | array of correct strings | Legacy `Q_DATA` = `{cols, boxes:[{label,cols,pts,correct},...]}`. Box `pts` are **relative weights** (`boxWeight`, default 1): score = Σ weights of correct boxes / Σ weights × punti. |
| `cloze` | array of correct option indices | Internal text has `{{N}}` markers; split into text (rendered as HTML) + `<select>` at render; **do not add `q.text` separately for cloze** |

Partial scores (multi-mc, match, multi-fitb, cloze) are rounded to 2 decimals; `punti` (and a traccia slot's `punti` override) can be fractional. Text comparisons ignore case and surrounding spaces.

## Track items (T_ITEMS)

Tracce store an ordered JSON array mixing fixed and random slots:
```json
[
  {"type": "fixed", "id": "q_a3f9b2"},
  {"type": "random", "categoria": "Genetica", "tag": "BRCA", "punti": 2}
]
```
Random slot fields are all optional: `categoria`, `sottocateg`, `tag`, `punti`. Omit a field to mean "any".

`resolveEsame()` reads the esame → finds its traccia → resolves questions. A shared `usedIds` Set ensures no question is picked twice. If a random slot has no eligible candidates, it is silently skipped.

**Important:** the `_count` field added by the admin UI to random items is stripped by `cleanItemsForSave()` before any write — it is never persisted.

## Extra time for students (v2.19+)

The admin can add (or subtract) minutes from the monitor panel:
- **"+ Tutti"**: applies to all students in the exam; stored as `extra_time:EXAM_ID:all`
- **"+ Studente selezionato"**: applies to one student (click row to select); stored as `extra_time:EXAM_ID:MATRICOLA`

Propagation to running clients:
- **Global** (`all`): `getTrack` returns `duration + extra_all`; the quiz client polls `getTrack` every 60s via `refreshDuration()` and also on every question navigation.
- **Individual**: the `update` response includes `extra_minutes_individual`; the client applies the delta on the next answer save.
- After extra time is applied, a green toast appears in the student sidebar.
- Once a quiz ends (`quizEnded = true`), no further extra-time updates are applied client-side. `finalize` always uses the server-side totals correctly regardless.

## Exam vs practice mode

| | exam | practice |
|--|------|----------|
| Student form | required | visible (still saved) |
| Apps Script calls | init + update + finalize | init + update + finalize + resetPractice |
| Saves to Sheets | yes | yes (multiple attempts allowed) |
| One attempt | yes | no — `resetPractice` deletes previous row |
| Final result | score only | score + correct answers shown |
| Access password | optional (`E_PASSWORD`) | ignored |
| Open/closed check | yes | no (always accessible) |

## EXAM_ID format

```
YYYY-MM-DD-<6char-alphanumeric-random>
```
Example: `2026-06-09-j94owo`. **Never change EXAM_ID after students have used it** — it is the sheet tab name in the Results Sheet.

Track IDs use format `t-<6char>`, e.g. `t-aaa111`.

## Admin panel (`admin_v2.html`)

Two separate selectors in the header bar: **Esame** (exam session) and, in the Tracce tab, **Traccia** (template).

- **Login screen** shows `BUILD` (auto-updated by pre-push hook) and script `VERSION` (from `getAllEsami` response).
- **Esame tab**: single card with status (dot, open/closed badge, exam_id, open/close buttons) and form fields: traccia reference, corso, data, durata, modalità, password. `saveTrack()` calls `setEsame`. `setStatus()` opens/closes. `duplicateEsame()` resets the form to create a new esame (traccia is unchanged). The clickable traccia name in the status bar switches to the Tracce tab with that traccia pre-selected.
- **Tracce tab**: select a traccia or `__new__`. `doCreateTraccia()` calls `createTrack`. `saveTracciaNome()` calls `setTrack` with just `nome`. `saveTrackItems()` calls `setTrack` with `track_id` and `items`. Items editor + question browser are in this tab.
- **Question browser** (left pane): filters categoria › sottocategoria (tree menu), tag, punti, stato. Click row = preview; `←` button = add fixed slot. "Aggiungi casuale" adds a `{type:"random",…}` slot.
- **Preview modal**: `previewQuestion(id, event)` — shows full text, options with correct highlighted.
- `toggleStato(id)` — toggles `bozza`/`verificato` via `setQuestionStato`.
- `cleanItemsForSave(items)` — strips `_count` and any `_`-prefixed local fields before saving.
- **Monitor tab**: auto-refreshes every 30s. Extra time bar below stats: `[N] min [+ Tutti] [+ Studente selezionato]`. Click a student row to select them (highlighted blue) and enable the per-student button. `doAddExtraTime(scope)` calls `addExtraTime`.
- Header row 2: Drive folder input + "Carica lista" + Domande/Risultati sheet selectors with "+ Nuovo" buttons + Apps Script link.
- `saveTrack()` sends `track_password` (not `password`) to avoid collision with the admin auth field.
- **Domande tab** (`banco`): browser of the whole bank. Toolbar: full-text search (`bancoIndex`, over canonical text/options/answers), filters tipo / categoria › sottocategoria / stato / uso, "Importa da Moodle…", "↻ Ricarica dal foglio". Right pane: details, usage in tracce/esami, interactive **prova** (iframe `quiz_v2.html?preview&v=BUILD`, driven via `postMessage`, see `makeProva`) with "inserisci la risposta giusta".
  - **Categories** exist only as values of questions: a category/subcategory with no questions left disappears from every menu (`refreshCategoryMenus()` after any change). Category filters are a single tree `<select>` (`catTreeFill` / `catTreeValue` / `catTreeMatch`; value `""` or JSON `[cat, sub|null]`) with question counts per branch; the Domande tab also offers "(senza sottocategoria)". Where a category is *assigned* (editor, bulk edit) `catPicker(prefix, cat, sub, onChange)` gives a menu of existing values plus "＋ Nuova categoria…/sottocategoria…" with a text field.
  - **Delete** (`bancoDelete(ids)`): from the detail pane or the bulk bar. The confirmation lists tracce losing fixed slots, random slots losing candidates (flagging ones left empty), open exams involved and categories left empty.
  - **Editor**: edit in the text format with per-type syntax help (`BE_SINTASSI`); "Salva" overwrites (`updateQuestion`), "Salva come nuova" creates an independent copy (`createQuestion`). **No versioning by design.** Warns when the question is used by open exams (they are graded with the version current at submission). Image upload (shrunk client-side) with a folder picker limited to the QuizForge Drive tree (last folder in `localStorage` `qf_img_folder[_test]`).
  - **Bulk edit**: checkbox on each row (Shift = range), sticky bar with "select all filtered" (including rows past `BANCO_MAX_ROWS`). "Modifica in blocco…" changes categoria, sottocategoria, stato, punti, removes/adds tags (`updateQuestionsMeta`). Before applying it lists open exams affected and random slots whose eligible pool changes (via `slotAccepts`), flagging slots that would become empty.
  - **Moodle import**: reads a Moodle XML export in the browser, converts to the text format (`convertiMoodle`), uploads images to `QuizForge › categoria › sottocategoria`, uploads images 4 at a time (same image in the same folder only once), then creates all questions as `bozza` in one `createQuestions` call, tagged `moodle-<id>` (reimport skips them). Destination categoria/sottocategoria are editable, prefilled from the file when it has a single category. Unsupported questions are discarded with the reason.

## BUILD auto-update

See "Pushing to GitHub": the pre-commit hook writes the parent commit hash into `const BUILD` in `admin_v2.html`. BUILD is also appended to the preview iframe URL so an update is never served from cache.

## Admin authentication

Password stored in `_config` tab of Results Sheet (key `admin_password`). Default: `cambiami`.
