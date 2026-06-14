/**
 * createTestData.gs
 * Incolla questo file nell'editor Apps Script ed esegui createTestData().
 * Crea una sottocartella "test" dentro la cartella QuizForge principale,
 * poi crea e popola due fogli: Domande e Risultati.
 * Al termine stampa nel log gli ID da inserire nell'admin.
 *
 * Copertura:
 *   Corsi       : bioinf · genetica · medtec
 *   Tipi domanda: mc · fitb · match · free · multi-fitb · cloze
 *   Tracce      : 4 (fissa, random, mista, medtec)
 *   Esami       : 5 (chiuso, pratica, con password, genetica, medtec shuffle-off)
 *   Studenti    : 7 + 5 + 2 + 2 (tab risultati separati per esame)
 */

const PARENT_FOLDER_ID = "1FCl15simn4Ev363a59aEfOq1qZF4T78H";

function createTestData() {
  const parent = DriveApp.getFolderById(PARENT_FOLDER_ID);
  let testFolder;
  const existing = parent.getFoldersByName("test");
  testFolder = existing.hasNext() ? existing.next() : parent.createFolder("test");
  Logger.log("Cartella test: " + testFolder.getUrl());

  const qSS = SpreadsheetApp.create("Domande Test");
  testFolder.addFile(DriveApp.getFileById(qSS.getId()));
  DriveApp.getRootFolder().removeFile(DriveApp.getFileById(qSS.getId()));
  _populateDomande(qSS);
  Logger.log("SHEET_QUESTIONS_ID = " + qSS.getId());

  const rSS = SpreadsheetApp.create("Risultati Test");
  testFolder.addFile(DriveApp.getFileById(rSS.getId()));
  DriveApp.getRootFolder().removeFile(DriveApp.getFileById(rSS.getId()));
  _populateRisultati(rSS);
  Logger.log("SHEET_RESULTS_ID   = " + rSS.getId());

  Logger.log("--- Copia questi ID nell'admin e in ScriptProperties ---");
}

