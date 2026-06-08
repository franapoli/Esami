// ============================================================
// QuizForge — Google Apps Script v2
// Architettura: repository domande separato dai risultati
// ============================================================
// Distribuisci come App Web:
//   - Esegui come: Me (franapoli@gmail.com)
//   - Chi può accedere: Chiunque
// ============================================================

const VERSION = "2.10.0"; // aggiornare ad ogni deploy

// ID di default dei due Google Sheets (fallback se non configurati via ScriptProperties)
const SHEET_QUESTIONS_ID_DEFAULT = "1qrDVCr4yxBHD3qINQSl-Jk4hIU-O4OS4NVHXa3nbOzQ";
const SHEET_RESULTS_ID_DEFAULT   = "1WQ1fnjN-j3o5yxjtH66qkmPIO532Y5t-DTSSK0MhOgA";
// Cartella Drive dove risiedono i fogli gestiti (default = cartella QuizForge)
const DRIVE_FOLDER_ID_DEFAULT    = "1FCl15simn4Ev363a59aEfOq1qZF4T78H";

// Legge gli ID attivi: prima da ScriptProperties, poi dal default hardcoded.
// ScriptProperties è indipendente da entrambi i fogli → nessuna circolarità.
function getSheetQuestionsId() {
  return PropertiesService.getScriptProperties().getProperty("SHEET_QUESTIONS_ID") || SHEET_QUESTIONS_ID_DEFAULT;
}
function getSheetResultsId() {
  return PropertiesService.getScriptProperties().getProperty("SHEET_RESULTS_ID") || SHEET_RESULTS_ID_DEFAULT;
}
function getDriveFolderId() {
  return PropertiesService.getScriptProperties().getProperty("DRIVE_FOLDER_ID") || DRIVE_FOLDER_ID_DEFAULT;
}

// Indici colonne foglio risultati (1-based, identici a v1)
const COL_MATRICOLA  = 1;
const COL_NOMINATIVO = 2;
const COL_EMAIL      = 3;
const COL_SCORE      = 4;
const COL_TOTALE     = 5;
const COL_TS_START   = 6;
const COL_TS_END     = 7;
const COL_ELAPSED    = 8;
const COL_QIDS       = 9; // IDs domande assegnate (comma-separated)
const COL_ANS_FIRST  = 10; // Dom1, Pt1, Dom2, Pt2, ...

// Indici colonne foglio "questions" (0-based)
const Q_ID            = 0;  // A
const Q_CORSO         = 1;  // B
const Q_CATEGORIA     = 2;  // C
const Q_SOTTOCATEG    = 3;  // D
const Q_TAGS          = 4;  // E  tag separati da virgola (es. "blast,phylogeny")
const Q_STATO         = 5;  // F  "bozza" | "verificato"
const Q_TIPO          = 6;  // G  "mc" | "fitb" | "match" | "free" | "multi-fitb" | "cloze"
const Q_TESTO         = 7;  // H
const Q_OPTIONS       = 8;  // I  JSON array di opzioni (mc/match); vuoto per fitb/free/cloze/multi-fitb
const Q_CORRETTA      = 9;  // J  lettera A-Z (mc), testo esatto (fitb), JSON array destra (match)
const Q_PUNTI         = 10; // K
const Q_PLACEHOLDER   = 11; // L  solo per fitb
const Q_DATA          = 12; // M  JSON per tipi complessi (multi-fitb, cloze)

// Indici colonne foglio "tracce" (0-based)
const T_ID            = 0;  // A  track_id
const T_CORSO         = 1;  // B
const T_NOME          = 2;  // C
const T_DATA          = 3;  // D  YYYY-MM-DD
const T_DURATA        = 4;  // E  minuti (0 = senza limite)
const T_MODALITA      = 5;  // F  "exam" | "practice"
const T_STATO         = 6;  // G  "open" | "closed"
const T_ITEMS         = 7;  // H  JSON array: [{type:"fixed",id?} | {type:"random",categoria?,sottocateg?,tag?}]
const T_PASSWORD      = 8;  // I  password d'accesso (solo exam; vuota = nessuna)

// Colonne foglio _meta risultati (0-based)
const META_COLS = {
  exam_id:    0,
  exam_name:  1,
  exam_date:  2,
  duration:   3,
  mode:       4,
  status:     5,
  created:    6,
  sheet_link: 7
};

// ------------------------------------------------------------
// Utilità
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

function corsResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// Genera UUID corto tipo "q_a3f9b2"
function generateQuestionId() {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let id = "q_";
  for (let i = 0; i < 6; i++) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return id;
}

