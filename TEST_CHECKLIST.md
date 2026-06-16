# QuizForge — Checklist di test (?test)

**Regola fondamentale:** usare sempre `?test` — non toccare mai la produzione durante i test.

## Setup

1. Aprire `admin_v2.html?test` — login con password `cambiami`
2. Creare un esame: traccia `t-bbb222` (mista con cloze), durata 3 min, modalità `exam`
   - `createEsame` crea sempre `status="closed"` → aprire subito con `setEsame status=open`
3. Per test overtime: esame separato con durata=1 minuto

---

## A. Admin — Autenticazione e configurazione

- [ ] **A1** Login con password corretta → pannello visibile con versione script
- [ ] **A2** Login con password errata → "Password errata"
- [ ] **A3** Logout → torna alla schermata login
- [ ] **A4** Header: dropdown "Domande" e "Risultati" mostrano i fogli test corretti
- [ ] **A5** Link "↗" ai fogli Google Sheets funzionante
- [ ] **A6** Link "Apri editor Apps Script" funzionante

## B. Admin — Gestione Esami

- [ ] **B1** Creazione nuovo esame (traccia, corso, data, durata, modalità, password, shuffle)
- [ ] **B2** Apri esame (status → open, badge verde)
- [ ] **B3** Chiudi esame (status → closed, badge grigio)
- [ ] **B4** Modifica campi esame (durata, corso, password) e salva
- [ ] **B5** Duplica esame → form resettato con stessa traccia, pronto per nuovo ID
- [ ] **B6** Click nome traccia nella status bar → switch tab Tracce con traccia pre-selezionata
- [ ] **B7** Link "↗ Prova esame" porta a `quiz_v2.html?id=<exam_id>` corretto
- [ ] **B8** Esame con password: studente senza password non può accedere

## C. Admin — Gestione Tracce

- [ ] **C1** Crea nuova traccia
- [ ] **C2** Rinomina traccia e salva
- [ ] **C3** Aggiungi slot fisso da browser domande (bottone `←`)
- [ ] **C4** Aggiungi slot casuale ("Aggiungi casuale") con filtri categoria/tag/punti
- [ ] **C5** Slot casuale ha campo punteggio editabile (a prescindere dal pool)
- [ ] **C6** Elimina slot dalla traccia
- [ ] **C7** Salva domande traccia → ricarica e verifica persistenza
- [ ] **C8** Preview domanda: click su riga → modal con testo, opzioni, risposta corretta evidenziata
- [ ] **C9** Toggle stato bozza/verificato su una domanda
- [ ] **C10** Filtri browser: categoria, sottocategoria, tag, punteggio, stato — ognuno filtra correttamente
- [ ] **C11** Statistiche: bottone "📊 Statistiche" → badge colorati (verde/giallo/rosso/grigio) per ogni domanda

## D. Admin — Monitor studenti

- [ ] **D1** Monitor mostra studenti con stato "Connesso" dopo init
- [ ] **D2** Conteggio risposte si aggiorna (auto-refresh 30s o manuale)
- [ ] **D3** Studente appare "Consegnato" dopo finalize, con score e elapsed
- [ ] **D4** Extra time globale: input minuti → "+ Tutti" → toast sullo studente
- [ ] **D5** Extra time individuale: click riga (evidenziata blu) → "+ Studente selezionato"
- [ ] **D6** Overtime: elapsed mostra "⚠ oltre tempo"
- [ ] **D7** Ripresa sessione: toggle abilita/disabilita → avviso visivo nel pannello

## E. Admin — Risultati

- [ ] **E1** Tabella: nome, timestamp start/end, elapsed, per-question pts, totale
- [ ] **E2** Statistiche aggregate: n consegnati, media, mediana
- [ ] **E3** Distribuzione punteggi: istogramma con bucket
- [ ] **E4** Colori intestazione colonne: verde (≥80% corretto), rosso (≤20%)
- [ ] **E5** Click riga studente → dettaglio: tipo domanda, risposta data, risposta corretta, pt
- [ ] **E6** Chiudi dettaglio → pannello scompare
- [ ] **E7** Aggiorna risultati → nuove submission appaiono

## F. Studente — Quiz exam mode

> ⚠ Il bottone "Consegna ✓" apre un `confirm()` nativo — chiedere all'utente di cliccare OK.

- [ ] **F1** Cover page: corso, data, durata, numero domande, totale punti
- [ ] **F2** Esame con password: richiede password prima del form studente
- [ ] **F3** Form studente: validazione campi obbligatori (matricola, nome)
- [ ] **F4** Domanda tipo **mc**: opzioni mostrate, shuffle attivo, selezione evidenziata
- [ ] **F5** Domanda tipo **fitb**: input testo libero
- [ ] **F6** Domanda tipo **match**: selezione corrispondenze
- [ ] **F7** Domanda tipo **multi-fitb**: più input in layout griglia
- [ ] **F8** Domanda tipo **cloze**: dropdown inline nel testo
- [ ] **F9** Domanda tipo **free**: textarea grande, nessun auto-scoring
- [ ] **F10** Navigazione prev/next, sidebar indica domande risposte
- [ ] **F11** Risposta salvata: feedback visivo "✓ Salvato"
- [ ] **F12** Timer countdown visibile e decrescente
- [ ] **F13** Extra time mid-exam → toast verde, timer aggiornato
- [ ] **F14** "Consegna ✓" → confirm() → schermata risultato
- [ ] **F15** Schermata risultato exam: **solo punteggio**, nessuna tabella risposte corrette (anti-cheating)
- [ ] **F16** Re-finalize (ricarica e riconsegna) → stesso score invariato (idempotente)

## G. Studente — Quiz practice mode

- [ ] **G1** Stesso flusso di exam, senza controllo password
- [ ] **G2** Schermata risultato: tabella risposta data vs corretta per ogni domanda
- [ ] **G3** "Riprova" → confirm() → nuova sessione con domande riassegnate server-side
- [ ] **G4** Score calcolato server-side anche in practice

## H. Persistenza e casi limite

- [ ] **H1** Chiudi browser a metà quiz → riapri → sessione ripresa da localStorage
- [ ] **H2** Abbandona quiz → confirm() → sessione cancellata → studente può ricominciare
- [ ] **H3** Esame chiuso → init bloccato "Esame non disponibile"
- [ ] **H4** Overtime (durata=1 min, aspettare >2 min) → `overtime=true`, flag ⚠ nei risultati

## I. Sicurezza (verificabile via API)

- [ ] **I1** Score server-side: client invia score falso → ignorato, server ricalcola
- [ ] **I2** Domande server-side: client non può scegliere le domande
- [ ] **I3** In exam mode le domande non contengono il campo `correct`
- [ ] **I4** Anti-oracle: re-finalize con risposte diverse → score invariato (frozen al primo finalize)