// ============================================================
// DOMANDE
// Colonne: ID · Corso · Categoria · Sottocategoria · Tags · Stato · Tipo
//          Testo · Opzioni(JSON) · Corretta · Punti · Placeholder · Data(JSON)
// ============================================================
function _populateDomande(ss) {
  const qs = ss.getSheets()[0];
  qs.setName("questions");
  const qHeader = ["ID","Corso","Categoria","Sottocategoria","Tags","Stato","Tipo",
                   "Testo","Opzioni","Corretta","Punti","Placeholder","Data"];
  qs.appendRow(qHeader);
  qs.getRange(1,1,1,qHeader.length).setFontWeight("bold");
  qs.setFrozenRows(1);

  const qRows = [
    // ── bioinf / Genetica ───────────────────────────────────────────
    ["q_test01","bioinf","Genetica","Mutazioni","mutazione,puntiforme","verificato","mc",
     "Quale tipo di mutazione sostituisce un singolo nucleotide?",
     '["Delezione","Sostituzione puntiforme","Inversione","Traslocazione"]',
     "B","1","",""],

    ["q_test02","bioinf","Genetica","Mutazioni","mutazione,frameshift","verificato","mc",
     "Una delezione di 2 basi causa:",
     '["Mutazione silente","Mutazione missenso","Frameshift","Nessuna variazione"]',
     "C","1","",""],

    ["q_test04","bioinf","Genetica","Basi","dna,basi","verificato","fitb",
     "La base azotata complementare dell'adenina nel DNA è la ___.",
     "[]","Timina","1","es. Citosina",""],

    ["q_test06","bioinf","Genetica","Basi","basi,appaiamento","verificato","match",
     "Abbina ogni base alla sua complementare nel DNA:",
     '["Adenina","Guanina","Citosina","Timina"]',
     '["Timina","Citosina","Guanina","Adenina"]',
     "1","",""],

    ["q_test08","bioinf","Genetica","Malattie","brca,cancro","verificato","free",
     "Descrivi brevemente il ruolo del gene BRCA1 nella soppressione tumorale.",
     "[]","","3","",""],

    ["q_test10","bioinf","Genetica","Cromosomi","cromosomi,cariotipo","verificato","mc",
     "Quanti cromosomi ha una cellula umana diploide?",
     '["23 cromosomi","46 cromosomi","48 cromosomi","44 cromosomi"]',
     "B","1","",""],

    ["q_test11","bioinf","Genetica","Cromosomi","cromosomi,mitosi","verificato","mc",
     "Quale fase della mitosi prevede l'allineamento dei cromosomi al piano equatoriale?",
     '["Metafase","Anafase","Profase","Telofase"]',
     "A","1","",""],

    // ── bioinf / Bioinformatica ────────────────────────────────────
    ["q_test03","bioinf","Bioinformatica","Allineamento","blast,allineamento","verificato","mc",
     "Qual è la funzione principale di BLAST?",
     '["Predire struttura proteica","Allineare sequenze con database","Calcolare alberi filogenetici","Annotare varianti"]',
     "B","2","",""],

    ["q_test05","bioinf","Bioinformatica","Formati","fasta,formato","verificato","fitb",
     "Il formato ___ è usato per rappresentare sequenze biologiche in testo.",
     "[]","FASTA","1","es. FASTQ",""],

    // multi-fitb: i boxes hanno il campo "correct" per lo scoring server-side
    ["q_test07","bioinf","Bioinformatica","Allineamento","smith,waterman","verificato","multi-fitb",
     "Completa: l'algoritmo di ___ è locale, quello di ___ è globale.",
     "[]","","1","",
     '{"cols":2,"boxes":[{"label":"Algoritmo locale","cols":1,"correct":"Smith-Waterman"},{"label":"Algoritmo globale","cols":1,"correct":"Needleman-Wunsch"}]}'],

    // cloze bioinf (q_test12)
    ["q_test12","bioinf","Bioinformatica","Statistica","blast,e-value","verificato","cloze",
     "BLAST esegue allineamenti {{0}} tra la query e il database. L'E-value indica la probabilità di trovare un allineamento simile in un database {{1}}.",
     "[]","","2","",
     '{"dropdowns":[{"options":["locali","globali","multipli"],"correct":0},{"options":["casuale","vuoto","reale"],"correct":0}]}'],

    // bozza — esclusa dal pool random
    ["q_test09","bioinf","Bioinformatica","Struttura","proteina,struttura","bozza","mc",
     "Quale livello strutturale è stabilizzato dai ponti disolfuro?",
     '["Primaria","Secondaria","Terziaria","Quaternaria"]',
     "C","1","",""],

    // ── genetica ──────────────────────────────────────────────────
    ["q_test13","genetica","Citogenetica","Cromosomi","cromosomi","verificato","mc",
     "Quanti cromosomi ha una cellula somatica umana diploide?",
     '["23","46","44","48"]',
     "B","1","",""],

    ["q_test14","genetica","Meiosi","Ricombinazione","meiosi,crossing-over","verificato","mc",
     "In quale fase della meiosi avviene principalmente il crossing-over?",
     '["Profase I","Metafase I","Anafase II","Telofase I"]',
     "A","1","",""],

    ["q_test15","genetica","Malattie","Espansioni","Huntington","verificato","fitb",
     "La malattia di Huntington è causata dall'espansione patologica della tripletta ___.",
     "[]","CAG","1","tripletta espansa",""],

    ["q_test16","genetica","Ereditarietà","Modalità","","verificato","match",
     "Abbina la modalità di ereditarietà alla malattia corrispondente:",
     '["Autosomico dominante","Autosomico recessivo","X-linked recessivo","Mitocondriale"]',
     '["Corea di Huntington","Fibrosi cistica","Emofilia A","MELAS"]',
     "2","",""],

    // ── medtec ────────────────────────────────────────────────────
    ["q_test17","medtec","NGS","Tecnologie","","verificato","mc",
     "NGS è l'acronimo di:",
     '["Nuclear Gene Scanning","Next Generation Sequencing","New Genetic Standard","Nucleotide Gap Sequencing"]',
     "B","1","",""],

    ["q_test18","medtec","NGS","Parametri","WES,copertura","verificato","mc",
     "La copertura media minima raccomandata per il sequenziamento dell'esoma clinico (WES) è:",
     '["5x","10x","20x","100x"]',
     "C","1","",""],

    ["q_test19","medtec","Genomica","Riferimento","GRCh38","verificato","fitb",
     "Il genoma di riferimento umano più recente usato nelle pipeline cliniche si chiama ___.",
     "[]","GRCh38","1","es. GRCh38",""],

    // cloze medtec (q_test20)
    ["q_test20","medtec","NGS","Qualità","phred,mapping","verificato","cloze",
     "In NGS la qualità di ogni base è codificata con il punteggio {{0}}. Il processo di allineamento delle reads al genoma è detto {{1}}.",
     "[]","","2","",
     '{"dropdowns":[{"options":["Phred","Shannon","GATK"],"correct":0},{"options":["mapping","assembly","annotation"],"correct":0}]}'],
  ];
  qRows.forEach(r => qs.appendRow(r));

  // ── Tracce ──────────────────────────────────────────────────────
  // Schema: TracciaID · Nome · Items(JSON)
  const tr = ss.insertSheet("tracce");
  tr.appendRow(["TracciaID","Nome","Items"]);
  tr.getRange(1,1,1,3).setFontWeight("bold");
  tr.setFrozenRows(1);

  // t-aaa111: bioinf fissa + 1 slot random Genetica
  // Domande fisse (4): q_test01(mc,1), q_test02(mc,1), q_test04(fitb,1), q_test06(match,1)
  // Random: categoria=Genetica, punti=1 → pool: q_test10, q_test11 (non già usate e verificate)
  // Totale: 5pt
  tr.appendRow(["t-aaa111","Bioinf — genetica base",
    JSON.stringify([
      {type:"fixed",  id:"q_test01"},
      {type:"fixed",  id:"q_test02"},
      {type:"fixed",  id:"q_test04"},
      {type:"fixed",  id:"q_test06"},
      {type:"random", categoria:"Genetica", punti:1},
    ])]);

  // t-bbb222: bioinf mista (tutti i tipi automatici) + 1 slot random Genetica
  // Fisse (4): q_test03(mc,2), q_test05(fitb,1), q_test07(multi-fitb,1), q_test12(cloze,2)
  // Random: categoria=Genetica → pool: q_test01,q_test02,q_test04,q_test06,q_test08,q_test10,q_test11
  // Totale: 7pt (+ 1pt random)
  tr.appendRow(["t-bbb222","Bioinf — mista con cloze",
    JSON.stringify([
      {type:"fixed",  id:"q_test03"},
      {type:"fixed",  id:"q_test05"},
      {type:"fixed",  id:"q_test07"},
      {type:"fixed",  id:"q_test12"},
      {type:"random", categoria:"Genetica"},
    ])]);

  // t-ccc333: genetica mista (2 fisse + 1 random da Meiosi)
  // Fisse: q_test13(mc,1), q_test16(match,2)
  // Random: categoria=Meiosi → q_test14
  // Totale: 4pt
  tr.appendRow(["t-ccc333","Genetica — mista",
    JSON.stringify([
      {type:"fixed",  id:"q_test13"},
      {type:"random", categoria:"Meiosi"},
      {type:"fixed",  id:"q_test16"},
    ])]);

  // t-ddd444: medtec — tutti i tipi del corso
  // Fisse (4): q_test17(mc,1), q_test18(mc,1), q_test19(fitb,1), q_test20(cloze,2)
  // Totale: 5pt
  tr.appendRow(["t-ddd444","MedTec — completa",
    JSON.stringify([
      {type:"fixed", id:"q_test17"},
      {type:"fixed", id:"q_test18"},
      {type:"fixed", id:"q_test19"},
      {type:"fixed", id:"q_test20"},
    ])]);

  // ── Esami ───────────────────────────────────────────────────────
  // Schema (10 col): EsameID · TracciaID · Nome(riservato) · Data · Durata(min)
  //                  Corso · Modalità · Stato · Password · Shuffle
  const es = ss.insertSheet("esami");
  const eHeader = ["EsameID","TracciaID","Nome","Data","Durata (min)","Corso","Modalità","Stato","Password","Shuffle"];
  es.appendRow(eHeader);
  es.getRange(1,1,1,eHeader.length).setFontWeight("bold");
  es.setFrozenRows(1);

  const esami = [
    // bioinf — chiuso (ha dati studenti nel foglio risultati)
    ["2026-06-01-test01","t-aaa111","","2026-06-01",60,"Genetica Umana","exam","closed","",""],
    // bioinf — pratica aperta (ha dati studenti)
    ["2026-06-09-test02","t-bbb222","","2026-06-09",90,"Applicazioni di Bioinformatica","practice","open","",""],
    // bioinf — aperto con password (nessun dato studenti — testa il flow auth)
    ["2026-06-10-test03","t-bbb222","","2026-06-10",45,"Applicazioni di Bioinformatica","exam","open","test123",""],
    // genetica — aperto (ha dati studenti)
    ["2026-06-14-test04","t-ccc333","","2026-06-14",90,"Genetica Umana","exam","open","",""],
    // medtec — aperto, shuffle disabilitato (ha dati studenti)
    ["2026-06-14-test05","t-ddd444","","2026-06-14",30,"MedTec","exam","open","","no"],
  ];
  esami.forEach(r => es.appendRow(r));
}

