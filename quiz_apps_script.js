// ============================================================
// Google Apps Script — Quiz Bioinformatica
// Applicazioni di Bioinformatica - Genetica Umana - MedTec
// ============================================================
// Incolla questo codice nell'editor Apps Script del foglio.
// Distribuisci come App Web:
//   - Esegui come: Me (franapoli@gmail.com)
//   - Chi può accedere: Chiunque
// ============================================================

const SHEET_ID = "1hj1SAiPSKIhYcMCPC9h-1Y9Vtvs8bJdHFSmsXKfL3Hw";
const N_QUESTIONS = 20;

// Indici colonne foglio risultati (1-based)
const COL_MATRICOLA  = 1;
const COL_NOMINATIVO = 2;
const COL_EMAIL      = 3;
const COL_SCORE      = 4;
const COL_TOTALE     = 5;
const COL_TS_START   = 6;
const COL_TS_END     = 7;
const COL_ELAPSED    = 8;
const COL_ANS_FIRST  = 9; // Dom1, Pt1, Dom2, Pt2, ...

// Colonne foglio _meta (0-based per array, 1-based per Range)
const META_COLS = {
  exam_id:    0,   // A
  exam_name:  1,   // B
  exam_date:  2,   // C
  duration:   3,   // D
  mode:       4,   // E  "exam" | "practice"
  status:     5,   // F  "open" | "closed"
  created:    6,   // G
  sheet_link: 7    // H
};

// ------------------------------------------------------------
// Formatta timestamp ISO → DD/MM/YYYY HH:MM:SS
// ------------------------------------------------------------
function formatTs(isoStr) {
  if (!isoStr) return "";
  try {
    const d = new Date(isoStr);
    const pad = n => String(n).padStart(2, "0");
    return pad(d.getDate()) + "/" + pad(d.getMonth()+1) + "/" + d.getFullYear()
      + " " + pad(d.getHours()) + ":" + pad(d.getMinutes()) + ":" + pad(d.getSeconds());
  } catch(e) { return isoStr; }
}

// ------------------------------------------------------------
// Formatta data YYYY-MM-DD → DD/MM/YYYY
// ------------------------------------------------------------
function formatDateIt(dateStr) {
  if (!dateStr) return "";
  const parts = String(dateStr).split("-");
  if (parts.length !== 3) return dateStr;
  return parts[2] + "/" + parts[1] + "/" + parts[0];
}

// ------------------------------------------------------------
// Legge o crea il foglio _config (solo admin_password)
// ------------------------------------------------------------
function getAdminPassword() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  let sheet = ss.getSheetByName("_config");
  if (!sheet) {
    sheet = ss.insertSheet("_config");
    sheet.appendRow(["Chiave", "Valore"]);
    sheet.appendRow(["admin_password", "cambiami"]);
    sheet.getRange(1, 1, 1, 2).setFontWeight("bold");
    sheet.setFrozenRows(1);
  }
  const values = sheet.getDataRange().getValues();
  for (let i = 1; i < values.length; i++) {
    if (String(values[i][0]) === "admin_password") return String(values[i][1]);
  }
  return "";
}

// ------------------------------------------------------------
// Legge o crea il foglio _meta
// Restituisce l'oggetto sheet
// ------------------------------------------------------------
function getMetaSheet() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  let meta = ss.getSheetByName("_meta");
  if (!meta) {
    meta = ss.insertSheet("_meta");
    meta.appendRow(["TracciaID", "Nome", "Data", "Durata (min)", "Modalità", "Stato", "Creata", "Foglio"]);
    meta.getRange(1, 1, 1, 8).setFontWeight("bold");
    meta.setFrozenRows(1);
  }
  return meta;
}

