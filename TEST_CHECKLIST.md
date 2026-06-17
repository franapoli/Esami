# QuizForge — Checklist di test (?test)

**Regola fondamentale:** usare sempre `?test` — non toccare mai la produzione durante i test.

## Setup

1. Aprire `admin_v2.html?test` — login con password `cambiami`
2. Creare un esame: traccia `t-bbb222` (mista con cloze), durata 3 min, modalità `exam`
   - `createEsame` crea sempre `status="closed"` → aprire subito con `setEsame status=open`
3. Per test overtime: esame separato con durata=1 minuto

## Note operative

- `update` usa il campo `ans` (non `answer`)
- `addExtraTime` individuale: passare `scope:'<matricola>'` (non `scope:'student'`)
- `confirm()` nativi bloccano `javascript_exec` — non si può iniettare JS da quiz tab con query string
- Per testare Consegna/Riprova/Abbandona senza dialog: usare API diretta (`finalize`, `resetPractice`, `abandon`)

---

## A. Admin — Autenticazione e configurazione

- [x] **A1** Login con password corretta → pannello visibile con versione script
- [x] **A2** Login con password errata → "Password errata"
- [x] **A3** Logout → torna alla schermata login
- [x] **A4** Header: dropdown "Domande" e "Risultati" mostrano i fogli test corretti
- [x] **A5** Link "↗" ai fogli Google Sheets funzionante
- [x] **A6** Link "Apri editor Apps Script" funzionante

## B. Admin — Gestione Esami

- [x] **B1** Creazione nuovo esame (traccia, corso, data, durata, modalità, password, shuffle)
- [x] **B2** Apri esame (status → open, badge verde)
- [x] **B3** Chiudi esame (status → closed, badge grigio)
- [x] **B4** Modifica campi esame (durata, corso, password) e salva
- [x] **B5** Duplica esame → form resettato con stessa traccia, pronto per nuovo ID
- [x] **B6** Link "↗ Prova esame" porta a `quiz_v2.html?id=<exam_id>` corretto
- [ ] **B7** Esame con password: studente senza password non può accedere *(non testato)*

## C. Admin — Gestione Tracce

- [x] **C1** Crea nuova traccia
- [x] **C2** Rinomina traccia e salva
- [x] **C3** Aggiungi slot fisso da browser domande (bottone `←`)
- [x] **C4** Aggiungi slot casuale ("Aggiungi casuale") con filtri categoria/tag/punti
- [x] **C5** Slot casuale ha campo punteggio editabile (a prescindere dal pool)
- [x] **C6** Elimina slot dalla traccia
- [x] **C7** Salva domande traccia → ricarica e verifica persistenza
- [x] **C8** Preview domanda: click su riga → modal con testo, opzioni, risposta corretta evidenziata
- [x] **C9** Toggle stato bozza/verificato su una domanda
- [x] **C10** Filtri browser: categoria, sottocategoria, tag, punteggio, stato — ognuno filtra correttamente
- [x] **C11** Statistiche: bottone "📊 Statistiche" → badge colorati (verde/giallo/rosso/grigio) per ogni domanda

## D. Admin — Monitor studenti

- [x] **D1** Monitor mostra studenti con stato "Connesso" dopo init
- [x] **D2** Conteggio risposte si aggiorna (auto-refresh 30s o manuale)
- [x] **D3** Studente appare "Consegnato" dopo finalize, con score e elapsed
- [x] **D4** Extra time globale: `addExtraTime scope:'all'` → `getTrack` restituisce durata aggiornata
- [x] **D5** Extra time individuale: `addExtraTime scope:'<matricola>'` → ok, `update` risponde con `extra_minutes_individual`
- [x] **D6** Overtime: elapsed mostra "⚠ oltre tempo"
- [x] **D7** Ripresa sessione: toggle abilita/disabilita → badge ON/OFF + avviso "⚠ RIPRESA ATTIVA"

## E. Admin — Risultati

- [x] **E1** Tabella: nome, timestamp start/end, elapsed, per-question pts, totale
- [x] **E2** Statistiche aggregate: n consegnati, media, mediana
- [x] **E3** Distribuzione punteggi: istogramma CSS con bucket
- [ ] **E4** Colori intestazione colonne: verde (≥80% corretto), rosso (≤20%) *(threshold non raggiunta con 2 studenti)*
- [x] **E5** Click riga studente → dettaglio: tipo domanda, risposta data, risposta corretta, pt
- [x] **E6** Chiudi dettaglio → pannello scompare
- [x] **E7** Aggiorna risultati → nuove submission appaiono

## F. Studente — Quiz exam mode

> ⚠ `confirm()` nativo blocca `javascript_exec`. Per Consegna: l'utente clicca Ok manualmente (una volta sola).
> Per H2/G3: usare API diretta (`abandon`, `resetPractice`) per evitare il dialog.

- [x] **F1** Cover page: corso, data, durata, numero domande, totale punti
- [ ] **F2** Esame con password: richiede password prima del form studente *(non testato)*
- [x] **F3** Form studente: validazione campi obbligatori (matricola, nome)
- [x] **F4** Domanda tipo **mc**: opzioni mostrate, shuffle attivo, selezione evidenziata
- [x] **F5** Domanda tipo **fitb**: input testo libero
- [x] **F6** Domanda tipo **match**: selezione corrispondenze (click elemento + click slot)
- [x] **F7** Domanda tipo **multi-fitb**: più input in layout griglia
- [x] **F8** Domanda tipo **cloze**: dropdown inline nel testo
- [ ] **F9** Domanda tipo **free**: textarea grande, nessun auto-scoring *(non presente in t-bbb222)*
- [x] **F10** Navigazione prev/next, sidebar indica domande risposte
- [x] **F11** Risposta salvata: feedback visivo "✓ Salvato" / "Salvataggio..."
- [x] **F12** Timer countdown visibile e decrescente
- [x] **F13** Extra time mid-exam → `update` risponde con `extra_minutes_individual > 0`
- [x] **F14** "Consegna ✓" → confirm() → schermata risultato
- [x] **F15** Schermata risultato exam: **solo punteggio**, nessuna tabella risposte corrette (anti-cheating)
- [x] **F16** Re-finalize (anti-oracle): stesso score invariato (confermato via I4)

## G. Studente — Quiz practice mode

- [x] **G1** Stesso flusso di exam, senza controllo password; badge "Modalità esercitazione"; esame closed ma accessibile
- [x] **G2** Schermata risultato: tabella risposta data vs corretta per ogni domanda (corrette in verde)
- [x] **G3** "Riprova" → nuova sessione con domande riassegnate server-side (verificato via `resetPractice` API)
- [x] **G4** Score calcolato server-side anche in practice

## H. Persistenza e casi limite

- [x] **H1** Chiudi browser a metà quiz → riapri → sessione ripresa da localStorage (form non mostrato, quiz direttamente visibile)
- [x] **H2** Abbandona quiz → sessione cancellata → studente può ricominciare (verificato via `abandon` API)
- [x] **H3** Esame chiuso → init bloccato "Esame non disponibile"
- [x] **H4** Overtime: `finalize` restituisce `overtime:true`, flag "⚠ oltre tempo" nel monitor

## I. Sicurezza (verificabile via API)

- [x] **I1** Score server-side: client invia score=999 → ignorato, server restituisce score corretto
- [x] **I2** Domande server-side: client invia `qids` fasulli → ignorati, server assegna i suoi
- [x] **I3** In exam mode le domande non contengono il campo `correct`
- [x] **I4** Anti-oracle: re-finalize con risposte diverse → score invariato (frozen al primo finalize)
