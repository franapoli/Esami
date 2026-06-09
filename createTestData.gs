/**
 * createTestData.gs
 * Incolla questo file nell'editor Apps Script ed esegui createTestData().
 * Crea una cartella "test" dentro la cartella QuizForge principale,
 * poi crea e popola due fogli: Domande e Risultati.
 * Al termine stampa nel log gli ID da inserire nell'admin.
 */

const PARENT_FOLDER_ID = "1FCl15simn4Ev363a59aEfOq1qZF4T78H";

function createTestData() {
  // --- Cartella test ---
  const parent = DriveApp.getFolderById(PARENT_FOLDER_ID);
  let testFolder;
  const existing = parent.getFoldersByName("test");
  testFolder = existing.hasNext() ? existing.next() : parent.createFolder("test");
  Logger.log("Cartella test: " + testFolder.getUrl());

  // --- Foglio Domande ---
  const qSS  = SpreadsheetApp.create("Domande Test");
  testFolder.addFile(DriveApp.getFileById(qSS.getId()));
  DriveApp.getRootFolder().removeFile(DriveApp.getFileById(qSS.getId()));
  _populateDomande(qSS);
  Logger.log("SHEET_QUESTIONS_ID = " + qSS.getId());

  // --- Foglio Risultati ---
  const rSS = SpreadsheetApp.create("Risultati Test");
  testFolder.addFile(DriveApp.getFileById(rSS.getId()));
  DriveApp.getRootFolder().removeFile(DriveApp.getFileById(rSS.getId()));
  _populateRisultati(rSS);
  Logger.log("SHEET_RESULTS_ID   = " + rSS.getId());

  Logger.log("--- Copia questi ID nell'admin e in ScriptProperties ---");
}

// ============================================================
function _populateDomande(ss) {
  // --- Foglio questions ---
  const qs = ss.getSheets()[0];
  qs.setName("questions");
  const qHeader = ["ID","Corso","Categoria","Sottocategoria","Tags","Stato","Tipo",
                   "Testo","Opzioni","Corretta","Punti","Placeholder","Data"];
  qs.appendRow(qHeader);
  qs.getRange(1,1,1,qHeader.length).setFontWeight("bold");
  qs.setFrozenRows(1);

  const qRows = [
    // mc
    ["q_test01","bioinf","Genetica","Mutazioni","mutazione,puntiforme","verificato","mc",
     "Quale tipo di mutazione sostituisce un singolo nucleotide?",
     '["Delezione","Sostituzione puntiforme","Inversione","Traslocazione"]',
     "B","1","",""],
    ["q_test02","bioinf","Genetica","Mutazioni","mutazione,frameshift","verificato","mc",
     "Una delezione di 2 basi causa:",
     '["Mutazione silente","Mutazione missenso","Frameshift","Nessuna variazione"]',
     "C","1","",""],
    ["q_test03","bioinf","Bioinformatica","Allineamento","blast,allineamento","verificato","mc",
     "Qual è la funzione principale di BLAST?",
     '["Predire struttura proteica","Allineare sequenze con database","Calcolare alberi filogenetici","Annotare varianti"]',
     "B","2","",""],
    // fitb
    ["q_test04","bioinf","Genetica","Basi","dna,basi","verificato","fitb",
     "La base azotata complementare della adenina nel DNA è la ___.",
     "[]","Timina","1","es. Citosina",""],
    ["q_test05","bioinf","Bioinformatica","Formati","fasta,formato","verificato","fitb",
     "Il formato ___ è usato per rappresentare sequenze biologiche in testo.",
     "[]","FASTA","1","es. FASTQ",""],
    // match
    ["q_test06","bioinf","Genetica","Basi","basi,appaiamento","verificato","match",
     "Abbina ogni base alla sua complementare nel DNA:",
     '["Adenina","Guanina","Citosina","Timina"]',
     '["Timina","Citosina","Guanina","Adenina"]',
     "1","",""],
    // multi-fitb
    ["q_test07","bioinf","Bioinformatica","Allineamento","smith,waterman","verificato","multi-fitb",
     "Completa: l'algoritmo di ___ è locale, quello di ___ è globale.",
     "[]",
     '["Smith-Waterman","Needleman-Wunsch"]',
     "1","",
     '{"boxes":[{"label":"Algoritmo locale","cols":1},{"label":"Algoritmo globale","cols":1}],"cols":2}'],
    // free
    ["q_test08","bioinf","Genetica","Malattie","brca,cancro","verificato","free",
     "Descrivi brevemente il ruolo del gene BRCA1 nella soppressione tumorale.",
     "[]","","3","",""],
    // mc bozza
    ["q_test09","bioinf","Bioinformatica","Struttura","proteina,struttura","bozza","mc",
     "Quale livello strutturale è stabilizzato dai ponti disolfuro?",
     '["Primaria","Secondaria","Terziaria","Quaternaria"]',
     "C","1","",""],
  ];
  qRows.forEach(r => qs.appendRow(r));

  // --- Foglio tracce ---
  const tr = ss.insertSheet("tracce");
  tr.appendRow(["TracciaID","Nome","Items"]);
  tr.getRange(1,1,1,3).setFontWeight("bold");
  tr.setFrozenRows(1);
  tr.appendRow([
    "t-aaa111",
    "Domande di genetica base",
    JSON.stringify([
      {"type":"fixed","id":"q_test01"},
      {"type":"fixed","id":"q_test02"},
      {"type":"fixed","id":"q_test04"},
      {"type":"fixed","id":"q_test06"},
      {"type":"random","categoria":"Genetica","tag":"brca"}
    ])
  ]);
  tr.appendRow([
    "t-bbb222",
    "Misto bioinf + genetica",
    JSON.stringify([
      {"type":"fixed","id":"q_test03"},
      {"type":"fixed","id":"q_test05"},
      {"type":"fixed","id":"q_test07"},
      {"type":"random","categoria":"Genetica"},
      {"type":"random","categoria":"Bioinformatica","punti":2}
    ])
  ]);

  // --- Foglio esami ---
  const es = ss.insertSheet("esami");
  const eHeader = ["EsameID","TracciaID","Nome","Data","Durata (min)","Corso","Modalità","Stato","Password"];
  es.appendRow(eHeader);
  es.getRange(1,1,1,eHeader.length).setFontWeight("bold");
  es.setFrozenRows(1);
  es.appendRow([
    "2026-06-01-test01","t-aaa111","Esame Genetica Giugno 2026",
    "2026-06-01","60","Genetica Umana","exam","closed","test123"
  ]);
  es.appendRow([
    "2026-06-09-test02","t-bbb222","Prova pratica bioinf",
    "2026-06-09","90","Applicazioni di Bioinformatica","practice","open",""
  ]);
}

