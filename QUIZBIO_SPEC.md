# QuizForge — Specifiche tecniche del sistema

Sistema di quiz online per esami e esercitazioni del corso
**Applicazioni di Bioinformatica — Genetica Umana — MedTec**
Università degli Studi del Sannio — DST

---

## Architettura generale

```
[File HTML per traccia]  →  [Google Apps Script Web App]  →  [Google Sheets]
  GitHub Pages                   backend HTTP POST              foglio _meta
                                                                foglio _config
                                                                foglio <exam_id> (risultati)
```

**URL base:** `https://franapoli.github.io/Esami/`
**Apps Script URL:** `https://script.google.com/macros/s/AKfycbyesj1cil3kNhPnjzAYIcaub8YeYbQ9sUY2yr5e4ClrM98-V5IPE-d9lgPXXjTa_hU8Mg/exec`
**Google Sheet ID:** `1hj1SAiPSKIhYcMCPC9h-1Y9Vtvs8bJdHFSmsXKfL3Hw`
**GitHub repo:** `https://github.com/franapoli/Esami.git`

---

## File del sistema

| File | Scopo |
|------|-------|
| `<traccia>.html` | Una per ogni traccia (quiz + logica client) |
| `admin.html` | Pannello admin con due tab: Gestione tracce + Monitor studenti |
| `logo_unisannio.png` | Logo header (100KB, 1512×535px) |
| `quiz_apps_script.js` | Codice Apps Script (sorgente locale) |
| `QUIZBIO_SPEC.md` | Questo documento |

---

## Google Sheets — struttura

### Foglio `_config`
Contiene **solo** la password amministratore.

| Chiave | Valore |
|--------|--------|
| `admin_password` | (segreto) |

### Foglio `_meta`
Una riga per traccia. Creato automaticamente alla prima chiamata.

| Col | Campo | Tipo | Note |
|-----|-------|------|------|
| A | `TracciaID` | stringa | = `EXAM_ID` del file HTML |
| B | `Nome` | stringa | nome visualizzato agli studenti |
| C | `Data` | `YYYY-MM-DD` | data dell'esame |
| D | `Durata (min)` | intero | minuti disponibili |
| E | `Modalità` | `exam` \| `practice` | practice non salva nulla |
| F | `Stato` | `open` \| `closed` | controlla accesso studenti |
| G | `Creata` | timestamp | data/ora prima apertura |
| H | `Foglio` | hyperlink | link al foglio risultati (solo exam) |

### Foglio `<exam_id>` (uno per traccia in modalità exam)
Una riga per studente.

| Col | Campo |
|-----|-------|
| A | Matricola |
| B | Nominativo |
| C | Email |
| D | Score |
| E | Totale (sempre 30) |
| F | Inizio (DD/MM/YYYY HH:MM:SS) |
| G | Fine |
| H | Durata (es. "45m 10s") |
| I+ | Dom1, Pt1, Dom2, Pt2, … Dom15, Pt15 |

---

## Apps Script — azioni disponibili

Tutte le chiamate sono HTTP POST con `Content-Type: text/plain` e body JSON.

| Action | Auth | Descrizione |
|--------|------|-------------|
| `getTrack` | — | Legge metadati traccia da `_meta`; crea la riga se non esiste (default: closed/exam) |
| `getAllTracks` | password | Lista tutte le tracce in `_meta` |
| `setTrack` | password | Aggiorna attributi di una traccia; crea foglio risultati se mode=exam |
| `getMonitor` | password | Lista studenti di una traccia con progresso |
| `init` | — | Registra studente (controlla duplicati e stato open/closed) |
| `update` | — | Salva risposta singola durante il quiz |
| `finalize` | — | Salva consegna completa (score, timestamps, tutte le risposte) |

---

## Struttura di un file HTML traccia

### Costanti da personalizzare (in cima allo script)

```javascript
const EXAM_ID = "<slug>-<data>-<6char-random>";
// Esempi:
// "quiz-vhl-2026-05-28-j94owo"
// "esercizio-blast-2026-06-15-m3kp9x"

const SCRIPT_URL = "https://script.google.com/macros/s/.../exec";
const N_QUESTIONS = 15;  // numero domande
```

### Struttura EXAM_ID
```
<slug-nome>-<YYYY-MM-DD>-<6char-alfanumerici-casuali>
```
- Lo slug è il nome dell'esame in lowercase senza accenti, spazi → trattini
- I 6 caratteri casuali garantiscono unicità anche tra tracce con stesso nome e data
- Generati da Claude al momento della creazione del file
- **Non modificare mai** l'EXAM_ID dopo che la traccia è stata usata da studenti

### Array `questions`

Ogni elemento ha questa struttura:

```javascript
// Domanda a scelta multipla
{ id: 1,
  pts: 2,           // punteggio (intero)
  type: "mc",
  text: "Testo della domanda",
  options: ["Opzione A", "Opzione B", "Opzione C", "Opzione D"],
  correct: 1,       // indice 0-based della risposta corretta
  blast: true,      // (opzionale) mostra BLAST_OUTPUT prima della domanda
  acmg: true        // (opzionale) mostra ACMG_SCHEMA prima della domanda
}

// Domanda a risposta libera
{ id: 8,
  pts: 3,
  type: "fitb",     // fill-in-the-blank
  text: "Testo della domanda",
  correct: "6,5,4,3,3",   // stringa attesa (confronto case-insensitive, no spazi)
  placeholder: "es. 0,1,2,3,4"
}
```

### Costanti contenuto opzionali

```javascript
const BLAST_OUTPUT = `...`;   // testo preformattato, mostrato per q con blast:true
const ACMG_SCHEMA  = `...`;   // HTML tabella, mostrato per q con acmg:true
```

### Variabili caricate da `_meta` all'avvio (non modificare)

```javascript
let EXAM_DATE = "";           // YYYY-MM-DD
let EXAM_NAME = "";           // nome visualizzato
let EXAM_DURATION_MIN = 60;   // minuti
let EXAM_MODE = "exam";       // "exam" | "practice"
```

---

## Comportamento modalità exam vs practice

| | exam | practice |
|--|------|----------|
| Form dati studente | ✓ richiesto | ✗ nascosto |
| Chiamate Apps Script | init + update + finalize | nessuna |
| Salvataggio su Sheets | ✓ | ✗ |
| localStorage session | ✓ | ✗ |
| Risultato finale | solo voto | voto + risposte corrette |
| Controllo stato open/closed | ✓ | ✗ (sempre accessibile) |

---

## Logica client — funzioni principali

| Funzione | Descrizione |
|----------|-------------|
| `loadTrack()` | Chiama `getTrack`, popola EXAM_DATE/NAME/DURATION/MODE, abilita btn-start |
| `initQuiz()` | In exam: chiama `init`, verifica duplicati; in practice: avvia direttamente |
| `renderQuestion()` | Mostra domanda corrente con opzioni in ordine shufflato |
| `selectOption(origIdx)` | Salva risposta mc, chiama `saveProgress` |
| `saveText(val)` | Salva risposta fitb, chiama `saveProgress` |
| `saveProgress(qIndex, val)` | Chiama `update` su Apps Script (no-op in practice) |
| `showResults()` | Calcola score; in exam → finalize con retry; in practice → tabella risposte |
| `startTimer()` / `updateTimer()` | Countdown da EXAM_DURATION_MIN; arancione ≤10min, rosso ≤3min, auto-submit a 0 |
| `saveLocal()` / `loadLocal()` | Persistenza sessione in localStorage (solo exam) |
| `buildShuffleMap()` | Fisher-Yates per ordine opzioni, salvato in localStorage |
| `getLSKey()` | Restituisce `"quiz_session_" + EXAM_ID` |

---

## Gestione errori e resilienza

- **Salvataggio intermedio fallito** (`update`): warning silenzioso, localStorage mantiene il dato
- **Finalize fallito**: retry automatico 3 volte (1s, 2s, 4s), poi pulsante manuale "Riprova"
- **localStorage presente** all'avvio: offre di riprendere la sessione
- **Matricola duplicata**: messaggio distinto se già finalizzato vs in corso
- **Traccia closed**: bloccata a meno che non ci sia sessione localStorage attiva

---

## Workflow per una nuova traccia

1. **Duplica** `quiz_VHL.html` con un nuovo nome (es. `esercizio_blast.html`)
2. **Aggiorna** in cima allo script:
   - `EXAM_ID` — Claude genera il suffix casuale (6 char) al momento della creazione
   - `questions[]` — le domande della nuova traccia
   - `BLAST_OUTPUT` / `ACMG_SCHEMA` — se necessari
3. **Carica** su GitHub (push)
4. **Prima apertura** nel browser → la traccia si auto-registra in `_meta` con status `closed`
5. **admin.html** → seleziona la traccia → imposta nome, data, durata, modalità → apri

### Backward compatibility
Le tracce vecchie continuano a funzionare anche dopo aggiornamenti del sistema perché:
- `EXAM_ID` è hardcoded e non cambia
- Il foglio risultati su Sheets non viene mai toccato da deploy successivi
- `getTrack` restituisce sempre i metadati corretti da `_meta`
- La struttura colonne del foglio risultati è fissa (COL_* costanti)

---

## Deploy — passi per aggiornare Apps Script

Dopo modifiche a `quiz_apps_script.js`:
1. Apri Google Sheet → Estensioni → Apps Script
2. Sostituisci tutto il codice con il contenuto del file
3. Distribuisci → **Nuova distribuzione** → App Web
4. Esegui come: Me — Accesso: Chiunque
5. Se l'URL cambia, aggiornalo in `quiz_VHL.html`, `admin.html`, `monitor.html`

---

## Tracce esistenti

| EXAM_ID | File | Note |
|---------|------|------|
| `quiz-vhl-2026-05-28-j94owo` | `index.html` | Prima traccia d'esame VHL — 20 domande, 30 pt |