// Converte lettera corretta (A, B, C, … Z) in indice 0-based
function letterToIndex(letter) {
  const l = String(letter).toUpperCase().trim();
  const idx = l.charCodeAt(0) - 65; // A=0, B=1, …
  return idx >= 0 && idx < 26 ? idx : 0;
}

// ------------------------------------------------------------
// Repository domande
// ------------------------------------------------------------
function getQuestionsSheet() {
  const ss = SpreadsheetApp.openById(getSheetQuestionsId());
  let sheet = ss.getSheetByName("questions");
  if (!sheet) {
    sheet = ss.insertSheet("questions");
    const headers = ["ID", "Corso", "Categoria", "Sottocategoria", "Tags",
                     "Stato", "Tipo", "Testo", "Opzioni", "Corretta", "Punti", "Placeholder", "Data"];
    sheet.appendRow(headers);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold");
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function getTracceSheet() {
  const ss = SpreadsheetApp.openById(getSheetQuestionsId());
  let sheet = ss.getSheetByName("tracce");
  if (!sheet) {
    sheet = ss.insertSheet("tracce");
    const headers = ["TracciaID", "Corso", "Nome", "Data", "Durata (min)", "Modalità", "Stato", "Items", "Password"];
    sheet.appendRow(headers);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold");
    sheet.setFrozenRows(1);
  }
  return sheet;
}

// Legge tutte le domande come mappa id → oggetto
function loadAllQuestions() {
  const sheet = getQuestionsSheet();
  const values = sheet.getDataRange().getValues();
  const map = {};
  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    const id = String(row[Q_ID]).trim();
    if (!id) continue;
    map[id] = {
      id,
      corso:        String(row[Q_CORSO]),
      categoria:    String(row[Q_CATEGORIA]),
      sottocateg:   String(row[Q_SOTTOCATEG]),
      tipo:         String(row[Q_TIPO]).trim() || "mc",
      testo:        String(row[Q_TESTO]),
      options:      (() => { try { const v = String(row[Q_OPTIONS] || ""); return v.trim() ? JSON.parse(v) : []; } catch(e) { return []; } })(),
      corretta:     String(row[Q_CORRETTA]).trim(),
      punti:        Number(row[Q_PUNTI]) || 1,
      placeholder:  String(row[Q_PLACEHOLDER]).trim(),
      tags:         String(row[Q_TAGS] || "").trim(),
      data:         String(row[Q_DATA] || "").trim(),
      stato:        String(row[Q_STATO] || "verificato").trim() || "verificato"
    };
  }
  return map;
}

// Legge la traccia dal foglio tracce, restituisce oggetto o null
function readTraccia(tracciaId) {
  const sheet = getTracceSheet();
  const tz    = Session.getScriptTimeZone();
  const values = sheet.getDataRange().getValues();
  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    if (String(row[T_ID]).trim() !== tracciaId) continue;
    const rawDate = row[T_DATA];
    let dataStr = "";
    if (rawDate instanceof Date && !isNaN(rawDate)) {
      dataStr = Utilities.formatDate(rawDate, tz, "yyyy-MM-dd");
    } else {
      dataStr = String(rawDate);
    }
    return {
      id:          String(row[T_ID]).trim(),
      corso:       String(row[T_CORSO]),
      nome:        String(row[T_NOME]),
      data:        dataStr,
      durata:      String(row[T_DURATA]),
      modalita:    String(row[T_MODALITA]) || "exam",
      stato:       String(row[T_STATO])    || "closed",
      items: (function() {
        try {
          const raw = String(row[T_ITEMS] || "");
          return JSON.parse(raw || "[]");
        } catch(e) { return []; }
      })(),
      password: String(row[T_PASSWORD] || "").trim()
    };
  }
  return null;
}