// ------------------------------------------------------------
// Legge la riga _meta per un dato exam_id
// Restituisce oggetto con i campi, o null se non trovata
// ------------------------------------------------------------
function readTrack(examId) {
  const meta = getMetaSheet();
  const tz = Session.getScriptTimeZone();
  const values = meta.getDataRange().getValues();
  for (let i = 1; i < values.length; i++) {
    if (String(values[i][META_COLS.exam_id]) === examId) {
      // La cella Data può essere un oggetto Date (Sheets auto-parse) → formattiamo come YYYY-MM-DD
      const rawDate = values[i][META_COLS.exam_date];
      let examDate = "";
      if (rawDate instanceof Date && !isNaN(rawDate)) {
        examDate = Utilities.formatDate(rawDate, tz, "yyyy-MM-dd");
      } else {
        examDate = String(rawDate);
      }
      return {
        exam_id:   String(values[i][META_COLS.exam_id]),
        exam_name: String(values[i][META_COLS.exam_name]),
        exam_date: examDate,
        duration:  String(values[i][META_COLS.duration]),
        mode:      String(values[i][META_COLS.mode])   || "exam",
        status:    String(values[i][META_COLS.status])  || "closed",
        rowIndex:  i + 1
      };
    }
  }
  return null;
}

// ------------------------------------------------------------
// Crea una nuova riga _meta per una traccia appena vista
// Valori di default: status=closed, mode=exam, data=oggi
// ------------------------------------------------------------
function createTrack(examId) {
  const meta = getMetaSheet();
  const today = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd");
  const now   = formatTs(new Date().toISOString());
  meta.appendRow([examId, "", today, "60", "exam", "closed", now, ""]);
  return readTrack(examId);
}

// ------------------------------------------------------------
// Aggiorna uno o più campi della riga _meta per exam_id
// updates = { exam_name, exam_date, duration, mode, status }
// ------------------------------------------------------------
function updateTrack(examId, updates, examSheet) {
  const meta = getMetaSheet();
  const values = meta.getDataRange().getValues();
  let rowIndex = -1;
  for (let i = 1; i < values.length; i++) {
    if (String(values[i][META_COLS.exam_id]) === examId) { rowIndex = i + 1; break; }
  }
  if (rowIndex < 0) return;

  const colMap = {
    exam_name: META_COLS.exam_name + 1,
    exam_date: META_COLS.exam_date + 1,
    duration:  META_COLS.duration  + 1,
    mode:      META_COLS.mode      + 1,
    status:    META_COLS.status    + 1
  };
  for (const key in updates) {
    if (colMap[key] && updates[key] !== undefined && updates[key] !== null) {
      meta.getRange(rowIndex, colMap[key]).setValue(updates[key]);
    }
  }

  // Aggiorna link al foglio se fornito
  if (examSheet) {
    const gid = examSheet.getSheetId();
    meta.getRange(rowIndex, META_COLS.sheet_link + 1)
      .setFormula('=HYPERLINK("#gid=' + gid + '","' + examId + '")');
  }
}

// ------------------------------------------------------------
// Trova o crea il foglio risultati per exam_id
// ------------------------------------------------------------
function getResultSheet(examId) {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  let sheet = ss.getSheetByName(examId);
  if (!sheet) {
    sheet = ss.insertSheet(examId);
    const headers = ["Matricola", "Nominativo", "Email", "Score", "Totale", "Inizio", "Fine", "Durata"];
    for (let i = 1; i <= N_QUESTIONS; i++) {
      headers.push("Dom" + i);
      headers.push("Pt" + i);
    }
    sheet.appendRow(headers);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold");
    sheet.setFrozenRows(1);
    // Colonna matricola sempre come testo (preserva zeri iniziali)
    sheet.getRange(1, COL_MATRICOLA, sheet.getMaxRows(), 1).setNumberFormat("@");
  }
  return sheet;
}

// ------------------------------------------------------------
// Trova riga per matricola nel foglio risultati (1-based, -1 se non trovata)
// ------------------------------------------------------------
function findRow(sheet, matricola) {
  const values = sheet.getDataRange().getValues();
  for (let i = 1; i < values.length; i++) {
    if (String(values[i][COL_MATRICOLA - 1]) === String(matricola)) return i + 1;
  }
  return -1;
}

// ------------------------------------------------------------
// Risposta JSON
// ------------------------------------------------------------
function corsResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function doGet(e) {
  return corsResponse({ status: "ok", message: "Quiz Bioinformatica Apps Script attivo" });
}