// ============================================================
// RISULTATI
// Schema colonne (1-based):
//  1=Matricola  2=Nominativo  3=Email  4=Score  5=Totale
//  6=Inizio     7=Fine        8=Durata 9=QIDs   10,11=Ans1,Pt1  12,13=Ans2,Pt2 …
//
// Fine vuota → studente in corso
// Fine valorizzata → consegnato (idempotente dopo la prima finalizzazione)
// Seed nei QIDs: "q1,q2,q3;seed=N" (aggiunto da init quando shuffle è attivo)
// ============================================================
function _populateRisultati(ss) {
  // ── _config ──────────────────────────────────────────────────
  const cfg = ss.getSheets()[0];
  cfg.setName("_config");
  cfg.appendRow(["Chiave","Valore"]);
  cfg.getRange(1,1,1,2).setFontWeight("bold");
  cfg.setFrozenRows(1);
  cfg.appendRow(["admin_password","cambiami"]);
  cfg.appendRow(["extra_time:2026-06-01-test01:all", 5]); // +5 min extra (testa il monitor)

  // ── Esami (specchio META, schema META_COLS) ───────────────────
  // META_COLS: A=EsameID B=TracciaID C=(riservato) D=Data E=Durata F=Corso G=Modalità H=Stato I=Creato
  const meta = ss.insertSheet("Esami");
  const mHeader = ["EsameID","TracciaID","(riservato)","Data","Durata","Corso","Modalità","Stato","Creato"];
  meta.appendRow(mHeader);
  meta.getRange(1,1,1,mHeader.length).setFontWeight("bold");
  meta.setFrozenRows(1);
  const now_ = _fmtTs(new Date());
  [
    ["2026-06-01-test01","t-aaa111","","2026-06-01",60,"Genetica Umana","exam","closed",now_],
    ["2026-06-09-test02","t-bbb222","","2026-06-09",90,"Applicazioni di Bioinformatica","practice","open",now_],
    ["2026-06-10-test03","t-bbb222","","2026-06-10",45,"Applicazioni di Bioinformatica","exam","open",now_],
    ["2026-06-14-test04","t-ccc333","","2026-06-14",90,"Genetica Umana","exam","open",now_],
    ["2026-06-14-test05","t-ddd444","","2026-06-14",30,"MedTec","exam","open",now_],
  ].forEach(r => meta.appendRow(r));

  // ── 2026-06-01-test01 ──────────────────────────────────────────
  // t-aaa111: q_test01(mc,1) q_test02(mc,1) q_test04(fitb,1) q_test06(match,1) random-Genetica-1pt(1) = 5pt
  // Risposte corrette: q_test01→B=idx1, q_test02→C=idx2, q_test04→"Timina", q_test06→[0,1,2,3]
  // Slot random (5a domanda): q_test10→B=idx1 oppure q_test11→A=idx0
  // Studenti 1,3,6 ricevono q_test10; studenti 2,4,5,7 ricevono q_test11
  const r1 = ss.insertSheet("2026-06-01-test01");
  const h1 = ["Matricola","Nominativo","Email","Score","Totale","Inizio","Fine","Durata","QIDs",
               "Ans1","Pt1","Ans2","Pt2","Ans3","Pt3","Ans4","Pt4","Ans5","Pt5"];
  r1.appendRow(h1);
  r1.getRange(1,1,1,h1.length).setFontWeight("bold");
  r1.setFrozenRows(1);
  r1.getRange(1, 1, r1.getMaxRows(), 1).setNumberFormat("@");
  const t1s = "01/06/2026 09:00:00";
  // q_test06 match: [0,1,2,3]=tutto corretto(1pt), [3,2,1,0]=tutto sbagliato(0pt)
  [
    // Score 5/5 — q_test10 (random)
    ["100001","Rossi Mario",   "mario@test.it",    5,5,t1s,"01/06/2026 09:52:00","52m 0s",
     "q_test01,q_test02,q_test04,q_test06,q_test10;seed=11111111",
     1,1, 2,1, "Timina",1, "[0,1,2,3]",1, 1,1],
    // Score 3/5 — q_test11: ans=idx2(Profase→sbagliato,corretto=A=idx0)
    ["100002","Bianchi Lucia", "lucia@test.it",    3,5,t1s,"01/06/2026 09:58:00","58m 0s",
     "q_test01,q_test02,q_test04,q_test06,q_test11;seed=22222222",
     1,1, 0,0, "Timina",1, "[0,1,2,3]",1, 2,0],
    // Score 5/5 — q_test10
    ["100003","Verdi Giuseppe","giuseppe@test.it", 5,5,t1s,"01/06/2026 10:05:00","65m 0s",
     "q_test01,q_test02,q_test04,q_test06,q_test10;seed=33333333",
     1,1, 2,1, "Timina",1, "[0,1,2,3]",1, 1,1],
    // Score 1/5 — q_test11: risposte quasi tutte sbagliate
    ["100004","Ferrari Anna",  "anna@test.it",     1,5,t1s,"01/06/2026 10:10:00","70m 0s",
     "q_test01,q_test02,q_test04,q_test06,q_test11;seed=44444444",
     0,0, 2,1, "Uracile",0, "[3,2,1,0]",0, 2,0],
    // Score 0/5 — q_test11
    ["100005","Esposito Marco","marco@test.it",    0,5,t1s,"01/06/2026 10:15:00","75m 0s",
     "q_test01,q_test02,q_test04,q_test06,q_test11;seed=55555555",
     0,0, 0,0, "Uracile",0, "[3,2,1,0]",0, 3,0],
    // Score 4/5 — q_test10: match sbagliato
    ["100006","Romano Sara",   "sara@test.it",     4,5,t1s,"01/06/2026 10:00:00","60m 0s",
     "q_test01,q_test02,q_test04,q_test06,q_test10;seed=66666666",
     1,1, 2,1, "Timina",1, "[3,2,1,0]",0, 1,1],
    // Score 2/5 — q_test11
    ["100007","Colombo Luca",  "luca@test.it",     2,5,t1s,"01/06/2026 10:08:00","68m 0s",
     "q_test01,q_test02,q_test04,q_test06,q_test11;seed=77777777",
     1,1, 0,0, "Timina",1, "[3,2,1,0]",0, 3,0],
  ].forEach(r => r1.appendRow(r));

  // ── 2026-06-09-test02 ──────────────────────────────────────────
  // t-bbb222: q_test03(mc,2) q_test05(fitb,1) q_test07(multi-fitb,1) q_test12(cloze,2) random-Genetica(1) = 7pt
  // Risposte corrette:
  //   q_test03→B=idx1(2pt), q_test05→"FASTA"(1pt), q_test07→["Smith-Waterman","Needleman-Wunsch"](1pt)
  //   q_test12→[0,0](2pt), random varia(1pt)
  // Slot random per studente: 100001→q_test01(B=idx1), 100002→q_test10(B=idx1),
  //   100003→q_test11(A=idx0), 100004→q_test04("Timina"), 100005→q_test02(C=idx2)
  const r2 = ss.insertSheet("2026-06-09-test02");
  const h2 = ["Matricola","Nominativo","Email","Score","Totale","Inizio","Fine","Durata","QIDs",
               "Ans1","Pt1","Ans2","Pt2","Ans3","Pt3","Ans4","Pt4","Ans5","Pt5"];
  r2.appendRow(h2);
  r2.getRange(1,1,1,h2.length).setFontWeight("bold");
  r2.setFrozenRows(1);
  r2.getRange(1, 1, r2.getMaxRows(), 1).setNumberFormat("@");
  const t2s = "09/06/2026 14:00:00";
  // q_test07 multi-fitb: risposta corretta = JSON array ["Smith-Waterman","Needleman-Wunsch"]
  // q_test12 cloze: [0,0]=entrambi corretti(2pt), [0,1]=primo OK secondo sbagliato(1pt)
  [
    // Score 7/7 — pratica, q_test01 come random
    ["100001","Rossi Mario",   "mario@test.it",    7,7,t2s,"09/06/2026 15:28:00","88m 0s",
     "q_test03,q_test05,q_test07,q_test12,q_test01;seed=11111111",
     1,2, "FASTA",1, '["Smith-Waterman","Needleman-Wunsch"]',1, "[0,0]",2, 1,1],
    // In corso — q_test10 come random, solo q_test03 risposta salvata (non finalizzato)
    ["100002","Bianchi Lucia", "lucia@test.it",    "",7,t2s,"","",
     "q_test03,q_test05,q_test07,q_test12,q_test10;seed=22222222",
     1,"", "","", "","", "","", "",""],
    // Score 4/7 — q_test03 sbagliato, q_test12 parziale(1pt), q_test11 corretto
    ["100003","Verdi Giuseppe","giuseppe@test.it", 4,7,t2s,"09/06/2026 15:35:00","95m 0s",
     "q_test03,q_test05,q_test07,q_test12,q_test11;seed=33333333",
     0,0, "FASTA",1, '["Smith-Waterman","Needleman-Wunsch"]',1, "[0,1]",1, 0,1],
    // Score 7/7 — q_test04("Timina") come random
    ["100004","Ferrari Anna",  "anna@test.it",     7,7,t2s,"09/06/2026 15:20:00","80m 0s",
     "q_test03,q_test05,q_test07,q_test12,q_test04;seed=44444444",
     1,2, "FASTA",1, '["Smith-Waterman","Needleman-Wunsch"]',1, "[0,0]",2, "Timina",1],
    // In corso — q_test02 come random, nessuna risposta
    ["100005","Esposito Marco","marco@test.it",    "",7,t2s,"","",
     "q_test03,q_test05,q_test07,q_test12,q_test02;seed=55555555",
     "","", "","", "","", "","", "",""],
  ].forEach(r => r2.appendRow(r));

  // ── 2026-06-14-test04 ──────────────────────────────────────────
  // t-ccc333: q_test13(mc,1) random-Meiosi(mc,1=q_test14) q_test16(match,2) = 4pt
  // Risposte corrette: q_test13→B=idx1, q_test14→A=idx0, q_test16→[0,1,2,3]
  // q_test16 match [0,2,1,3]: item0→OK, item1→KO, item2→KO, item3→OK → 2/4*2=1pt
  const r3 = ss.insertSheet("2026-06-14-test04");
  const h3 = ["Matricola","Nominativo","Email","Score","Totale","Inizio","Fine","Durata","QIDs",
               "Ans1","Pt1","Ans2","Pt2","Ans3","Pt3"];
  r3.appendRow(h3);
  r3.getRange(1,1,1,h3.length).setFontWeight("bold");
  r3.setFrozenRows(1);
  r3.getRange(1, 1, r3.getMaxRows(), 1).setNumberFormat("@");
  const t3s = "14/06/2026 09:00:00";
  [
    // Score 2/4 — q_test14 sbagliata, match parziale
    ["234001","Ferri Anna",  "a.ferri@test.it",  2,4,t3s,"14/06/2026 09:58:10","58m 10s",
     "q_test13,q_test14,q_test16;seed=13579246",
     1,1, 2,0, "[0,2,1,3]",1],
    // Score 4/4 — tutto corretto
    ["234002","Neri Paolo",  "p.neri@test.it",   4,4,t3s,"14/06/2026 09:55:00","55m 0s",
     "q_test13,q_test14,q_test16;seed=24681357",
     1,1, 0,1, "[0,1,2,3]",2],
  ].forEach(r => r3.appendRow(r));

  // ── 2026-06-14-test05 ──────────────────────────────────────────
  // t-ddd444: q_test17(mc,1) q_test18(mc,1) q_test19(fitb,1) q_test20(cloze,2) = 5pt
  // Shuffle=no → QIDs senza seed
  // Risposte corrette: q_test17→B=idx1, q_test18→C=idx2, q_test19→"GRCh38", q_test20→[0,0]
  const r4 = ss.insertSheet("2026-06-14-test05");
  const h4 = ["Matricola","Nominativo","Email","Score","Totale","Inizio","Fine","Durata","QIDs",
               "Ans1","Pt1","Ans2","Pt2","Ans3","Pt3","Ans4","Pt4"];
  r4.appendRow(h4);
  r4.getRange(1,1,1,h4.length).setFontWeight("bold");
  r4.setFrozenRows(1);
  r4.getRange(1, 1, r4.getMaxRows(), 1).setNumberFormat("@");
  const t4s = "14/06/2026 09:00:00";
  [
    // Score 5/5 — tutto corretto (shuffle off → no seed nel QIDs)
    ["345001","Costa Elena", "e.costa@test.it",  5,5,t4s,"14/06/2026 09:25:40","25m 40s",
     "q_test17,q_test18,q_test19,q_test20",
     1,1, 2,1, "GRCh38",1, "[0,0]",2],
    // In corso — 2 risposte salvate (q_test18 sbagliata)
    ["345002","Blu Roberto", "r.blu@test.it",    "",5,t4s,"","",
     "q_test17,q_test18,q_test19,q_test20",
     1,"", 0,"", "","", "",""],
  ].forEach(r => r4.appendRow(r));

  // rimuove il foglio vuoto di default
  const def = ss.getSheetByName("Foglio1");
  if (def) ss.deleteSheet(def);
}

// ── utilità ─────────────────────────────────────────────────
function _fmtTs(d) {
  const p = n => String(n).padStart(2,"0");
  return p(d.getDate())+"/"+p(d.getMonth()+1)+"/"+d.getFullYear()+" "+
         p(d.getHours())+":"+p(d.getMinutes())+":"+p(d.getSeconds());
}