// Costruisce l'oggetto domanda pronto per il client
function buildQuestionObj(q, pos) {
  const obj = {
    id:      q.id,
    pos:     pos,
    pts:     q.punti,
    type:    q.tipo,
    text:    q.testo,
    correct: q.tipo === "mc" ? letterToIndex(q.corretta) : (q.tipo === "fitb" ? q.corretta : null)
  };
  if (q.tipo === "mc") {
    obj.options = q.options;
  } else if (q.tipo === "fitb") {
    if (q.placeholder) obj.placeholder = q.placeholder;
  } else if (q.tipo === "match") {
    obj.left  = q.options; // termini sinistra (JSON array da Q_OPTIONS)
    try { obj.right = JSON.parse(q.corretta); } catch(e) { obj.right = []; }
    obj.correct = obj.right.slice(); // right[i] è la risposta corretta per left[i]
  } else if (q.tipo === "free") {
    if (q.placeholder) obj.placeholder = q.placeholder;
    obj.correct = null;
  } else if (q.tipo === "multi-fitb") {
    try {
      const d = JSON.parse(q.data || "{}");
      obj.boxes = d.boxes || [];
      obj.cols  = d.cols  || 1;
    } catch(e) { obj.boxes = []; obj.cols = 1; }
    obj.correct = obj.boxes.map(b => String(b.correct || "").trim());
  } else if (q.tipo === "cloze") {
    try {
      const d = JSON.parse(q.data || "{}");
      obj.dropdowns = d.dropdowns || [];
    } catch(e) { obj.dropdowns = []; }
    obj.correct = obj.dropdowns.map(dd => dd.correct ?? 0);
  }
  return obj;
}