// ============================================================
// Schema colonne foglio risultati (deve corrispondere alle costanti dell'Apps Script):
//  1=Matricola  2=Nominativo  3=Email  4=Score  5=Totale
//  6=Inizio     7=Fine        8=Durata 9=QIDs   10+=Ans1,Pt1,Ans2,Pt2,...
//
// COL_TS_END (col 7 "Fine") vuota  → studente in corso
// COL_TS_END non vuota             → consegnato (mostrato in Risultati)
// Abandon elimina la riga, non esiste status "abandoned".
//
// Specchio Esami → META_COLS: A=EsameID B=TracciaID C=Nome D=Data E=Durata F=Corso G=Modalità H=Stato I=Creata

function _populateRisultati(ss) {
  // --- _config ---
  const cfg = ss.getSheets()[0];
  cfg.setName("_config");
  cfg.appendRow(["Chiave","Valore"]);
  cfg.appendRow(["admin_password","cambiami"]);
  cfg.getRange(1,1,1,2).setFontWeight("bold");
  cfg.setFrozenRows(1);

  // --- Esami (specchio meta, schema META_COLS) ---
  const meta = ss.insertSheet("Esami");
  const mHeader = ["EsameID","TracciaID","Nome","Data","Durata","Corso","Modalità","Stato","Creata"];
  meta.appendRow(mHeader);
  meta.getRange(1,1,1,mHeader.length).setFontWeight("bold");
  meta.setFrozenRows(1);
  meta.appendRow(["2026-06-01-test01","t-aaa111","Esame Genetica Giugno 2026","2026-06-01","60","Genetica Umana","exam","closed",new Date()]);
  meta.appendRow(["2026-06-09-test02","t-bbb222","Prova pratica bioinf","2026-06-09","90","Applicazioni di Bioinformatica","practice","open",new Date()]);

  // --- Tab risultati: 2026-06-01-test01 ---
  // Domande assegnate: q_test01(mc,1pt) q_test02(mc,1pt) q_test04(fitb,1pt) q_test06(match,1pt) — totale 4pt
  // Risposte corrette: q_test01→indice 1 (B), q_test02→indice 2 (C), q_test04→"Timina", q_test06→'["Timina","Citosina","Guanina","Adenina"]'
  const r1 = ss.insertSheet("2026-06-01-test01");
  const h1 = ["Matricola","Nominativo","Email","Score","Totale","Inizio","Fine","Durata","QIDs",
               "Ans1","Pt1","Ans2","Pt2","Ans3","Pt3","Ans4","Pt4"];
  r1.appendRow(h1);
  r1.getRange(1,1,1,h1.length).setFontWeight("bold");
  r1.setFrozenRows(1);
  const qids1 = "q_test01,q_test02,q_test04,q_test06";
  const t1s = "01/06/2026 09:00:00";  // inizio comune
  // q_test06 match: left=["Adenina","Guanina","Citosina","Timina"], right=["Timina","Citosina","Guanina","Adenina"]
  // Risposta corretta come indici interi: [0,1,2,3] (ogni sinistra abbinata al destra parallelo)
  // Risposta errata:                      [3,2,1,0] (tutto rovesciato → 0/4 corretti → 0pt)
  // [Matricola, Nominativo, Email, Score, Totale, Inizio, Fine, Durata, QIDs, Ans1,Pt1, Ans2,Pt2, Ans3,Pt3, Ans4,Pt4]
  const rows1 = [
    ["100001","Rossi Mario",   "mario@test.it",    4,4, t1s,"01/06/2026 09:52:00","52 min",qids1, 1,1, 2,1, "Timina",1, "[0,1,2,3]",1],
    ["100002","Bianchi Lucia", "lucia@test.it",    3,4, t1s,"01/06/2026 09:58:00","58 min",qids1, 1,1, 0,0, "Timina",1, "[0,1,2,3]",1],
    ["100003","Verdi Giuseppe","giuseppe@test.it", 4,4, t1s,"01/06/2026 10:05:00","65 min",qids1, 1,1, 2,1, "Timina",1, "[0,1,2,3]",1],
    ["100004","Ferrari Anna",  "anna@test.it",     1,4, t1s,"01/06/2026 10:10:00","70 min",qids1, 0,0, 2,1, "Uracile",0,"[3,2,1,0]",0],
    ["100005","Esposito Marco","marco@test.it",    0,4, t1s,"01/06/2026 10:15:00","75 min",qids1, 0,0, 0,0, "Uracile",0,"[3,2,1,0]",0],
    ["100006","Romano Sara",   "sara@test.it",     3,4, t1s,"01/06/2026 10:00:00","60 min",qids1, 1,1, 2,1, "Timina",1, "[3,2,1,0]",0],
    ["100007","Colombo Luca",  "luca@test.it",     2,4, t1s,"01/06/2026 10:08:00","68 min",qids1, 1,1, 0,0, "Timina",1, "[3,2,1,0]",0],
  ];
  rows1.forEach(r => r1.appendRow(r));

  // --- Tab risultati: 2026-06-09-test02 ---
  // Domande: q_test03(mc,2pt) q_test05(fitb,1pt) q_test07(multi-fitb,1pt) q_test01(mc,1pt) q_test08(free,3pt) — totale 8pt
  // Corrette: q_test03→1(B), q_test05→"FASTA", q_test07→'["Smith-Waterman","Needleman-Wunsch"]', q_test01→1(B), q_test08→null(manuale)
  const r2 = ss.insertSheet("2026-06-09-test02");
  const h2 = ["Matricola","Nominativo","Email","Score","Totale","Inizio","Fine","Durata","QIDs",
               "Ans1","Pt1","Ans2","Pt2","Ans3","Pt3","Ans4","Pt4","Ans5","Pt5"];
  r2.appendRow(h2);
  r2.getRange(1,1,1,h2.length).setFontWeight("bold");
  r2.setFrozenRows(1);
  const qids2 = "q_test03,q_test05,q_test07,q_test01,q_test08";
  const t2s = "09/06/2026 14:00:00";
  // Fine vuota = in_progress (non mostrato in Risultati, ma visibile nel Monitor)
  const rows2 = [
    ["100001","Rossi Mario",   "mario@test.it",    5,8, t2s,"09/06/2026 15:28:00","88 min",qids2, 1,2, "FASTA",1, '["Smith-Waterman","Needleman-Wunsch"]',1, 1,1, "Buona risposta",0],
    ["100002","Bianchi Lucia", "lucia@test.it",    0,8, t2s,"",                  "",       qids2, 1,0, "",0,      "",0,                                        0,0, "",0],
    ["100003","Verdi Giuseppe","giuseppe@test.it", 4,8, t2s,"09/06/2026 15:35:00","95 min",qids2, 0,0, "FASTA",1, '["Smith-Waterman","Needleman-Wunsch"]',1, 1,1, "",0],
    ["100004","Ferrari Anna",  "anna@test.it",     5,8, t2s,"09/06/2026 15:20:00","80 min",qids2, 1,2, "FASTA",1, '["Smith-Waterman","Needleman-Wunsch"]',1, 1,1, "",0],
    ["100005","Esposito Marco","marco@test.it",    0,8, t2s,"",                  "",       qids2, "",0, "",0,      "",0,                                        "",0,"",0],
  ];
  rows2.forEach(r => r2.appendRow(r));
}