// ------------------------------------------------------------
// doPost — dispatcher principale
// ------------------------------------------------------------
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);

    // ----------------------------------------------------------------
    // getTrack — chiamato dal quiz all'avvio con il suo exam_id
    // Se la traccia non esiste in _meta la crea con valori di default
    // ----------------------------------------------------------------
    if (data.action === "getTrack") {
      const examId = data.examId;
      if (!examId) return corsResponse({ status: "error", message: "examId mancante" });
      let track = readTrack(examId);
      if (!track) {
        track = createTrack(examId);
        // Crea subito il foglio risultati e aggiorna il link in _meta
        const examSheet = getResultSheet(examId);
        updateTrack(examId, {}, examSheet);
        track = readTrack(examId);
      }
      return corsResponse({ status: "ok", track });
    }

    // ----------------------------------------------------------------
    // getAllTracks — chiamato da admin per popolare il menu a tendina
    // ----------------------------------------------------------------
    if (data.action === "getAllTracks") {
      if (data.password !== getAdminPassword()) {
        return corsResponse({ status: "error", message: "Password errata" });
      }
      const meta = getMetaSheet();
      const values = meta.getDataRange().getValues();
      const tracks = [];
      for (let i = 1; i < values.length; i++) {
        tracks.push({
          exam_id:   String(values[i][META_COLS.exam_id]),
          exam_name: String(values[i][META_COLS.exam_name]),
          exam_date: String(values[i][META_COLS.exam_date]),
          duration:  String(values[i][META_COLS.duration]),
          mode:      String(values[i][META_COLS.mode])  || "exam",
          status:    String(values[i][META_COLS.status]) || "closed"
        });
      }
      return corsResponse({ status: "ok", tracks });
    }

    // ----------------------------------------------------------------
    // setTrack — chiamato da admin per aggiornare attributi di una traccia
    // ----------------------------------------------------------------
    if (data.action === "setTrack") {
      if (data.password !== getAdminPassword()) {
        return corsResponse({ status: "error", message: "Password errata" });
      }
      const examId = data.examId;
      if (!examId) return corsResponse({ status: "error", message: "examId mancante" });

      // Assicura che la traccia esista in _meta
      let track = readTrack(examId);
      if (!track) track = createTrack(examId);

      const updates = {};
      if (data.exam_name !== undefined) updates.exam_name = data.exam_name;
      if (data.exam_date !== undefined) updates.exam_date = data.exam_date;
      if (data.duration  !== undefined) updates.duration  = data.duration;
      if (data.mode      !== undefined) updates.mode      = data.mode;
      if (data.status    !== undefined) updates.status    = data.status;

      // Crea foglio risultati se modalità exam e non esiste ancora
      let examSheet = null;
      const newMode = data.mode || track.mode;
      if (newMode === "exam") {
        examSheet = getResultSheet(examId);
      }

      updateTrack(examId, updates, examSheet);
      return corsResponse({ status: "ok" });
    }

    // ----------------------------------------------------------------
    // getMonitor — leggi studenti di una traccia specifica
    // ----------------------------------------------------------------
    if (data.action === "getMonitor") {
      if (data.password !== getAdminPassword()) {
        return corsResponse({ status: "error", message: "Password errata" });
      }
      const examId = data.examId;
      if (!examId) return corsResponse({ status: "error", message: "examId mancante" });

      const track = readTrack(examId);
      const ss = SpreadsheetApp.openById(SHEET_ID);
      const sheet = ss.getSheetByName(examId);
      if (!sheet) return corsResponse({ status: "ok", rows: [], track });

      const values = sheet.getDataRange().getValues();
      const rows = [];
      for (let i = 1; i < values.length; i++) {
        const row = values[i];
        let answered = 0;
        for (let q = 0; q < N_QUESTIONS; q++) {
          if (row[COL_ANS_FIRST - 1 + q * 2] !== "") answered++;
        }
        rows.push({
          matricola:  row[COL_MATRICOLA - 1],
          nominativo: row[COL_NOMINATIVO - 1],
          email:      row[COL_EMAIL - 1],
          score:      row[COL_SCORE - 1],
          tsStart:    row[COL_TS_START - 1],
          tsEnd:      row[COL_TS_END - 1],
          elapsed:    row[COL_ELAPSED - 1],
          answered,
          finalized:  row[COL_TS_END - 1] !== ""
        });
      }
      return corsResponse({ status: "ok", rows, track });
    }

    // ----------------------------------------------------------------
    // Quiz actions: init, update, finalize
    // Richiedono exam_id e che la traccia sia in modalità exam
    // ----------------------------------------------------------------
    const examId = data.examId;
    if (!examId) return corsResponse({ status: "error", message: "examId mancante" });

    const track = readTrack(examId);
    if (!track) return corsResponse({ status: "error", message: "Traccia non trovata: " + examId });
    if (track.mode === "practice") return corsResponse({ status: "ok", skipped: true });

    const sheet = getResultSheet(examId);

    // ---- INIT ----
    if (data.action === "init") {
      // Controlla stato traccia
      if (track.status === "closed") {
        return corsResponse({ status: "error", message: "Esame non disponibile" });
      }
      const values = sheet.getDataRange().getValues();
      for (let i = 1; i < values.length; i++) {
        if (String(values[i][COL_MATRICOLA - 1]) === String(data.matricola)) {
          const finalized = values[i][COL_TS_END - 1] !== "";
          return corsResponse({ status: "duplicate", finalized });
        }
      }
      const row = [String(data.matricola), data.nominativo || "", data.email || "", "", 30,
                   formatTs(new Date().toISOString()), "", ""];
      for (let i = 0; i < N_QUESTIONS; i++) { row.push(""); row.push(""); }
      sheet.appendRow(row);
      // Forza la colonna matricola come testo per preservare gli zeri iniziali
      const newRowIndex = sheet.getLastRow();
      sheet.getRange(newRowIndex, COL_MATRICOLA).setNumberFormat("@");
      return corsResponse({ status: "ok" });
    }

    // ---- UPDATE ----
    if (data.action === "update") {
      const rowIndex = findRow(sheet, data.matricola);
      if (rowIndex === -1) return corsResponse({ status: "error", message: "Matricola non trovata" });
      const col = COL_ANS_FIRST + (data.qIndex - 1) * 2;
      sheet.getRange(rowIndex, col).setValue(data.value);
      return corsResponse({ status: "ok" });
    }

    // ---- FINALIZE ----
    if (data.action === "finalize") {
      const rowIndex = findRow(sheet, data.matricola);
      if (rowIndex === -1) return corsResponse({ status: "error", message: "Matricola non trovata" });
      sheet.getRange(rowIndex, COL_NOMINATIVO).setValue(data.nominativo || "");
      sheet.getRange(rowIndex, COL_EMAIL).setValue(data.email || "");
      sheet.getRange(rowIndex, COL_SCORE).setValue(data.score);
      sheet.getRange(rowIndex, COL_TS_START).setValue(formatTs(data.tsStart));
      sheet.getRange(rowIndex, COL_TS_END).setValue(formatTs(data.tsEnd));
      sheet.getRange(rowIndex, COL_ELAPSED).setValue(data.elapsed || "");
      if (data.answers && data.answers.length > 0) {
        data.answers.forEach((item, i) => {
          const col = COL_ANS_FIRST + i * 2;
          sheet.getRange(rowIndex, col).setValue(item.ans || "");
          sheet.getRange(rowIndex, col + 1).setValue(item.pts !== undefined ? item.pts : "");
        });
      }
      return corsResponse({ status: "ok" });
    }

    return corsResponse({ status: "error", message: "Azione non riconosciuta: " + data.action });

  } catch (err) {
    return corsResponse({ status: "error", message: err.toString() });
  }
}

// ------------------------------------------------------------
// testGetTrack — simula prima apertura di una traccia
// ------------------------------------------------------------
function testGetTrack() {
  const track = readTrack("quiz-vhl-2026-05-28") || createTrack("quiz-vhl-2026-05-28");
  Logger.log(JSON.stringify(track));
}

// ------------------------------------------------------------
// testWrite — scrive una riga di test nel foglio della traccia
// ------------------------------------------------------------
function testWrite() {
  const examId = "quiz-vhl-2026-05-28";
  const sheet  = getResultSheet(examId);
  const now    = formatTs(new Date().toISOString());
  const row    = ["00000", "Rossi Mario", "m.rossi@studenti.unisannio.it", 28, 30, now, now, "45m 10s"];
  const ans    = ["B","B","B","C","B","B","B","6,5,4,3,3","B","B","A","C","B","C","C"];
  const pts    = [2,2,2,0,2,2,2,3,1,2,1,2,2,3,0];
  for (let i = 0; i < N_QUESTIONS; i++) { row.push(ans[i]); row.push(pts[i]); }
  sheet.appendRow(row);
  Logger.log("testWrite OK — foglio: " + examId);
}