// Fisher-Yates shuffle su array (in-place)
function shuffleArray(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Risolve una traccia nelle domande complete, pronte per il client
function resolveTraccia(tracciaId) {
  const traccia = readTraccia(tracciaId);
  if (!traccia) return null;

  const allQ = loadAllQuestions();
  const questions = [];
  const usedIds   = new Set();

  (traccia.items || []).forEach(item => {
    if (item.type === "fixed") {
      usedIds.add(item.id);
      const q = allQ[item.id];
      if (!q) {
        questions.push({ id: item.id, error: "Domanda non trovata: " + item.id, pts: 0, type: "mc", text: "", options: [], correct: 0, pos: questions.length + 1 });
        return;
      }
      questions.push(buildQuestionObj(q, questions.length + 1));

    } else if (item.type === "random") {
      const candidates = Object.values(allQ).filter(q => {
        if (usedIds.has(q.id)) return false;
        if (item.categoria && q.categoria !== item.categoria) return false;
        if (item.sottocateg && q.sottocateg !== item.sottocateg) return false;
        if (item.tag) {
          const qTags = String(q.tags || "").split(",").map(t => t.trim());
          if (!qTags.includes(item.tag)) return false;
        }
        if (item.punti !== undefined && q.punti !== item.punti) return false;
        return true;
      });
      const picked = shuffleArray(candidates)[0];
      if (picked) {
        usedIds.add(picked.id);
        questions.push(buildQuestionObj(picked, questions.length + 1));
      }
    }
  });

  return {
    track: {
      exam_id:   traccia.id,
      exam_name: traccia.nome,
      exam_date: traccia.data,
      duration:  traccia.durata,
      mode:      traccia.modalita,
      status:    traccia.stato,
      corso:     traccia.corso,
      _password: traccia.password   // rimosso dal doPost prima di inviare al client
    },
    questions,
    n_questions: questions.length,
    total_pts:   questions.reduce((s, q) => s + (q.pts || 0), 0)
  };
}

// ------------------------------------------------------------
// Foglio risultati (identico a v1, ma usa SHEET_RESULTS_ID)
// ------------------------------------------------------------
function getAdminPassword() {
  const ss = SpreadsheetApp.openById(getSheetResultsId());
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

function getMetaSheet() {
  const ss = SpreadsheetApp.openById(getSheetResultsId());
  let meta = ss.getSheetByName("_meta");
  if (!meta) {
    meta = ss.insertSheet("_meta");
    meta.appendRow(["TracciaID", "Nome", "Data", "Durata (min)", "Modalità", "Stato", "Creata", "Foglio"]);
    meta.getRange(1, 1, 1, 8).setFontWeight("bold");
    meta.setFrozenRows(1);
  }
  return meta;
}

function readMetaTrack(examId) {
  const meta = getMetaSheet();
  const tz   = Session.getScriptTimeZone();
  const values = meta.getDataRange().getValues();
  for (let i = 1; i < values.length; i++) {
    if (String(values[i][META_COLS.exam_id]) !== examId) continue;
    const rawDate = values[i][META_COLS.exam_date];
    let examDate = "";
    if (rawDate instanceof Date && !isNaN(rawDate)) {
      examDate = Utilities.formatDate(rawDate, tz, "yyyy-MM-dd");
    } else {
      examDate = String(rawDate);
    }
    return {
      exam_id:   examId,
      exam_name: String(values[i][META_COLS.exam_name]),
      exam_date: examDate,
      duration:  String(values[i][META_COLS.duration]),
      mode:      String(values[i][META_COLS.mode])   || "exam",
      status:    String(values[i][META_COLS.status])  || "closed",
      rowIndex:  i + 1
    };
  }
  return null;
}

function ensureMetaTrack(track) {
  // Crea riga _meta nel foglio risultati se non esiste ancora
  const existing = readMetaTrack(track.exam_id);
  if (existing) return existing;
  const meta = getMetaSheet();
  const now  = formatTs(new Date().toISOString());
  meta.appendRow([track.exam_id, track.exam_name, track.exam_date,
                  track.duration, track.modalita || track.mode || "exam",
                  track.status || "closed", now, ""]);
  return readMetaTrack(track.exam_id);
}

function getResultSheet(examId, nQuestions) {
  const ss = SpreadsheetApp.openById(getSheetResultsId());
  let sheet = ss.getSheetByName(examId);
  if (!sheet) {
    sheet = ss.insertSheet(examId);
    const headers = ["Matricola", "Nominativo", "Email", "Score", "Totale", "Inizio", "Fine", "Durata", "QIDs"];
    const n = nQuestions || 20;
    for (let i = 1; i <= n; i++) {
      headers.push("Ans" + i);
      headers.push("Pt" + i);
    }
    sheet.appendRow(headers);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold");
    sheet.setFrozenRows(1);
    sheet.getRange(1, COL_MATRICOLA, sheet.getMaxRows(), 1).setNumberFormat("@");
  }
  return sheet;
}

function findRow(sheet, matricola) {
  const values = sheet.getDataRange().getValues();
  for (let i = 1; i < values.length; i++) {
    if (String(values[i][COL_MATRICOLA - 1]) === String(matricola)) return i + 1;
  }
  return -1;
}

// ------------------------------------------------------------
// doGet / doPost
// ------------------------------------------------------------
function doGet(e) {
  return corsResponse({ status: "ok", message: "QuizForge Apps Script v2 attivo", version: VERSION });
}

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);

    // ----------------------------------------------------------------
    // getConfig — legge gli ID dei fogli attivi (admin)
    // ----------------------------------------------------------------
    if (data.action === "getConfig") {
      if (data.password !== getAdminPassword()) {
        return corsResponse({ status: "error", message: "Password errata" });
      }
      const qId  = getSheetQuestionsId();
      const rId  = getSheetResultsId();
      const fId  = getDriveFolderId();
      const scriptEditorUrl = PropertiesService.getScriptProperties().getProperty("SCRIPT_EDITOR_URL") || "";
      return corsResponse({
        status: "ok",
        questions_id:      qId,
        results_id:        rId,
        folder_id:         fId,
        questions_url:     "https://docs.google.com/spreadsheets/d/" + qId + "/edit",
        results_url:       "https://docs.google.com/spreadsheets/d/" + rId + "/edit",
        folder_url:        "https://drive.google.com/drive/folders/" + fId,
        script_editor_url: scriptEditorUrl
      });
    }

    // ----------------------------------------------------------------
    // setConfig — aggiorna gli ID dei fogli in ScriptProperties (admin)
    // ----------------------------------------------------------------
    if (data.action === "setConfig") {
      if (data.password !== getAdminPassword()) {
        return corsResponse({ status: "error", message: "Password errata" });
      }
      const props = PropertiesService.getScriptProperties();
      // Stringa vuota = ripristina il default hardcoded
      if (data.questions_id !== undefined) {
        data.questions_id ? props.setProperty("SHEET_QUESTIONS_ID", data.questions_id)
                          : props.deleteProperty("SHEET_QUESTIONS_ID");
      }
      if (data.results_id !== undefined) {
        data.results_id ? props.setProperty("SHEET_RESULTS_ID", data.results_id)
                        : props.deleteProperty("SHEET_RESULTS_ID");
      }
      if (data.folder_id !== undefined) {
        data.folder_id ? props.setProperty("DRIVE_FOLDER_ID", data.folder_id)
                       : props.deleteProperty("DRIVE_FOLDER_ID");
      }
      if (data.script_editor_url !== undefined) {
        data.script_editor_url ? props.setProperty("SCRIPT_EDITOR_URL", data.script_editor_url)
                               : props.deleteProperty("SCRIPT_EDITOR_URL");
      }
      return corsResponse({ status: "ok" });
    }

    // ----------------------------------------------------------------
    // listDriveFolder — elenco spreadsheet nella cartella Drive configurata
    // ----------------------------------------------------------------
    if (data.action === "listDriveFolder") {
      if (data.password !== getAdminPassword()) {
        return corsResponse({ status: "error", message: "Password errata" });
      }
      const folderId = data.folder_id || getDriveFolderId();
      try {
        const folder = DriveApp.getFolderById(folderId);
        const iter   = folder.getFilesByType(MimeType.GOOGLE_SHEETS);
        const list   = [];
        while (iter.hasNext()) {
          const f = iter.next();
          list.push({
            id:   f.getId(),
            name: f.getName(),
            url:  "https://docs.google.com/spreadsheets/d/" + f.getId() + "/edit"
          });
        }
        list.sort((a, b) => a.name.localeCompare(b.name));
        return corsResponse({ status: "ok", files: list });
      } catch(e) {
        return corsResponse({ status: "error", message: "Cartella non accessibile: " + e.message });
      }
    }

    // ----------------------------------------------------------------
    // createSheet — crea un nuovo foglio nella cartella Drive e lo inizializza
    // sheet_type: "questions" | "results"
    // ----------------------------------------------------------------
    if (data.action === "createSheet") {
      if (data.password !== getAdminPassword()) {
        return corsResponse({ status: "error", message: "Password errata" });
      }
      const folderId  = data.folder_id || getDriveFolderId();
      const sheetName = String(data.name || "Nuovo foglio").trim();
      const type      = data.sheet_type; // "questions" | "results"
      try {
        const folder = DriveApp.getFolderById(folderId);
        const ss     = SpreadsheetApp.create(sheetName);
        const file   = DriveApp.getFileById(ss.getId());
        // Sposta nella cartella e rimuovi da My Drive
        folder.addFile(file);
        DriveApp.getRootFolder().removeFile(file);

        if (type === "questions") {
          const qs = ss.getSheets()[0];
          qs.setName("questions");
          qs.appendRow(["ID","Corso","Categoria","Sottocategoria","Tags","Stato","Tipo","Testo","Opzioni","Corretta","Punti","Placeholder","Data"]);
          const tr = ss.insertSheet("tracce");
          tr.appendRow(["ID","Nome","Data","Durata","Corso","Modalità","Stato","Items","Password"]);
        } else if (type === "results") {
          const cfg = ss.getSheets()[0];
          cfg.setName("_config");
          cfg.appendRow(["Chiave", "Valore"]);               // riga header (getAdminPassword parte da i=1)
          cfg.appendRow(["admin_password", getAdminPassword()]);
          cfg.getRange(1, 1, 1, 2).setFontWeight("bold");
          cfg.setFrozenRows(1);
          ss.insertSheet("_meta");
        }

        const id = ss.getId();
        return corsResponse({
          status: "ok",
          id:   id,
          name: sheetName,
          url:  "https://docs.google.com/spreadsheets/d/" + id + "/edit"
        });
      } catch(e) {
        return corsResponse({ status: "error", message: "Errore creazione foglio: " + e.message });
      }
    }

    // ----------------------------------------------------------------
    // getTrack — carica traccia + domande risolte
    // ----------------------------------------------------------------
    if (data.action === "getTrack") {
      const tracciaId = data.examId;
      if (!tracciaId) return corsResponse({ status: "error", message: "examId mancante" });

      const resolved = resolveTraccia(tracciaId);
      if (!resolved) return corsResponse({ status: "error", message: "Traccia non trovata: " + tracciaId });

      // Assicura che la traccia esista anche nel foglio risultati
      ensureMetaTrack(resolved.track);

      // password_required: bool (mai la password in chiaro al client)
      const pwdRequired = !!(resolved.track._password);
      delete resolved.track._password;
      resolved.track.password_required = pwdRequired;
      return corsResponse({ status: "ok", ...resolved });
    }

    // ----------------------------------------------------------------
    // verifyTrackPassword — verifica password d'accesso traccia
    // ----------------------------------------------------------------
    if (data.action === "verifyTrackPassword") {
      const tracciaId = data.examId;
      if (!tracciaId) return corsResponse({ status: "error", message: "examId mancante" });
      const traccia = readTraccia(tracciaId);
      if (!traccia) return corsResponse({ status: "error", message: "Traccia non trovata" });
      if (!traccia.password || traccia.modalita === "practice") return corsResponse({ status: "ok" });
      if (String(data.password || "").trim() === traccia.password) return corsResponse({ status: "ok" });
      return corsResponse({ status: "error", message: "Password errata" });
    }

    // ----------------------------------------------------------------
    // getQuestions — restituisce tutte le domande per l'admin
    // ----------------------------------------------------------------
    if (data.action === "getQuestions") {
      if (data.password !== getAdminPassword()) {
        return corsResponse({ status: "error", message: "Password errata" });
      }
      const allQ = loadAllQuestions();
      return corsResponse({ status: "ok", questions: Object.values(allQ) });
    }

    // ----------------------------------------------------------------
    // createTrack — crea nuova traccia nel foglio tracce
    // ----------------------------------------------------------------
    if (data.action === "createTrack") {
      if (data.password !== getAdminPassword()) {
        return corsResponse({ status: "error", message: "Password errata" });
      }
      const sheet = getTracceSheet();
      // Genera track ID: YYYY-MM-DD-xxxxxx
      const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
      let suffix = "";
      for (let i = 0; i < 6; i++) suffix += chars[Math.floor(Math.random() * chars.length)];
      const trackId = (data.exam_date || Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd")) + "-" + suffix;
      sheet.appendRow([
        trackId,
        data.corso     || "",
        data.exam_name || "",
        data.exam_date || "",
        data.duration  || 90,
        data.mode      || "exam",
        "closed",
        JSON.stringify(data.items || []),
        data.track_password || ""
      ]);
      return corsResponse({ status: "ok", track_id: trackId });
    }

    // ----------------------------------------------------------------
    // getAllTracks — per admin
    // ----------------------------------------------------------------
    if (data.action === "getAllTracks") {
      if (data.password !== getAdminPassword()) {
        return corsResponse({ status: "error", message: "Password errata" });
      }
      const sheet  = getTracceSheet();
      const tz     = Session.getScriptTimeZone();
      const values = sheet.getDataRange().getValues();
      const tracks = [];
      for (let i = 1; i < values.length; i++) {
        const row = values[i];
        const id  = String(row[T_ID]).trim();
        if (!id || id === "TracciaID") continue;  // salta header e righe vuote
        const rawDate = row[T_DATA];
        let dataStr = rawDate instanceof Date && !isNaN(rawDate)
          ? Utilities.formatDate(rawDate, tz, "yyyy-MM-dd") : String(rawDate);
        let items = [];
        try { items = JSON.parse(String(row[T_ITEMS] || "") || "[]"); } catch(e) {}
        tracks.push({
          exam_id:   id,
          exam_name: String(row[T_NOME]),
          corso:     String(row[T_CORSO]),
          exam_date: dataStr,
          duration:  String(row[T_DURATA]),
          mode:      String(row[T_MODALITA]) || "exam",
          status:    String(row[T_STATO])    || "closed",
          password:  String(row[T_PASSWORD] || "").trim(),
          items
        });
      }
      return corsResponse({ status: "ok", tracks, version: VERSION });
    }

    // ----------------------------------------------------------------
    // setTrack — aggiorna attributi traccia (admin)
    // ----------------------------------------------------------------
    if (data.action === "setTrack") {
      if (data.password !== getAdminPassword()) {
        return corsResponse({ status: "error", message: "Password errata" });
      }
      const sheet  = getTracceSheet();
      const values = sheet.getDataRange().getValues();
      for (let i = 1; i < values.length; i++) {
        if (String(values[i][T_ID]).trim() !== data.examId) continue;
        const row = i + 1;
        if (data.corso     !== undefined) sheet.getRange(row, T_CORSO + 1).setValue(data.corso);
        if (data.exam_name !== undefined) sheet.getRange(row, T_NOME + 1).setValue(data.exam_name);
        if (data.exam_date !== undefined) sheet.getRange(row, T_DATA + 1).setValue(data.exam_date);
        if (data.duration  !== undefined) sheet.getRange(row, T_DURATA + 1).setValue(data.duration);
        if (data.mode      !== undefined) sheet.getRange(row, T_MODALITA + 1).setValue(data.mode);
        if (data.status         !== undefined) sheet.getRange(row, T_STATO    + 1).setValue(data.status);
        if (data.items          !== undefined) sheet.getRange(row, T_ITEMS    + 1).setValue(JSON.stringify(data.items));
        if (data.track_password !== undefined) sheet.getRange(row, T_PASSWORD + 1).setValue(data.track_password);

        // Sincronizza anche _meta nel foglio risultati
        const meta   = getMetaSheet();
        const mvals  = meta.getDataRange().getValues();
        for (let j = 1; j < mvals.length; j++) {
          if (String(mvals[j][META_COLS.exam_id]) !== data.examId) continue;
          const mrow = j + 1;
          if (data.exam_name !== undefined) meta.getRange(mrow, META_COLS.exam_name + 1).setValue(data.exam_name);
          if (data.exam_date !== undefined) meta.getRange(mrow, META_COLS.exam_date + 1).setValue(data.exam_date);
          if (data.duration  !== undefined) meta.getRange(mrow, META_COLS.duration  + 1).setValue(data.duration);
          if (data.mode      !== undefined) meta.getRange(mrow, META_COLS.mode      + 1).setValue(data.mode);
          if (data.status    !== undefined) meta.getRange(mrow, META_COLS.status    + 1).setValue(data.status);
          break;
        }
        return corsResponse({ status: "ok" });
      }
      return corsResponse({ status: "error", message: "Traccia non trovata: " + data.examId });
    }

    // ----------------------------------------------------------------
    // getMonitor — studenti di una traccia (admin)
    // ----------------------------------------------------------------
    if (data.action === "getMonitor") {
      if (data.password !== getAdminPassword()) {
        return corsResponse({ status: "error", message: "Password errata" });
      }
      const examId  = data.examId;
      const traccia = readTraccia(examId);
      const nQ      = traccia ? traccia.items.length : 20;
      const ss      = SpreadsheetApp.openById(getSheetResultsId());
      const sheet   = ss.getSheetByName(examId);
      if (!sheet) return corsResponse({ status: "ok", rows: [], track: readMetaTrack(examId) });

      const values = sheet.getDataRange().getValues();
      const rows   = [];
      for (let i = 1; i < values.length; i++) {
        const row = values[i];
        const qids = String(row[COL_QIDS - 1] || "");
        const rowNQ = qids ? qids.split(",").filter(x => x.trim()).length : nQ;
        let answered = 0;
        for (let q = 0; q < rowNQ; q++) {
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
      return corsResponse({ status: "ok", rows, track: readMetaTrack(examId) });
    }

    // ----------------------------------------------------------------
    // getResults — punteggi per domanda (admin)
    // ----------------------------------------------------------------
    if (data.action === "getResults") {
      if (data.password !== getAdminPassword()) {
        return corsResponse({ status: "error", message: "Password errata" });
      }
      const examId  = data.examId;
      const traccia = readTraccia(examId);
      const nQ      = traccia ? traccia.items.length : 20;
      const ss      = SpreadsheetApp.openById(getSheetResultsId());
      const sheet   = ss.getSheetByName(examId);
      if (!sheet) return corsResponse({ status: "ok", rows: [], track: readMetaTrack(examId) });

      const values = sheet.getDataRange().getValues();
      const rows   = [];
      for (let i = 1; i < values.length; i++) {
        const row = values[i];
        if (row[COL_TS_END - 1] === "") continue;
        const qids = String(row[COL_QIDS - 1] || "");
        const rowNQ = qids ? qids.split(",").filter(x => x.trim()).length : nQ;
        const pts = [];
        for (let q = 0; q < rowNQ; q++) {
          pts.push(Number(row[COL_ANS_FIRST - 1 + q * 2 + 1]) || 0);
        }
        rows.push({
          matricola:  row[COL_MATRICOLA - 1],
          nominativo: row[COL_NOMINATIVO - 1],
          score:      row[COL_SCORE - 1],
          pts
        });
      }
      return corsResponse({ status: "ok", rows, track: readMetaTrack(examId) });
    }

    // ----------------------------------------------------------------
    // addQuestion — aggiunge domanda al repository con UUID generato
    // ----------------------------------------------------------------
    if (data.action === "addQuestion") {
      if (data.password !== getAdminPassword()) {
        return corsResponse({ status: "error", message: "Password errata" });
      }
      const sheet  = getQuestionsSheet();
      const allQ   = loadAllQuestions();

      // Genera UUID unico
      let newId;
      do { newId = generateQuestionId(); } while (allQ[newId]);

      sheet.appendRow([
        newId,                   // A  ID
        data.corso       || "",  // B  Corso
        data.categoria   || "",  // C  Categoria
        data.sottocateg  || "",  // D  Sottocategoria
        data.tags        || "",       // E  Tags
        data.stato       || "bozza", // F  Stato
        data.tipo        || "mc",    // G  Tipo
        data.testo       || "",  // H  Testo
        JSON.stringify(data.options || []), // I  Opzioni (JSON array)
        data.corretta    || "A",            // J  Corretta
        data.punti       || 1,              // K  Punti
        data.placeholder || "",            // L  Placeholder
        data.data        || ""             // M  Data JSON
      ]);
      return corsResponse({ status: "ok", id: newId });
    }

    // ----------------------------------------------------------------
    // setQuestionStato — aggiorna solo lo stato bozza/verificato
    // ----------------------------------------------------------------
    if (data.action === "setQuestionStato") {
      if (data.password !== getAdminPassword()) {
        return corsResponse({ status: "error", message: "Password errata" });
      }
      const qId    = data.id;
      const stato  = data.stato === "bozza" ? "bozza" : "verificato";
      const sheet  = getQuestionsSheet();
      const values = sheet.getDataRange().getValues();
      for (let i = 1; i < values.length; i++) {
        if (String(values[i][Q_ID]).trim() === qId) {
          sheet.getRange(i + 1, Q_STATO + 1).setValue(stato);
          return corsResponse({ status: "ok", id: qId, stato });
        }
      }
      return corsResponse({ status: "error", message: "Domanda non trovata: " + qId });
    }

    // ----------------------------------------------------------------
    // abandon — cancella la riga dello studente dal foglio risultati
    // ----------------------------------------------------------------
    if (data.action === "abandon") {
      const examId = data.examId;
      if (!examId || !data.matricola) return corsResponse({ status: "error", message: "Parametri mancanti" });
      const ss    = SpreadsheetApp.openById(getSheetResultsId());
      const sheet = ss.getSheetByName(examId);
      if (sheet) {
        const rowIndex = findRow(sheet, data.matricola);
        if (rowIndex !== -1) sheet.deleteRow(rowIndex);
      }
      return corsResponse({ status: "ok" });
    }

    // ----------------------------------------------------------------
    // Quiz actions: init, update, finalize
    // ----------------------------------------------------------------
    const examId = data.examId;
    if (!examId) return corsResponse({ status: "error", message: "examId mancante" });

    const resolved = resolveTraccia(examId);
    if (!resolved) return corsResponse({ status: "error", message: "Traccia non trovata: " + examId });

    const track    = resolved.track;
    const nQ       = resolved.n_questions;
    const totalPts = resolved.total_pts;

    if (track.mode !== "practice" && track.status === "closed" && data.action === "init") {
      return corsResponse({ status: "error", message: "Esame non disponibile" });
    }

    const sheet = getResultSheet(examId, nQ);

    // ---- RESET PRACTICE ----
    if (data.action === "resetPractice") {
      if (track.mode !== "practice") {
        return corsResponse({ status: "error", message: "Azione disponibile solo in modalità esercitazione" });
      }
      const rowIndex = findRow(sheet, data.matricola);
      if (rowIndex !== -1) sheet.deleteRow(rowIndex);
      const row = [String(data.matricola), data.nominativo || "", data.email || "",
                   "", totalPts, formatTs(new Date().toISOString()), "", "",
                   data.questionIds ? data.questionIds.join(",") : ""];
      for (let i = 0; i < nQ; i++) { row.push(""); row.push(""); }
      sheet.appendRow(row);
      sheet.getRange(sheet.getLastRow(), COL_MATRICOLA).setNumberFormat("@");
      return corsResponse({ status: "ok" });
    }

    // ---- INIT ----
    if (data.action === "init") {
      const values = sheet.getDataRange().getValues();
      for (let i = 1; i < values.length; i++) {
        if (String(values[i][COL_MATRICOLA - 1]) === String(data.matricola)) {
          return corsResponse({ status: "duplicate", finalized: values[i][COL_TS_END - 1] !== "" });
        }
      }
      // Colonne fisse: Matricola, Nominativo, Email, Score, Totale, Inizio, Fine, Durata, QIDs
      const row = [String(data.matricola), data.nominativo || "", data.email || "",
                   "", totalPts, formatTs(new Date().toISOString()), "", "",
                   data.questionIds ? data.questionIds.join(",") : ""];
      for (let i = 0; i < nQ; i++) { row.push(""); row.push(""); }
      sheet.appendRow(row);
      sheet.getRange(sheet.getLastRow(), COL_MATRICOLA).setNumberFormat("@");
      return corsResponse({ status: "ok" });
    }

    // ---- UPDATE ----
    if (data.action === "update") {
      const rowIndex = findRow(sheet, data.matricola);
      if (rowIndex === -1) return corsResponse({ status: "error", message: "Matricola non trovata" });
      const qIdx = parseInt(data.qIndex, 10);
      const col  = COL_ANS_FIRST + (qIdx - 1) * 2;
      sheet.getRange(rowIndex, col).setValue(data.ans || "");
      sheet.getRange(rowIndex, col + 1).setValue(data.pts !== undefined ? data.pts : "");
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
