// ============================================================
// QuizForge — Google Apps Script v2
// Architettura: repository domande separato dai risultati
// ============================================================
// Distribuisci come App Web:
//   - Esegui come: Me (franapoli@gmail.com)
//   - Chi può accedere: Chiunque
//
// VINCOLO: questo file deve restare caricabile anche in un browser. La preview dell'admin
// (quiz_v2.html?preview) lo scarica dal sito e ne usa buildQuestionObj e scoreAnswer, così
// la prova di una domanda la prepara e la corregge esattamente come l'esame. Quindi a livello
// di file solo costanti e funzioni: nessuna chiamata ad API Google (SpreadsheetApp,
// PropertiesService, ...) fuori dal corpo di una funzione.
// ============================================================

const VERSION = "3.3.0"; // aggiornare ad ogni deploy

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
const Q_TIPO          = 6;  // G  "mc" | "multi-mc" | "fitb" | "match" | "free" | "multi-fitb" | "cloze"
const Q_TESTO         = 7;  // H
const Q_OPTIONS       = 8;  // I  JSON array di opzioni (mc/match); vuoto per fitb/free/cloze/multi-fitb
const Q_CORRETTA      = 9;  // J  lettera A-Z (mc), testo esatto (fitb), JSON array destra (match)
const Q_PUNTI         = 10; // K
const Q_PLACEHOLDER   = 11; // L  solo per fitb
const Q_DATA          = 12; // M  JSON per tipi complessi (multi-fitb, cloze)

// Tracce sheet — solo template domande, riutilizzabili (3 colonne)
const T_ID    = 0;  // A  track_id (t-<6char>)
const T_NOME  = 1;  // B  nome traccia
const T_ITEMS = 2;  // C  JSON array items

// Esami sheet — sessioni d'esame contestualizzate (9 colonne)
const E_ID       = 0;  // A  exam_id (YYYY-MM-DD-<6char>)
const E_TRACCIA  = 1;  // B  traccia_id
const E_NOME     = 2;  // C  nome esame (se vuoto usa nome traccia)
const E_DATA     = 3;  // D  data YYYY-MM-DD
const E_DURATA   = 4;  // E  durata minuti
const E_CORSO    = 5;  // F  nome corso
const E_MODALITA = 6;  // G  "exam" | "practice"
const E_STATO    = 7;  // H  "open" | "closed"
const E_PASSWORD = 8;  // I  password accesso (solo exam; vuota = nessuna)
const E_SHUFFLE  = 9;  // J  "no" = shuffle disabilitato; vuoto/"si" = abilitato (default)

// Colonne foglio "Esami" nel foglio risultati (specchio di esami) — 0-based
const META_COLS = {
  exam_id:    0,  // A
  traccia_id: 1,  // B
  // col 2 (C) riservata (era exam_name, non più usata)
  exam_date:  3,  // D
  duration:   4,  // E
  corso:      5,  // F
  mode:       6,  // G
  status:     7,  // H
  created:    8   // I
};

// ------------------------------------------------------------
// Utilità
// ------------------------------------------------------------

// QIDs colonna 9: formato "q1:2,q2:1,q3:3;seed=12345"
// Il suffisso ":punti" è opzionale — assente nei dati precedenti alla v2.24.
// Il seed è opzionale — assente nei dati precedenti alla v2.23.
function parseQIds(raw) {
  return String(raw || "").split(";")[0].split(",").map(s => s.trim().split(":")[0]).filter(Boolean);
}
// Restituisce [{id, punti}] — punti è null se non codificato (usa il default della domanda).
function parseQIdsPunti(raw) {
  return String(raw || "").split(";")[0].split(",").map(s => {
    const parts = s.trim().split(":");
    const id = parts[0];
    const punti = parts.length > 1 ? Number(parts[1]) : null;
    return { id, punti };
  }).filter(p => p.id);
}
function parseQIdsSeed(raw) {
  const seedPart = String(raw || "").split(";").find(p => p.startsWith("seed="));
  return seedPart ? parseInt(seedPart.slice(5), 10) : null;
}

function formatTs(isoStr) {
  if (!isoStr) return "";
  try {
    const d = new Date(isoStr);
    const pad = n => String(n).padStart(2, "0");
    return pad(d.getDate()) + "/" + pad(d.getMonth()+1) + "/" + d.getFullYear()
      + " " + pad(d.getHours()) + ":" + pad(d.getMinutes()) + ":" + pad(d.getSeconds());
  } catch(e) { return isoStr; }
}

// Inverso di formatTs: "DD/MM/YYYY HH:mm:ss" → Date (o null)
function parseTs(s) {
  if (!s) return null;
  const m = String(s).match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2}):(\d{2})$/);
  if (!m) { const d = new Date(s); return isNaN(d) ? null : d; }
  return new Date(+m[3], +m[2] - 1, +m[1], +m[4], +m[5], +m[6]);
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

// Parsa Q_CORRETTA per multi-mc: accetta sia JSON array ["A","C"] sia CSV "A,C,D"
function parseMultiCorretta(corretta) {
  const s = String(corretta || "").trim();
  if (!s) return [];
  try {
    const parsed = JSON.parse(s);
    if (Array.isArray(parsed)) return parsed.map(String);
  } catch(e) {}
  return s.split(",").map(x => x.trim()).filter(Boolean);
}

// ---- IMMAGINI ----
// Nel testo di una domanda, [img:X] inserisce un'immagine dal Drive. X è l'ID del file
// oppure il suo link di condivisione. Le immagini restano private: le legge lo script
// (che gira come proprietario) e le restituisce in base64 solo tramite getImages.
// extractDriveId è duplicata identica in quiz_v2.html e admin_v2.html.
const IMG_PLACEHOLDER_RE = /\[img:([^\]\s]+)\]/g;
const IMG_MAX_BYTES      = 1500000;
const IMG_CACHE_TTL      = 3600;
const IMG_CACHE_CHUNK    = 90000;   // CacheService accetta al massimo 100KB per valore

function extractDriveId(ref) {
  const s = String(ref || "").split("|")[0].trim();   // "|400" dopo l'ID è la larghezza (imageWidth)
  const m = s.match(/\/d\/([A-Za-z0-9_-]{10,})/) || s.match(/[?&;]id=([A-Za-z0-9_-]{10,})/);
  if (m) return m[1];
  return /^[A-Za-z0-9_-]{10,}$/.test(s) ? s : null;
}

// Larghezza in pixel da [img:ID|400], o null se non indicata (l'immagine resta entro la colonna)
function imageWidth(ref) {
  const w = String(ref || "").split("|")[1];
  return w && /^\s*\d{1,4}\s*$/.test(w) ? parseInt(w, 10) : null;
}

function imageIdsInText(text) {
  const ids = [];
  String(text || "").replace(IMG_PLACEHOLDER_RE, (_, ref) => {
    const id = extractDriveId(ref);
    if (id && ids.indexOf(id) === -1) ids.push(id);
    return "";
  });
  return ids;
}

function cachePutChunked(cache, key, str) {
  const n = Math.ceil(str.length / IMG_CACHE_CHUNK);
  const map = {};
  map[key + ":n"] = String(n);
  for (let i = 0; i < n; i++) map[key + ":" + i] = str.substr(i * IMG_CACHE_CHUNK, IMG_CACHE_CHUNK);
  try { cache.putAll(map, IMG_CACHE_TTL); } catch(e) {}
}

function cacheGetChunked(cache, key) {
  const n = parseInt(cache.get(key + ":n"), 10);
  if (!n) return null;
  const keys = [];
  for (let i = 0; i < n; i++) keys.push(key + ":" + i);
  const got = cache.getAll(keys);
  let s = "";
  for (let i = 0; i < keys.length; i++) {
    if (got[keys[i]] == null) return null;
    s += got[keys[i]];
  }
  return s;
}

// Restituisce { id: dataURI | {error, ...} }. Gli errori dicono all'admin cosa correggere:
// not_found (ID errato o file non accessibile), not_image {mime}, too_large {size, max}.
// Tipo e dimensione si controllano prima di scaricare, così un file enorme non viene letto.
// Gli errori non vanno in cache: il file potrebbe essere corretto subito dopo.
// La cache evita che trenta studenti che iniziano insieme rileggano gli stessi file dal Drive.
function loadImagesData(ids) {
  const cache = CacheService.getScriptCache();
  const out = {};
  ids.forEach(id => {
    const cached = cacheGetChunked(cache, "img:" + id);
    if (cached) { out[id] = cached; return; }
    let file;
    try { file = DriveApp.getFileById(id); } catch(e) { out[id] = { error: "not_found" }; return; }
    try {
      const mime = String(file.getMimeType() || "");
      if (mime.indexOf("image/") !== 0) { out[id] = { error: "not_image", mime: mime }; return; }
      const size = file.getSize();
      if (size > IMG_MAX_BYTES) { out[id] = { error: "too_large", size: size, max: IMG_MAX_BYTES }; return; }
      const uri = "data:" + mime + ";base64," + Utilities.base64Encode(file.getBlob().getBytes());
      cachePutChunked(cache, "img:" + id, uri);
      out[id] = uri;
    } catch(e) { out[id] = { error: "not_found" }; }
  });
  return out;
}

// Le immagini caricate dall'editor vanno in questa sottocartella della cartella QuizForge
const IMG_FOLDER_NAME = "QuizForge immagini";

function getImagesFolder(create) {
  const root = DriveApp.getFolderById(getDriveFolderId());
  const it = root.getFoldersByName(IMG_FOLDER_NAME);
  if (it.hasNext()) return it.next();
  return create ? root.createFolder(IMG_FOLDER_NAME) : null;
}

// L'albero della cartella QuizForge è l'unica parte del Drive che l'admin può sfogliare, in cui può
// creare cartelle e caricare, e da cui getImagesAdmin serve file non ancora citati in una domanda.
// Lo script ha accesso a tutto il Drive del proprietario, e l'admin è protetto da una password
// condivisa: senza questo confine basterebbe quella per vedere la struttura dell'intero Drive.
const DRIVE_TREE_MAX_DEPTH = 20;

// Percorso dalla radice QuizForge alla cartella, [{id, name}, …], o null se è fuori dall'albero
function folderPathInTree(folder) {
  const rootId = getDriveFolderId();
  const path = [];
  let f = folder;
  for (let d = 0; f && d < DRIVE_TREE_MAX_DEPTH; d++) {
    path.unshift({ id: f.getId(), name: f.getName() });
    if (f.getId() === rootId) return path;
    const parents = f.getParents();
    f = parents.hasNext() ? parents.next() : null;
  }
  return null;
}

function folderInTree(folderId) {
  try { return folderPathInTree(DriveApp.getFolderById(folderId)) !== null; } catch(e) { return false; }
}

function fileInTree(fileId) {
  try {
    const parents = DriveApp.getFileById(fileId).getParents();
    while (parents.hasNext()) if (folderPathInTree(parents.next())) return true;
  } catch(e) {}
  return false;
}

// Allo studente basta sapere che l'immagine manca: il dettaglio serve solo all'admin.
function imagesForStudent(images) {
  const out = {};
  Object.keys(images).forEach(id => { out[id] = typeof images[id] === "string" ? images[id] : null; });
  return out;
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
    const headers = ["TracciaID", "Nome", "Items"];
    sheet.appendRow(headers);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold");
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function getEsamiSheet() {
  const ss = SpreadsheetApp.openById(getSheetQuestionsId());
  let sheet = ss.getSheetByName("esami");
  if (!sheet) {
    sheet = ss.insertSheet("esami");
    const headers = ["EsameID", "TracciaID", "Nome", "Data", "Durata (min)", "Corso", "Modalità", "Stato", "Password", "Shuffle"];
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
    const id = String(values[i][Q_ID]).trim();
    if (!id) continue;
    map[id] = rowToQuestion(values[i]);
  }
  return map;
}

// Una riga del foglio domande come oggetto. Unica fonte della forma: la usano la lettura,
// il controllo di concorrenza di updateQuestion e la risposta dei salvataggi.
function rowToQuestion(row) {
  return {
    id:           String(row[Q_ID]).trim(),
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

// ---- SCRITTURA DOMANDE (editor admin) ----
const TIPI_DOMANDA = ["mc", "multi-mc", "fitb", "free", "match", "multi-fitb", "cloze"];

// Confronto di concorrenza: tutti i campi salvati tranne l'ID
function questionFingerprint(q) {
  q = q || {};
  return JSON.stringify([q.corso, q.categoria, q.sottocateg, q.tags, q.stato, q.tipo, q.testo,
                         q.options, q.corretta, Number(q.punti), q.placeholder, q.data]);
}

// Porta la domanda inviata dal client alla forma canonica del foglio
function normalizeIncomingQuestion(d) {
  d = d || {};
  const s = v => (v === null || v === undefined) ? "" : String(v);
  const q = {
    corso:       s(d.corso),
    categoria:   s(d.categoria).trim(),
    sottocateg:  s(d.sottocateg).trim(),
    tags:        s(d.tags).split(",").map(t => t.trim()).filter(Boolean).join(","),
    stato:       d.stato === "bozza" ? "bozza" : "verificato",
    tipo:        s(d.tipo).trim(),
    testo:       s(d.testo).trim(),
    options:     Array.isArray(d.options) ? d.options.map(o => s(o).trim()) : [],
    corretta:    s(d.corretta).trim(),
    punti:       Number(d.punti),
    placeholder: s(d.placeholder).trim(),
    data:        s(d.data).trim()
  };
  if (q.tipo === "mc") q.corretta = q.corretta.toUpperCase();
  if (q.tipo === "multi-mc") {
    const set = {};
    parseMultiCorretta(q.corretta).forEach(l => set[String(l).trim().toUpperCase()] = true);
    q.corretta = Object.keys(set).sort().join(",");
  }
  return q;
}

// Stesse regole di validateQuestionAdmin in admin_v2.html (lì servono per gli errori in diretta).
// Blocca solo ciò che rende la domanda illeggibile; i problemi di contenuto di match,
// multi-fitb e cloze sono avvisi di lintQuestion.
function validateQuestion(q) {
  const err = [];
  if (TIPI_DOMANDA.indexOf(q.tipo) === -1) { err.push("Tipo non valido: " + q.tipo); return err; }
  if (!q.testo) err.push("Il testo è vuoto.");
  if (!isFinite(q.punti) || q.punti <= 0) err.push("I punti devono essere un numero maggiore di zero.");
  const c = canonicalForm(q);
  if (c.tipo === "mc" || c.tipo === "multi-mc") {
    if (c.options.length < 2) err.push("Servono almeno due opzioni: scrivile nel testo, una per riga, come [[opzione]].");
    if (c.options.length > 26) err.push("Al massimo 26 opzioni (A–Z).");
    if (c.options.some(o => !o)) err.push("Ci sono opzioni vuote.");
    const letters = c.tipo === "mc" ? (c.corretta ? [c.corretta] : []) : parseMultiCorretta(c.corretta);
    const fuori = letters.filter(l => !/^[A-Z]$/.test(l) || l.charCodeAt(0) - 65 >= c.options.length);
    if (!letters.length) err.push(c.tipo === "mc" ? "Indica la risposta corretta: un * all'inizio della voce, [[*giusta]]."
                                                   : "Indica almeno una risposta corretta: un * all'inizio della voce, [[*giusta]].");
    else if (fuori.length) err.push("Risposta corretta fuori dalle opzioni: " + fuori.join(", "));
  }
  if (c.tipo === "fitb") {
    if (!c.corretta) err.push("Indica la risposta: scrivila nel testo tra doppie quadre, [[risposta]].");
    if (textItems(q.testo).length > 1) err.push("Una risposta breve ha una sola casella: per più risposte scegli il tipo caselle multiple.");
  }
  if (c.tipo === "multi-fitb" || c.tipo === "cloze") {
    let d = null;
    if (!String(c.data || "").trim()) {
      err.push(c.tipo === "cloze" ? "Nessun menu: scrivili nel testo, {{[[*giusta]] [[sbagliata]]}}."
                                  : "Nessuna casella: scrivi le risposte nel testo tra doppie quadre, [[risposta]].");
    } else {
      try { d = JSON.parse(c.data); } catch(e) { err.push("Il campo dati (colonna M) non è JSON valido: " + e.message); }
      if (d !== null && (typeof d !== "object" || Array.isArray(d))) err.push("Il campo dati (colonna M) deve essere un oggetto JSON.");
    }
  }
  if (c.tipo === "match") {
    let r = null;
    try { r = JSON.parse(c.corretta || ""); } catch(e) {}
    if (!Array.isArray(r) || !c.options.length) err.push("Nessuna coppia: scrivile nel testo, una per riga, come [[sinistra => destra]].");
  }
  return err;
}

// Problemi nel contenuto delle domande (soprattutto match, multi-fitb e cloze). Avvisi, non blocchi: validateQuestion
// impedisce i salvataggi, e una domanda rotta deve restare modificabile almeno nei metadati.
// Li mostra la prova dell'admin; serviranno anche all'editor dedicato di questi tipi.
// Tutti casi che "Mostra soluzione" non può scoprire, perché soluzione e punteggio restano
// coerenti: per esempio una casella senza soluzione dà il punto a chi la lascia vuota.
function lintQuestion(q) {
  const warn = [];
  const scritta = q;               // come l'ha scritta l'autore, prima della forma interna
  q = canonicalForm(q);
  const nelTesto = scritta.tipo === "cloze" ? isTextCloze(scritta.testo) : hasItems(scritta.testo);

  // ---- errori di scrittura del formato nel testo ----
  if (nelTesto && scritta.tipo === "mc" && textItems(scritta.testo).filter(x => x.charAt(0) === "*").length > 1) {
    warn.push("Più opzioni segnate con *, ma una scelta multipla semplice ne ha una giusta sola: conta la prima. " +
              "Per più risposte giuste scegli il tipo con più risposte.");
  }
  if (nelTesto && scritta.tipo === "match") {
    textItems(scritta.testo).forEach((x, i) => {
      if (x.indexOf("=>") === -1) warn.push("La coppia " + (i + 1) + " non ha =>: scrivila come [[sinistra => destra]].");
    });
  }
  if (nelTesto && scritta.tipo === "cloze") {
    const liste = clozeLists(scritta.testo), usate = {};
    let n = 0, fuori = 0;
    mapTextSegments(scritta.testo, seg => {
      const resto = seg.replace(new RegExp(CLOZE_DECL_SRC, "g"), "").replace(new RegExp(CLOZE_MENU_SRC, "g"), (_, nome, risposta, corpo) => {
        n++;
        if (corpo !== undefined) {
          const stelle = itemsIn(corpo).filter(x => x.charAt(0) === "*").length;
          if (!stelle) warn.push("Il menu " + n + " non ha l'opzione giusta: segnala con un * all'inizio, [[*giusta]].");
          if (stelle > 1) warn.push("Il menu " + n + " ha più opzioni con *: conta la prima.");
        } else {
          usate[nome] = true;
          const pos = String(risposta).trim();
          if (!liste[nome]) warn.push("Il menu " + n + " usa la lista «" + nome + "», che non è definita: aggiungi {{" + nome + " = [[…]] [[…]]}}.");
          else if (!/^\d+$/.test(pos)) {
            warn.push("Nel menu " + n + " «" + pos + "» non è una posizione: scrivi il numero della risposta giusta nella lista «" + nome + "», come {{" + nome + ": 1}} per la prima.");
          } else if (+pos < 1 || +pos > liste[nome].length) {
            warn.push("Nel menu " + n + " la posizione " + pos + " non esiste: la lista «" + nome + "» ha " + liste[nome].length + " voci.");
          }
        }
        return "";
      });
      fuori += itemsIn(resto).length;
      if (/\{\{\d+\}\}/.test(resto)) warn.push("Il testo mescola menu scritti per esteso con segnaposto {{N}}: usa un solo modo.");
      return seg;
    });
    Object.keys(liste).forEach(nome => { if (!usate[nome]) warn.push("La lista «" + nome + "» è definita ma non viene usata."); });
    if (fuori) warn.push("Nel testo c'è [[…]] fuori da un menu: allo studente appare come ___.");
  }

  // ---- controlli sulla forma interna, qualunque sia il formato ----
  const markers = [];
  String(q.testo || "").replace(/\{\{(\d+)\}\}/g, (_, n) => { markers.push(parseInt(n, 10)); return ""; });
  const checkMarkers = (n, cosa) => {
    const fuori = markers.filter(m => m >= n);
    if (fuori.length) warn.push("Il testo usa {{" + fuori.join("}}, {{") + "}} ma ci sono solo " + n + " " + cosa + ".");
    const mancanti = [];
    for (let i = 0; i < n; i++) if (markers.indexOf(i) === -1) mancanti.push(i);
    if (mancanti.length) warn.push("Nel testo manca {{" + mancanti.join("}}, {{") + "}}.");
  };
  let d = {};
  if (q.tipo === "multi-fitb" || q.tipo === "cloze") {
    try { d = JSON.parse(q.data || "{}") || {}; } catch(e) { warn.push("Il campo dati (colonna M) non è JSON valido."); return warn; }
  }
  if (q.tipo === "multi-fitb") {
    const boxes = Array.isArray(d.boxes) ? d.boxes : [];
    if (!boxes.length) warn.push("Nessuna casella definita.");
    boxes.forEach((b, i) => {
      if (b.correct === undefined || b.correct === null || String(b.correct).trim() === "") {
        warn.push("La casella " + (i + 1) + " non ha una soluzione: prenderebbe il punto chi la lascia vuota.");
      }
    });
    if (boxes.length && boxes.every(b => boxWeight(b) === 0)) warn.push("Tutte le caselle hanno peso zero: la domanda darebbe sempre 0.");
    if (markers.length) checkMarkers(boxes.length, "caselle");
    else {
      let blanks = 0;
      mapTextSegments(scritta.testo, seg => { blanks += (seg.match(/_{3,}/g) || []).length; return seg; });
      if (blanks && boxes.length && blanks !== boxes.length) {
        warn.push("Il testo ha " + blanks + " spazi ___ ma ci sono " + boxes.length + " caselle: le caselle restano in griglia sotto il testo.");
      }
    }
  }
  if (q.tipo === "cloze") {
    const dds = Array.isArray(d.dropdowns) ? d.dropdowns : [];
    if (!dds.length) warn.push("Nessun menu a tendina definito.");
    dds.forEach((dd, i) => {
      const opts = Array.isArray(dd.options) ? dd.options : [];
      const c = dd.correct === undefined || dd.correct === null ? 0 : dd.correct;
      if (opts.length < 2) warn.push("Il menu " + (i + 1) + " ha meno di due opzioni.");
      if (nelTesto && c === -1) return;   // già segnalato sopra, nei termini del formato nel testo
      if (!Number.isInteger(c) || c < 0 || c >= opts.length) {
        warn.push("Il menu " + (i + 1) + " indica come corretta l'opzione " + c + ", ma le opzioni vanno da 0 a " + (opts.length - 1) + ".");
      }
    });
    if (!nelTesto) checkMarkers(dds.length, "menu");
  }
  if (q.tipo === "fitb" && !nelTesto) {
    // Il primo "___" diventa la casella (quiz_v2.html, splitFitbBlank); gli altri restano testo
    const blanks = String(q.testo || "").replace(/<\/?[A-Za-z!][^>]*>|\[img:[^\]]*\]/g, " ").match(/_{3,}/g) || [];
    if (blanks.length > 1) {
      warn.push("Il testo ha " + blanks.length + " spazi da completare, ma una risposta breve ha una sola casella: " +
                "solo il primo diventa la casella. Per più risposte scegli il tipo caselle multiple.");
    }
  }
  if (q.tipo === "match") {
    const left = Array.isArray(q.options) ? q.options : [];
    let right = null;
    try { right = JSON.parse(q.corretta || ""); } catch(e) {}
    if (!Array.isArray(right)) warn.push("La colonna destra (colonna J) non è un array JSON.");
    else {
      if (left.length < 2) warn.push("Servono almeno due coppie.");
      if (right.length !== left.length) warn.push("Ci sono " + left.length + " elementi a sinistra e " + right.length + " a destra.");
      const doppi = right.filter((r, i) => r && right.indexOf(r) !== i);
      if (doppi.length) warn.push("Elementi ripetuti a destra (" + doppi.join(", ") + "): più abbinamenti risultano corretti.");
    }
  }
  return warn;
}

// Sheets interpreta ciò che riceve: "1/2" diventa una data, "0012" un numero, e un testo che
// inizia con = + - @ una formula. Le colonne di testo vanno in formato testo, e l'apostrofo
// iniziale (che Sheets non memorizza nel valore) neutralizza le formule.
function sheetText(v) {
  const s = (v === null || v === undefined) ? "" : String(v);
  return /^[=+\-@]/.test(s) ? "'" + s : s;
}

function writeQuestionRow(sheet, rowIndex, q) {
  const testoCols = [q.corso, q.categoria, q.sottocateg, q.tags, q.stato, q.tipo, q.testo,
                     JSON.stringify(q.options), q.corretta].map(sheetText);     // B..J
  const r1 = sheet.getRange(rowIndex, Q_CORSO + 1, 1, testoCols.length);
  r1.setNumberFormat("@");
  r1.setValues([testoCols]);
  sheet.getRange(rowIndex, Q_PUNTI + 1).setValue(q.punti);                     // K
  const r2 = sheet.getRange(rowIndex, Q_PLACEHOLDER + 1, 1, 2);                // L..M
  r2.setNumberFormat("@");
  r2.setValues([[sheetText(q.placeholder), sheetText(q.data)]]);
}

// Legge la traccia (template domande) — solo id, nome, items
function readTraccia(tracciaId) {
  const sheet = getTracceSheet();
  const values = sheet.getDataRange().getValues();
  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    if (String(row[T_ID]).trim() !== tracciaId) continue;
    return {
      id:    String(row[T_ID]).trim(),
      nome:  String(row[T_NOME]),
      items: (function() {
        try { return JSON.parse(String(row[T_ITEMS] || "") || "[]"); } catch(e) { return []; }
      })()
    };
  }
  return null;
}

// Legge l'esame (sessione contestualizzata) dal foglio esami
function readEsame(examId) {
  const sheet  = getEsamiSheet();
  const tz     = Session.getScriptTimeZone();
  const values = sheet.getDataRange().getValues();
  for (let i = 0; i < values.length; i++) {
    const row = values[i];
    if (String(row[E_ID]).trim() !== examId) continue;
    const rawDate = row[E_DATA];
    const dataStr = rawDate instanceof Date && !isNaN(rawDate)
      ? Utilities.formatDate(rawDate, tz, "yyyy-MM-dd") : String(rawDate);
    return {
      exam_id:    String(row[E_ID]).trim(),
      traccia_id: String(row[E_TRACCIA]).trim(),
      data:       dataStr,
      durata:     String(row[E_DURATA]),
      corso:      String(row[E_CORSO]),
      modalita:   String(row[E_MODALITA]) || "exam",
      stato:      String(row[E_STATO])    || "closed",
      password:   String(row[E_PASSWORD] || "").trim(),
      shuffle:    String(row[E_SHUFFLE] || "").trim().toLowerCase() !== "no",
      rowIndex:   i + 1
    };
  }
  return null;
}

// Costruisce l'oggetto domanda pronto per il client.
// withCorrect=false (default): omette le risposte corrette — usato per getTrack (studenti).
// withCorrect=true: include le risposte corrette — usato solo internamente per scoring o admin.
// ============================================================
// FORMATO NEL TESTO
// Una domanda si può scrivere tutta nella colonna Testo, così il foglio contiene esattamente
// ciò che si legge nell'editor:
//   [[…]]                      una risposta o una voce; "*" all'inizio segna quella giusta
//   fitb        Il codone di inizio è [[AUG]].
//   multi-fitb  l'algoritmo di [[Smith-Waterman]] è locale, quello di [[Needleman-Wunsch]] …
//   mc          la domanda, poi le opzioni: [[*giusta]] [[sbagliata]] … (multi-mc: più "*")
//   match       la consegna, poi le coppie: [[Adenina => Timina]] [[Guanina => Citosina]] …
//   cloze       menu nella frase: {{[[*locali]] [[globali]]}}; liste riusabili:
//               {{basi = [[A]] [[C]] [[G]] [[T]]}} una volta, poi {{basi: 4}} dove serve
//               (posizione della risposta giusta nella lista, da 1)
// canonicalForm la riduce alla forma interna di sempre (opzioni, lettere, JSON dei dati), la
// stessa delle domande scritte nel formato vecchio con le colonne I, J e M, che continuano a
// funzionare. Chi prepara, corregge o controlla una domanda passa di qui: i segni delle
// risposte giuste non arrivano mai allo studente.
// ============================================================

// Applica fn solo al testo di una stringa HTML: non ai tag, né ai segnaposto [img:…]
// (gli ID Drive possono contenere trattini bassi). Un tag è "<" seguito da lettera, "/" o "!",
// come per il browser: "p < 0,05" è testo, e prenderlo per un tag spezzerebbe le voci [[…]].
function mapTextSegments(html, fn) {
  return String(html || "").split(/(<\/?[A-Za-z!][^>]*>|\[img:[^\]]*\])/).map((p, i) => i % 2 ? p : fn(p)).join("");
}

const ITEM_SRC = "\\[\\[([\\s\\S]*?)\\]\\]";

function hasItems(testo) {
  let found = false;
  mapTextSegments(testo, seg => { if (new RegExp(ITEM_SRC).test(seg)) found = true; return seg; });
  return found;
}

function itemsIn(s) {
  const out = [];
  String(s || "").replace(new RegExp(ITEM_SRC, "g"), (_, x) => { out.push(x.trim()); return ""; });
  return out;
}

// Le voci [[…]] del testo, esclusi tag HTML e segnaposto [img:…]
function textItems(testo) {
  const out = [];
  mapTextSegments(testo, seg => { out.push.apply(out, itemsIn(seg)); return seg; });
  return out;
}

// "*voce" → giusta
function starred(x) {
  return x.charAt(0) === "*" ? { star: true, text: x.slice(1).trim() } : { star: false, text: x };
}

// Il testo senza le voci [[…]] (per mc e match stanno in coda, una per riga): via anche gli
// a capo e i <br> rimasti in fondo
function withoutItems(testo) {
  return mapTextSegments(testo, seg => seg.replace(new RegExp(ITEM_SRC, "g"), ""))
    .replace(/(\s|<br\s*\/?>)+$/i, "").replace(/\n{3,}/g, "\n\n");
}

function canonicalChoice(q) {
  if (!hasItems(q.testo)) return q;
  const opts = textItems(q.testo).map(starred);
  const letters = opts.map((o, i) => o.star ? String.fromCharCode(65 + i) : null).filter(Boolean);
  return Object.assign({}, q, { testo: withoutItems(q.testo), options: opts.map(o => o.text),
                                corretta: q.tipo === "mc" ? (letters[0] || "") : letters.join(",") });
}

function canonicalMatch(q) {
  if (!hasItems(q.testo)) return q;
  const pairs = textItems(q.testo).map(x => {
    const k = x.indexOf("=>");
    return k === -1 ? [x.trim(), ""] : [x.slice(0, k).trim(), x.slice(k + 2).trim()];
  });
  return Object.assign({}, q, { testo: withoutItems(q.testo), options: pairs.map(p => p[0]),
                                corretta: JSON.stringify(pairs.map(p => p[1])) });
}

// La casella della fitb è il primo "___" del testo (quiz_v2.html, splitFitbBlank). Le voci in
// più diventano "___" anche loro, senza contenuto: nessuna risposta trapela.
function canonicalFitb(q) {
  if (!hasItems(q.testo)) return q;
  let first = null;
  const t = mapTextSegments(q.testo, seg => seg.replace(new RegExp(ITEM_SRC, "g"), (_, x) => {
    if (first === null) first = x.trim();
    return "___";
  }));
  return Object.assign({}, q, { testo: t, corretta: first || "" });
}

// Multi-fitb: [[risposta]] nel testo, oppure (formato vecchio) "___" tanti quante le caselle del
// campo dati, che diventano {{0}}, {{1}}, … nell'ordine.
function canonicalMultiFitb(q) {
  if (!q || q.tipo !== "multi-fitb") return q;
  const testo = String(q.testo || "");
  if (hasItems(testo)) {
    const boxes = [];
    const t = mapTextSegments(testo, seg => seg.replace(new RegExp(ITEM_SRC, "g"),
      (_, ans) => "{{" + (boxes.push({ correct: ans.trim() }) - 1) + "}}"));
    return Object.assign({}, q, { testo: t, data: JSON.stringify({ boxes: boxes }) });
  }
  if (!/\{\{\d+\}\}/.test(testo)) {
    let d;
    try { d = JSON.parse(q.data || "{}") || {}; } catch(e) { return q; }
    const n = Array.isArray(d.boxes) ? d.boxes.length : 0;
    let count = 0;
    mapTextSegments(testo, seg => { count += (seg.match(/_{3,}/g) || []).length; return seg; });
    if (n && count === n) {
      let k = 0;
      return Object.assign({}, q, { testo: mapTextSegments(testo, seg => seg.replace(/_{3,}/g, () => "{{" + (k++) + "}}")) });
    }
  }
  return q;
}

// Cloze: tre forme di {{…}}, tutte distinte dai segnaposto {{0}} della forma interna:
//   {{nome = [[a]] [[b]]}}   dichiara una lista (non viene mostrata)
//   {{nome: 4}}              menu con le voci della lista; il numero è la posizione della giusta,
//                            da 1. Una posizione e non il testo: le voci possono essere lunghe o
//                            contenere parentesi, e con voci numeriche il testo sarebbe ambiguo.
//   {{[[*a]] [[b]]}}         menu scritto per intero
const CLOZE_DECL_SRC = "\\{\\{\\s*([\\wÀ-ÿ]+)\\s*=\\s*((?:\\s*\\[\\[[\\s\\S]*?\\]\\])+)\\s*\\}\\}";
const CLOZE_MENU_SRC = "\\{\\{\\s*(?:([\\wÀ-ÿ]+)\\s*:\\s*([^{}]*?)|((?:\\s*\\[\\[[\\s\\S]*?\\]\\])+))\\s*\\}\\}";

function isTextCloze(testo) {
  return new RegExp(CLOZE_DECL_SRC).test(String(testo || "")) || new RegExp(CLOZE_MENU_SRC).test(String(testo || ""));
}

function clozeLists(testo) {
  const liste = {};
  String(testo || "").replace(new RegExp(CLOZE_DECL_SRC, "g"), (_, nome, corpo) => { liste[nome] = itemsIn(corpo); return ""; });
  return liste;
}

function canonicalCloze(q) {
  if (!q || q.tipo !== "cloze" || !isTextCloze(q.testo)) return q;
  const liste = clozeLists(q.testo);
  const dropdowns = [];
  let t = mapTextSegments(q.testo, seg => seg
    .replace(new RegExp(CLOZE_DECL_SRC, "g"), "")
    .replace(new RegExp(CLOZE_MENU_SRC, "g"), (_, nome, risposta, corpo) => {
      let dd;
      if (corpo !== undefined) {
        const o = itemsIn(corpo).map(starred);
        dd = { options: o.map(x => x.text), correct: o.findIndex(x => x.star) };
      } else {
        const opts = (liste[nome] || []).slice();
        const pos = String(risposta).trim();
        dd = { options: opts, correct: /^\d+$/.test(pos) && +pos >= 1 && +pos <= opts.length ? +pos - 1 : -1 };
      }
      return "{{" + (dropdowns.push(dd) - 1) + "}}";
    })
    // [[…]] fuori dai menu: allo studente arriverebbero in chiaro
    .replace(new RegExp(ITEM_SRC, "g"), "___"));
  t = t.replace(/^(\s|<br\s*\/?>)+/i, "");   // le dichiarazioni in cima lasciano righe vuote
  return Object.assign({}, q, { testo: t, data: JSON.stringify({ dropdowns: dropdowns }) });
}

// Forma interna di qualunque domanda. Il formato vecchio (colonne I, J, M) passa invariato.
function canonicalForm(q) {
  if (!q) return q;
  if (q.tipo === "mc" || q.tipo === "multi-mc") return canonicalChoice(q);
  if (q.tipo === "match")      return canonicalMatch(q);
  if (q.tipo === "fitb")       return canonicalFitb(q);
  if (q.tipo === "multi-fitb") return canonicalMultiFitb(q);
  if (q.tipo === "cloze")      return canonicalCloze(q);
  return q;
}

// Peso relativo di una casella multi-fitb. Il punteggio della domanda è Q_PUNTI, ripartito
// fra le caselle in proporzione ai pesi. Senza "pts" la casella pesa 1: prima pesava 0, e una
// domanda senza pesi dava sempre 0 punti anche con tutte le risposte giuste.
function boxWeight(b) {
  if (!b || b.pts === undefined || b.pts === null || b.pts === "") return 1;
  const n = Number(b.pts);
  return isFinite(n) && n > 0 ? n : 0;
}

function buildQuestionObj(q, pos, withCorrect) {
  q = canonicalForm(q);
  const obj = {
    id:   q.id,
    pos:  pos,
    pts:  q.punti,
    type: q.tipo,
    text: q.testo
  };
  if (q.tipo === "mc") {
    obj.options = q.options;
    if (withCorrect) obj.correct = letterToIndex(q.corretta);
  } else if (q.tipo === "multi-mc") {
    obj.options = q.options;
    if (withCorrect) obj.correct = parseMultiCorretta(q.corretta).map(l => letterToIndex(l));
  } else if (q.tipo === "fitb") {
    if (q.placeholder) obj.placeholder = q.placeholder;
    if (withCorrect) obj.correct = q.corretta;
  } else if (q.tipo === "match") {
    obj.left = q.options;
    try { obj.right = JSON.parse(q.corretta); } catch(e) { obj.right = []; }
    // obj.right (item della colonna destra) va sempre inviato: lo studente ne ha bisogno
    // per visualizzare la domanda. La risposta corretta sono gli INDICI in obj.correct,
    // che viene inviato solo con withCorrect=true.
    if (withCorrect) obj.correct = obj.right.slice();
  } else if (q.tipo === "free") {
    if (q.placeholder) obj.placeholder = q.placeholder;
    obj.correct = null; // free è sempre null, non rivela nulla
  } else if (q.tipo === "multi-fitb") {
    try {
      const d = JSON.parse(q.data || "{}");
      // Invia boxes senza il campo "correct" interno se non autorizzato
      obj.boxes = (d.boxes || []).map(b => withCorrect ? Object.assign({}, b, { pts: boxWeight(b) })
                                                       : { label: b.label, cols: b.cols, pts: boxWeight(b) });
      obj.cols  = d.cols || 1;
    } catch(e) { obj.boxes = []; obj.cols = 1; }
    if (withCorrect) obj.correct = obj.boxes.map(b => String(b.correct ?? "").trim());
  } else if (q.tipo === "cloze") {
    try {
      const d = JSON.parse(q.data || "{}");
      // Invia dropdowns senza il campo "correct" interno se non autorizzato
      obj.dropdowns = (d.dropdowns || []).map(dd =>
        withCorrect ? dd : { options: dd.options }
      );
    } catch(e) { obj.dropdowns = []; }
    if (withCorrect) obj.correct = obj.dropdowns.map(dd => dd.correct ?? 0);
  }
  return obj;
}

// Calcola il punteggio server-side per una singola risposta
// Normalizza una risposta testuale — IDENTICO a normalizeAnswer() in quiz_v2.html
// (rimuove TUTTI gli spazi e abbassa a minuscolo) per coerenza di scoring.
function normalizeText(s) {
  if (s === null || s === undefined) return "";
  return String(s).replace(/\s/g, "").toLowerCase();
}

// Calcola il punteggio server-side per una singola risposta.
// q è l'oggetto domanda grezzo dal repository (allQ[id]); ans è la risposta grezza dello studente.
function scoreAnswer(q, ans) {
  if (!q) return 0; // domanda inesistente → 0 (protezione contro ID iniettati)
  q = canonicalForm(q);
  if (q.tipo === "mc") {
    const correct = letterToIndex(q.corretta);
    return (parseInt(ans, 10) === correct) ? q.punti : 0;
  }
  if (q.tipo === "multi-mc") {
    try {
      const correct = new Set(parseMultiCorretta(q.corretta).map(l => letterToIndex(l)));
      const given   = new Set((typeof ans === "string" ? JSON.parse(ans || "[]") : (ans || [])).map(x => parseInt(x, 10)));
      const n = correct.size;
      if (n === 0) return 0;
      let right = 0, wrong = 0;
      correct.forEach(i => { if (given.has(i)) right++; });
      given.forEach(i  => { if (!correct.has(i)) wrong++; });
      return Math.max(0, Math.round((right - wrong) / n * q.punti * 100) / 100);
    } catch(e) { return 0; }
  }
  if (q.tipo === "fitb") {
    return (normalizeText(ans) === normalizeText(q.corretta)) ? q.punti : 0;
  }
  if (q.tipo === "match") {
    // Il client salva un array di INDICI: given[i] = indice (in q.right) scelto per il termine sinistro i.
    // La risposta è corretta per la posizione i se right[given[i]] === right[i] (ovvero given[i] === i,
    // confrontando per valore per gestire eventuali stringhe duplicate).
    try {
      const right = JSON.parse(q.corretta);
      const given = typeof ans === "string" ? JSON.parse(ans) : ans;
      if (!Array.isArray(given)) return 0;
      let ok = 0;
      right.forEach((r, i) => {
        const chosenIdx = parseInt(given[i], 10);
        if (!isNaN(chosenIdx) && String(right[chosenIdx] ?? "").trim() === String(r).trim()) ok++;
      });
      return right.length ? Math.round((ok / right.length) * q.punti * 100) / 100 : 0;
    } catch(e) { return 0; }
  }
  if (q.tipo === "multi-fitb") {
    try {
      const d = JSON.parse(q.data || "{}");
      const boxes = d.boxes || [];
      const given = typeof ans === "string" ? JSON.parse(ans) : (ans || []);
      let earned = 0, total = 0;
      boxes.forEach((b, i) => {
        total += boxWeight(b);
        if (normalizeText(given[i]) === normalizeText(String(b.correct ?? ""))) earned += boxWeight(b);
      });
      if (total === 0) return 0;
      return Math.round((earned / total) * q.punti * 100) / 100;
    } catch(e) { return 0; }
  }
  if (q.tipo === "cloze") {
    try {
      const d = JSON.parse(q.data || "{}");
      const dropdowns = d.dropdowns || [];
      const given = typeof ans === "string" ? JSON.parse(ans) : (ans || []);
      let ok = 0;
      dropdowns.forEach((dd, i) => { if (parseInt(given[i], 10) === (dd.correct ?? 0)) ok++; });
      return dropdowns.length ? Math.round((ok / dropdowns.length) * q.punti * 100) / 100 : 0;
    } catch(e) { return 0; }
  }
  if (q.tipo === "free") return 0; // valutazione manuale
  return 0;
}

// Fisher-Yates shuffle su array (in-place)
function shuffleArray(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Risolve le domande di una traccia.
// withCorrect=false (default, per studenti): omette risposte corrette.
// withCorrect=true (solo interno, per scoring server-side): include risposte corrette.
// Restituisce { questions, effectivePuntiMap } dove effectivePuntiMap mappa qId → punti effettivi.
// Per slot fixed: item.punti ?? q.punti.
// Per slot random con item.punti: usa come filtro E come punteggio.
// Per slot random senza item.punti: inferisce dal pool (tutti uguali → quel valore; misti → massimo).
function _resolveItems(items, withCorrect) {
  const allQ            = loadAllQuestions();
  const questions       = [];
  const effectivePuntiMap = {};
  const usedIds         = new Set();
  (items || []).forEach(item => {
    if (item.type === "fixed") {
      usedIds.add(item.id);
      const q = allQ[item.id];
      if (!q) {
        questions.push({ id: item.id, error: "Domanda non trovata: " + item.id, pts: 0, type: "mc", text: "", pos: questions.length + 1 });
        return;
      }
      const ep = (item.punti !== undefined && item.punti !== null) ? item.punti : q.punti;
      effectivePuntiMap[item.id] = ep;
      const qObj = buildQuestionObj(q, questions.length + 1, withCorrect);
      qObj.pts = ep;
      questions.push(qObj);
    } else if (item.type === "random") {
      const candidates = Object.values(allQ).filter(q => {
        if (usedIds.has(q.id)) return false;
        if ((q.stato || "verificato") === "bozza") return false;
        if (item.categoria && q.categoria !== item.categoria) return false;
        if (item.sottocateg && q.sottocateg !== item.sottocateg) return false;
        if (item.tag) {
          const qTags = String(q.tags || "").split(",").map(t => t.trim());
          if (!qTags.includes(item.tag)) return false;
        }
        if (item.punti !== undefined && item.punti !== null && q.punti !== item.punti) return false;
        return true;
      });
      const picked = shuffleArray(candidates)[0];
      if (picked) {
        usedIds.add(picked.id);
        let ep;
        if (item.punti !== undefined && item.punti !== null) {
          ep = item.punti;
        } else {
          const poolPunti = candidates.map(c => Number(c.punti) || 1);
          const allSame   = poolPunti.length > 0 && poolPunti.every(p => p === poolPunti[0]);
          ep = allSame ? poolPunti[0] : Math.max(...poolPunti);
        }
        effectivePuntiMap[picked.id] = ep;
        const qObj = buildQuestionObj(picked, questions.length + 1, withCorrect);
        qObj.pts = ep;
        questions.push(qObj);
      }
    }
  });
  return { questions, effectivePuntiMap };
}

// Risolve un esame (legge esame → trova traccia → risolve domande)
function resolveEsame(examId) {
  const esame = readEsame(examId);
  if (!esame) return null;
  const traccia = readTraccia(esame.traccia_id);
  if (!traccia) return null;
  const { questions, effectivePuntiMap } = _resolveItems(traccia.items);
  return {
    track: {
      exam_id:         esame.exam_id,
      exam_date:       esame.data,
      duration:        esame.durata,
      mode:            esame.modalita,
      status:          esame.stato,
      corso:           esame.corso,
      track_name:      traccia.nome,      // nome traccia (per esercitazioni)
      traccia_id:      esame.traccia_id,  // usato internamente da ensureMetaTrack
      _password:       esame.password,    // rimosso dal doPost prima di inviare al client
      shuffle_options: esame.shuffle      // true (default) | false
    },
    questions,
    effectivePuntiMap,
    n_questions: questions.length,
    total_pts:   questions.reduce((s, q) => s + (q.pts || 0), 0)
  };
}

// Alias per compatibilità interna — usa resolveEsame
function resolveTraccia(examId) { return resolveEsame(examId); }

// ------------------------------------------------------------
// Foglio risultati (identico a v1, ma usa SHEET_RESULTS_ID)
// ------------------------------------------------------------
function getConfigSheet() {
  const ss = SpreadsheetApp.openById(getSheetResultsId());
  let cfg = ss.getSheetByName("_config");
  if (!cfg) {
    cfg = ss.insertSheet("_config");
    cfg.appendRow(["Chiave", "Valore"]);
    cfg.appendRow(["admin_password", "cambiami"]);
    cfg.getRange(1, 1, 1, 2).setFontWeight("bold");
    cfg.setFrozenRows(1);
  }
  return cfg;
}

function getAdminPassword() {
  const values = getConfigSheet().getDataRange().getValues();
  for (let i = 1; i < values.length; i++) {
    if (String(values[i][0]) === "admin_password") return String(values[i][1]);
  }
  return "";
}

// Legge extra minuti globali per un esame (scope "all")
function getExtraMinutesAll(examId) {
  const key = "extra_time:" + examId + ":all";
  const vals = getConfigSheet().getDataRange().getValues();
  for (let i = 1; i < vals.length; i++) {
    if (String(vals[i][0]) === key) return Number(vals[i][1]) || 0;
  }
  return 0;
}

// Legge extra minuti individuali per uno studente (NON include "all")
function getExtraMinutesIndividual(examId, matricola) {
  const key = "extra_time:" + examId + ":" + String(matricola);
  const vals = getConfigSheet().getDataRange().getValues();
  for (let i = 1; i < vals.length; i++) {
    if (String(vals[i][0]) === key) return Number(vals[i][1]) || 0;
  }
  return 0;
}

// Aggiunge (o sottrae) deltaMinutes per uno scope ("all" o matricola). Restituisce nuovo totale.
function addExtraMinutes(examId, scope, deltaMinutes) {
  const key = "extra_time:" + examId + ":" + scope;
  const cfg  = getConfigSheet();
  const vals = cfg.getDataRange().getValues();
  for (let i = 1; i < vals.length; i++) {
    if (String(vals[i][0]) === key) {
      const newVal = (Number(vals[i][1]) || 0) + deltaMinutes;
      cfg.getRange(i + 1, 2).setValue(newVal);
      return newVal;
    }
  }
  cfg.appendRow([key, deltaMinutes]);
  return deltaMinutes;
}

// Ripresa d'emergenza (es. blackout): interruttore globale per esame.
// Quando ON, uno studente con una riga NON consegnata può recuperare la sessione
// dal server da qualsiasi dispositivo. Va acceso/spento manualmente dal docente.
function getResumeAll(examId) {
  const key  = "resume_allowed:" + examId + ":all";
  const vals = getConfigSheet().getDataRange().getValues();
  for (let i = 1; i < vals.length; i++) {
    if (String(vals[i][0]) === key) return String(vals[i][1]).trim() === "1";
  }
  return false;
}

function setResumeAll(examId, enabled) {
  const key  = "resume_allowed:" + examId + ":all";
  const cfg  = getConfigSheet();
  const vals = cfg.getDataRange().getValues();
  for (let i = 1; i < vals.length; i++) {
    if (String(vals[i][0]) === key) {
      cfg.getRange(i + 1, 2).setValue(enabled ? "1" : "");
      return enabled;
    }
  }
  cfg.appendRow([key, enabled ? "1" : ""]);
  return enabled;
}

function getMetaSheet() {
  const ss = SpreadsheetApp.openById(getSheetResultsId());
  let meta = ss.getSheetByName("Esami");
  if (!meta) {
    // retrocompatibilità: rinomina _meta se esiste ancora
    const old = ss.getSheetByName("_meta");
    if (old) { old.setName("Esami"); meta = old; }
  }
  if (!meta) {
    meta = ss.insertSheet("Esami");
    meta.appendRow(["TracciaID", "Nome", "Data", "Durata (min)", "Modalità", "Stato", "Creata", "Foglio"]);
    meta.getRange(1, 1, 1, 8).setFontWeight("bold");
    meta.setFrozenRows(1);
  }
  return meta;
}

function readMetaTrack(examId) {
  const meta   = getMetaSheet();
  const tz     = Session.getScriptTimeZone();
  const values = meta.getDataRange().getValues();
  for (let i = 1; i < values.length; i++) {
    if (String(values[i][META_COLS.exam_id]) !== examId) continue;
    const rawDate = values[i][META_COLS.exam_date];
    const examDate = rawDate instanceof Date && !isNaN(rawDate)
      ? Utilities.formatDate(rawDate, tz, "yyyy-MM-dd") : String(rawDate);
    return {
      exam_id:    examId,
      traccia_id: String(values[i][META_COLS.traccia_id] || ""),
      exam_date:  examDate,
      duration:   String(values[i][META_COLS.duration]),
      corso:      String(values[i][META_COLS.corso] || ""),
      mode:       String(values[i][META_COLS.mode])   || "exam",
      status:     String(values[i][META_COLS.status])  || "closed",
      rowIndex:   i + 1
    };
  }
  return null;
}

function ensureMetaTrack(track) {
  if (readMetaTrack(track.exam_id)) return readMetaTrack(track.exam_id);
  // Double-check con lock per evitare righe duplicate da chiamate concorrenti
  const lock = LockService.getScriptLock();
  try { lock.waitLock(10000); } catch(e) {}
  try {
    const existing = readMetaTrack(track.exam_id);
    if (existing) return existing;
    const meta = getMetaSheet();
    const now  = formatTs(new Date().toISOString());
    meta.appendRow([
      track.exam_id,
      track.traccia_id  || "",
      "",               // col C riservata (era exam_name)
      track.exam_date,
      track.duration,
      track.corso       || "",
      track.mode        || "exam",
      track.status      || "closed",
      now
    ]);
    return readMetaTrack(track.exam_id);
  } finally {
    try { lock.releaseLock(); } catch(e) {}
  }
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
    // addExtraTime — aggiunge (o sottrae) minuti a tutti o a uno studente
    // ----------------------------------------------------------------
    if (data.action === "addExtraTime") {
      if (data.password !== getAdminPassword()) return corsResponse({ status: "error", message: "Password errata" });
      const minutes = Number(data.minutes) || 0;
      const scope   = String(data.scope || "all");   // "all" o matricola specifica
      const examId  = String(data.exam_id || "");
      if (!examId)  return corsResponse({ status: "error", message: "exam_id mancante" });
      if (minutes === 0) return corsResponse({ status: "ok", total: getExtraMinutesAll(examId), scope });
      const newTotal = addExtraMinutes(examId, scope, minutes);
      return corsResponse({ status: "ok", total: newTotal, scope, exam_id: examId });
    }

    // ----------------------------------------------------------------
    // setResumeAll — accende/spegne la ripresa d'emergenza per tutto l'esame
    // ----------------------------------------------------------------
    if (data.action === "setResumeAll") {
      if (data.password !== getAdminPassword()) return corsResponse({ status: "error", message: "Password errata" });
      const examId = String(data.exam_id || "");
      if (!examId) return corsResponse({ status: "error", message: "exam_id mancante" });
      const enabled = setResumeAll(examId, !!data.enabled);
      return corsResponse({ status: "ok", resume_all: enabled, exam_id: examId });
    }

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
      const scriptEditorUrl = "https://script.google.com/d/" + ScriptApp.getScriptId() + "/edit";
      // Legge solo il nome (metadato) — non apre il foglio intero
      let qName = ""; try { qName = DriveApp.getFileById(qId).getName(); } catch(e) {}
      let rName = ""; try { rName = DriveApp.getFileById(rId).getName(); } catch(e) {}
      return corsResponse({
        status: "ok",
        questions_id:      qId,
        questions_name:    qName,
        results_id:        rId,
        results_name:      rName,
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
          tr.appendRow(["TracciaID","Nome","Items"]);
          const es = ss.insertSheet("esami");
          es.appendRow(["EsameID","TracciaID","Nome","Data","Durata (min)","Corso","Modalità","Stato","Password"]);
        } else if (type === "results") {
          const cfg = ss.getSheets()[0];
          cfg.setName("_config");
          cfg.appendRow(["Chiave", "Valore"]);               // riga header (getAdminPassword parte da i=1)
          cfg.appendRow(["admin_password", getAdminPassword()]);
          cfg.getRange(1, 1, 1, 2).setFontWeight("bold");
          cfg.setFrozenRows(1);
          const esTab = ss.insertSheet("Esami");
          esTab.appendRow(["EsameID","TracciaID","Nome","Data","Durata (min)","Corso","Modalità","Stato","Password"]);
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
    // getPublicExams — elenco pubblico degli esami aperti (no password)
    // ----------------------------------------------------------------
    if (data.action === "getPublicExams") {
      const sheet  = getEsamiSheet();
      const tz     = Session.getScriptTimeZone();
      const values = sheet.getDataRange().getValues();
      const exams  = [];
      for (let i = 0; i < values.length; i++) {
        const row   = values[i];
        const id    = String(row[E_ID]).trim();
        const stato = String(row[E_STATO]).trim();
        if (!id || id === "EsameID") continue;
        if (stato !== "open") continue;
        const rawDate = row[E_DATA];
        const dataStr = rawDate instanceof Date && !isNaN(rawDate)
          ? Utilities.formatDate(rawDate, tz, "yyyy-MM-dd") : String(rawDate);
        const modalita   = String(row[E_MODALITA]).trim() || "exam";
        const traccia_id = String(row[E_TRACCIA]).trim();
        let track_name   = "";
        if (modalita === "practice" && traccia_id) {
          const tr = readTraccia(traccia_id);
          if (tr) track_name = tr.nome || "";
        }
        exams.push({
          exam_id:    id,
          corso:      String(row[E_CORSO]).trim(),
          data:       dataStr,
          durata:     Number(row[E_DURATA]) || 0,
          modalita:   modalita,
          traccia_id: traccia_id,
          track_name: track_name
        });
      }
      exams.sort((a, b) => (b.data || "").localeCompare(a.data || ""));
      return corsResponse({ status: "ok", exams });
    }

    // ----------------------------------------------------------------
    // getTrack — carica esame + domande risolte
    // ----------------------------------------------------------------
    if (data.action === "getTrack") {
      const examId = data.examId;
      if (!examId) return corsResponse({ status: "error", message: "examId mancante" });
      const resolved = resolveEsame(examId);
      if (!resolved) return corsResponse({ status: "error", message: "Esame non trovato: " + examId });
      ensureMetaTrack(resolved.track);
      const pwdRequired = !!(resolved.track._password);
      delete resolved.track._password;
      resolved.track.password_required = pwdRequired;
      // Aggiunge extra tempo globale alla durata (per refreshDuration lato client)
      const extraAll = getExtraMinutesAll(examId);
      if (extraAll !== 0) {
        const base = parseInt(resolved.track.duration, 10) || 0;
        resolved.track.duration = String(base + extraAll);
      }
      // SICUREZZA: getTrack restituisce SOLO metadati e conteggi per la cover.
      // Il contenuto delle domande NON viene mai esposto qui — verrebbe altrimenti
      // raccolto in anticipo (anche a esame chiuso) da chiunque conosca l'URL.
      // Le domande effettive sono assegnate server-side da init/resetPractice.
      return corsResponse({
        status:      "ok",
        track:       resolved.track,
        n_questions: resolved.n_questions,
        total_pts:   resolved.total_pts
      });
    }

    // ----------------------------------------------------------------
    // verifyTrackPassword — verifica password d'accesso esame
    // ----------------------------------------------------------------
    if (data.action === "verifyTrackPassword") {
      const examId = data.examId;
      if (!examId) return corsResponse({ status: "error", message: "examId mancante" });
      const esame = readEsame(examId);
      if (!esame) return corsResponse({ status: "error", message: "Esame non trovato" });
      if (!esame.password || esame.modalita === "practice") return corsResponse({ status: "ok" });
      if (String(data.password || "").trim() === esame.password) return corsResponse({ status: "ok" });
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

    // getImagesAdmin — immagini per preview ed export. Serve solo ID citati nel banco
    // domande o file dentro l'albero della cartella QuizForge (quelli appena caricati, non ancora
    // in una domanda salvata): lo script ha accesso all'intero Drive del proprietario, e senza
    // questo filtro la sola password admin basterebbe a leggere qualunque file.
    if (data.action === "getImagesAdmin") {
      if (data.password !== getAdminPassword()) {
        return corsResponse({ status: "error", message: "Password errata" });
      }
      const allQ = loadAllQuestions();
      const known = {};
      Object.values(allQ).forEach(q => imageIdsInText(q.testo).forEach(id => known[id] = true));
      const ids = (Array.isArray(data.ids) ? data.ids : []).map(String).filter(id => known[id] || fileInTree(id));
      return corsResponse({ status: "ok", images: loadImagesData(ids) });
    }

    // listFolders — sottocartelle di una cartella dell'albero QuizForge (la radice se non indicata),
    // con il percorso dalla radice, per lo sfogliatore dell'editor
    if (data.action === "listFolders") {
      if (data.password !== getAdminPassword()) return corsResponse({ status: "error", message: "Password errata" });
      let folder, path;
      try {
        folder = DriveApp.getFolderById(data.folderId || getDriveFolderId());
        path = folderPathInTree(folder);
      } catch(e) { path = null; }
      if (!path) return corsResponse({ status: "error", message: "Cartella non trovata o fuori dalla cartella QuizForge." });
      const folders = [];
      const it = folder.getFolders();
      while (it.hasNext()) { const f = it.next(); folders.push({ id: f.getId(), name: f.getName() }); }
      folders.sort((a, b) => a.name.localeCompare(b.name, "it"));
      return corsResponse({ status: "ok", folder: path[path.length - 1], path: path, folders: folders });
    }

    // createFolder — nuova sottocartella dentro l'albero QuizForge. Se ne esiste già una con lo
    // stesso nome la restituisce, invece di crearne un doppione.
    if (data.action === "createFolder") {
      if (data.password !== getAdminPassword()) return corsResponse({ status: "error", message: "Password errata" });
      const name = String(data.name || "").replace(/[\\/]+/g, "-").trim().slice(0, 80);
      if (!name) return corsResponse({ status: "error", message: "Serve un nome per la cartella." });
      if (!folderInTree(data.parentId)) return corsResponse({ status: "error", message: "La cartella non è dentro la cartella QuizForge." });
      const parent = DriveApp.getFolderById(data.parentId);
      const esistenti = parent.getFoldersByName(name);
      const f = esistenti.hasNext() ? esistenti.next() : parent.createFolder(name);
      return corsResponse({ status: "ok", folder: { id: f.getId(), name: f.getName() } });
    }

    // uploadImage — carica un'immagine dall'editor nella cartella scelta (dentro l'albero QuizForge,
    // o "QuizForge immagini" se non indicata) e ne restituisce l'ID, da usare come [img:ID].
    // Il file resta privato: lo serve getImages.
    if (data.action === "uploadImage") {
      if (data.password !== getAdminPassword()) return corsResponse({ status: "error", message: "Password errata" });
      const mime = String(data.mime || "");
      if (mime.indexOf("image/") !== 0) return corsResponse({ status: "error", message: "Il file non è un'immagine." });
      let bytes;
      try { bytes = Utilities.base64Decode(String(data.base64 || "")); } catch(e) { bytes = null; }
      if (!bytes || !bytes.length) return corsResponse({ status: "error", message: "Dati dell'immagine non leggibili." });
      if (bytes.length > IMG_MAX_BYTES) {
        return corsResponse({ status: "error", message: "Immagine troppo grande: " + (bytes.length / 1e6).toFixed(1) + " MB, massimo " + (IMG_MAX_BYTES / 1e6).toFixed(1) + " MB." });
      }
      const name = String(data.name || "immagine").replace(/[^\w.\- ]+/g, "_").slice(0, 80) || "immagine";
      // Nella cartella scelta, purché dentro l'albero QuizForge; altrimenti in "QuizForge immagini"
      let folder = null;
      if (data.folderId) {
        if (!folderInTree(data.folderId)) return corsResponse({ status: "error", message: "La cartella scelta non è dentro la cartella QuizForge." });
        folder = DriveApp.getFolderById(data.folderId);
      }
      const file = (folder || getImagesFolder(true)).createFile(Utilities.newBlob(bytes, mime, name));
      return corsResponse({ status: "ok", id: file.getId() });
    }

    // updateQuestion — sovrascrive una domanda dall'editor admin. data.expected è la domanda
    // come l'admin l'ha aperta: se nel frattempo la riga è cambiata (per esempio a mano nel
    // foglio) risponde "conflict" con la versione attuale invece di sovrascriverla.
    if (data.action === "updateQuestion") {
      if (data.password !== getAdminPassword()) return corsResponse({ status: "error", message: "Password errata" });
      const q = normalizeIncomingQuestion(data.question);
      const errors = validateQuestion(q);
      if (errors.length) return corsResponse({ status: "invalid", errors: errors });
      const lock = LockService.getScriptLock();
      try { lock.waitLock(15000); } catch(e) {}
      try {
        const sheet  = getQuestionsSheet();
        const values = sheet.getDataRange().getValues();
        let rowIndex = -1;
        for (let i = 1; i < values.length; i++) {
          if (String(values[i][Q_ID]).trim() === String(data.id)) { rowIndex = i + 1; break; }
        }
        if (rowIndex === -1) return corsResponse({ status: "error", message: "Domanda non trovata: " + data.id });
        const current = rowToQuestion(values[rowIndex - 1]);
        if (questionFingerprint(current) !== questionFingerprint(data.expected)) {
          return corsResponse({ status: "conflict", question: current });
        }
        writeQuestionRow(sheet, rowIndex, q);
        return corsResponse({ status: "ok", question: rowToQuestion(sheet.getRange(rowIndex, 1, 1, Q_DATA + 1).getValues()[0]) });
      } finally {
        try { lock.releaseLock(); } catch(e) {}
      }
    }

    // updateQuestionsMeta — modifica in blocco dal tab Domande. Tocca solo i metadati
    // (categoria, sottocategoria, tag, stato, punti), mai testo e soluzioni: niente da validare
    // oltre ai punti. I tag si aggiungono/tolgono rispetto al valore attuale nel foglio, così
    // non si perdono quelli messi nel frattempo. Scrive solo le righe che cambiano davvero.
    if (data.action === "updateQuestionsMeta") {
      if (data.password !== getAdminPassword()) return corsResponse({ status: "error", message: "Password errata" });
      const set = data.set || {};
      const splitTags = v => (Array.isArray(v) ? v : String(v || "").split(",")).map(t => String(t).trim()).filter(Boolean);
      const addTags = splitTags(data.addTags), removeTags = splitTags(data.removeTags);
      if (set.categoria !== undefined && !String(set.categoria).trim()) {
        return corsResponse({ status: "error", message: "La categoria non può essere vuota." });
      }
      if (set.stato !== undefined && ["bozza", "verificato"].indexOf(set.stato) === -1) {
        return corsResponse({ status: "error", message: "Stato non valido: " + set.stato });
      }
      if (set.punti !== undefined && !(isFinite(Number(set.punti)) && Number(set.punti) > 0)) {
        return corsResponse({ status: "error", message: "I punti devono essere un numero maggiore di zero." });
      }
      const ids = {};
      (data.ids || []).forEach(id => { ids[String(id).trim()] = true; });
      const lock = LockService.getScriptLock();
      try { lock.waitLock(15000); } catch(e) {}
      try {
        const sheet  = getQuestionsSheet();
        const values = sheet.getDataRange().getValues();
        const changed = [], trovate = {};
        for (let i = 1; i < values.length; i++) {
          const id = String(values[i][Q_ID]).trim();
          if (!ids[id]) continue;
          trovate[id] = true;
          const q = rowToQuestion(values[i]);
          q.tags = splitTags(q.tags).join(",");   // "a, b" e "a,b" sono la stessa cosa
          const prima = questionFingerprint(q);
          if (set.categoria  !== undefined) q.categoria  = String(set.categoria).trim();
          if (set.sottocateg !== undefined) q.sottocateg = String(set.sottocateg).trim();
          if (set.stato      !== undefined) q.stato      = set.stato;
          if (set.punti      !== undefined) q.punti      = Number(set.punti);
          let tags = splitTags(q.tags).filter(t => removeTags.indexOf(t) === -1);
          addTags.forEach(t => { if (tags.indexOf(t) === -1) tags.push(t); });
          q.tags = tags.join(",");
          if (questionFingerprint(q) !== prima) changed.push({ row: i + 1, q: q });
        }
        // Righe consecutive in un'unica scrittura: C..F (categoria, sottocategoria, tag, stato) e K (punti)
        for (let a = 0; a < changed.length; ) {
          let b = a;
          while (b + 1 < changed.length && changed[b + 1].row === changed[b].row + 1) b++;
          const run = changed.slice(a, b + 1);
          const r1 = sheet.getRange(run[0].row, Q_CATEGORIA + 1, run.length, Q_STATO - Q_CATEGORIA + 1);
          r1.setNumberFormat("@");
          r1.setValues(run.map(x => [x.q.categoria, x.q.sottocateg, x.q.tags, x.q.stato].map(sheetText)));
          sheet.getRange(run[0].row, Q_PUNTI + 1, run.length, 1).setValues(run.map(x => [x.q.punti]));
          a = b + 1;
        }
        return corsResponse({ status: "ok", questions: changed.map(x => x.q),
                              missing: Object.keys(ids).filter(id => !trovate[id]) });
      } finally {
        try { lock.releaseLock(); } catch(e) {}
      }
    }

    // createQuestion — "salva come nuova" dall'editor: nuova riga con ID nuovo, validata.
    // Diversa da addQuestion, che non valida e scrive i valori così come arrivano.
    if (data.action === "createQuestion") {
      if (data.password !== getAdminPassword()) return corsResponse({ status: "error", message: "Password errata" });
      const q = normalizeIncomingQuestion(data.question);
      const errors = validateQuestion(q);
      if (errors.length) return corsResponse({ status: "invalid", errors: errors });
      const lock = LockService.getScriptLock();
      try { lock.waitLock(15000); } catch(e) {}
      try {
        const sheet = getQuestionsSheet();
        const allQ  = loadAllQuestions();
        let newId;
        do { newId = generateQuestionId(); } while (allQ[newId]);
        sheet.appendRow([newId]);
        const rowIndex = sheet.getLastRow();
        writeQuestionRow(sheet, rowIndex, q);
        return corsResponse({ status: "ok", question: rowToQuestion(sheet.getRange(rowIndex, 1, 1, Q_DATA + 1).getValues()[0]) });
      } finally {
        try { lock.releaseLock(); } catch(e) {}
      }
    }

    // ----------------------------------------------------------------
    // createTrack — crea nuova traccia (solo template domande)
    // ----------------------------------------------------------------
    if (data.action === "createTrack") {
      if (data.password !== getAdminPassword()) return corsResponse({ status: "error", message: "Password errata" });
      const sheet = getTracceSheet();
      const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
      let suffix = "";
      for (let i = 0; i < 6; i++) suffix += chars[Math.floor(Math.random() * chars.length)];
      const trackId = "t-" + suffix;
      sheet.appendRow([trackId, data.nome || "Nuova traccia", JSON.stringify(data.items || [])]);
      return corsResponse({ status: "ok", track_id: trackId });
    }

    // ----------------------------------------------------------------
    // getAllTracks — elenco tracce (template domande) per admin
    // ----------------------------------------------------------------
    if (data.action === "getAllTracks") {
      if (data.password !== getAdminPassword()) return corsResponse({ status: "error", message: "Password errata" });
      const sheet  = getTracceSheet();
      const values = sheet.getDataRange().getValues();
      const tracks = [];
      for (let i = 1; i < values.length; i++) {
        const row = values[i];
        const id  = String(row[T_ID]).trim();
        if (!id || id === "TracciaID") continue;
        let items = [];
        try { items = JSON.parse(String(row[T_ITEMS] || "") || "[]"); } catch(e) {}
        tracks.push({ track_id: id, nome: String(row[T_NOME]), items });
      }
      return corsResponse({ status: "ok", tracks, version: VERSION });
    }

    // ----------------------------------------------------------------
    // setTrack — aggiorna nome e/o items di una traccia
    // ----------------------------------------------------------------
    if (data.action === "setTrack") {
      if (data.password !== getAdminPassword()) return corsResponse({ status: "error", message: "Password errata" });
      const sheet  = getTracceSheet();
      const values = sheet.getDataRange().getValues();
      for (let i = 1; i < values.length; i++) {
        if (String(values[i][T_ID]).trim() !== data.track_id) continue;
        const row = i + 1;
        if (data.nome  !== undefined) sheet.getRange(row, T_NOME  + 1).setValue(data.nome);
        if (data.items !== undefined) sheet.getRange(row, T_ITEMS + 1).setValue(JSON.stringify(data.items));
        return corsResponse({ status: "ok" });
      }
      return corsResponse({ status: "error", message: "Traccia non trovata: " + data.track_id });
    }

    // ----------------------------------------------------------------
    // createEsame — crea nuova sessione d'esame
    // ----------------------------------------------------------------
    if (data.action === "createEsame") {
      if (data.password !== getAdminPassword()) return corsResponse({ status: "error", message: "Password errata" });
      const sheet = getEsamiSheet();
      const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
      let suffix = "";
      for (let i = 0; i < 6; i++) suffix += chars[Math.floor(Math.random() * chars.length)];
      const examDate = data.exam_date || Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd");
      const examId   = examDate + "-" + suffix;
      sheet.appendRow([
        examId,
        data.traccia_id     || "",
        "",               // col C riservata (era exam_name)
        examDate,
        data.duration       || 90,
        data.corso          || "",
        data.mode           || "exam",
        "closed",
        data.track_password || "",
        data.shuffle === false || data.shuffle === "no" ? "no" : ""
      ]);
      return corsResponse({ status: "ok", exam_id: examId });
    }

    // ----------------------------------------------------------------
    // getAllEsami — elenco sessioni d'esame per admin
    // ----------------------------------------------------------------
    if (data.action === "getAllEsami") {
      if (data.password !== getAdminPassword()) return corsResponse({ status: "error", message: "Password errata" });
      const sheet  = getEsamiSheet();
      const tz     = Session.getScriptTimeZone();
      const values = sheet.getDataRange().getValues();
      const esami  = [];
      for (let i = 0; i < values.length; i++) {
        const row = values[i];
        const id  = String(row[E_ID]).trim();
        if (!id || id === "EsameID") continue;
        const rawDate = row[E_DATA];
        const dataStr = rawDate instanceof Date && !isNaN(rawDate)
          ? Utilities.formatDate(rawDate, tz, "yyyy-MM-dd") : String(rawDate);
        esami.push({
          exam_id:    id,
          traccia_id: String(row[E_TRACCIA]).trim(),
          data:       dataStr,
          durata:     String(row[E_DURATA]),
          corso:      String(row[E_CORSO]),
          modalita:   String(row[E_MODALITA]) || "exam",
          stato:      String(row[E_STATO])    || "closed",
          password:   String(row[E_PASSWORD] || "").trim(),
          shuffle:    String(row[E_SHUFFLE] || "").trim().toLowerCase() !== "no"
        });
      }
      return corsResponse({ status: "ok", esami, version: VERSION });
    }

    // ----------------------------------------------------------------
    // setEsame — aggiorna attributi di una sessione d'esame
    // ----------------------------------------------------------------
    if (data.action === "setEsame") {
      if (data.password !== getAdminPassword()) return corsResponse({ status: "error", message: "Password errata" });
      const sheet  = getEsamiSheet();
      const values = sheet.getDataRange().getValues();
      for (let i = 0; i < values.length; i++) {
        if (String(values[i][E_ID]).trim() !== data.exam_id) continue;
        const row = i + 1;
        if (data.traccia_id     !== undefined) sheet.getRange(row, E_TRACCIA  + 1).setValue(data.traccia_id);
        if (data.exam_date      !== undefined) sheet.getRange(row, E_DATA     + 1).setValue(data.exam_date);
        if (data.duration       !== undefined) sheet.getRange(row, E_DURATA   + 1).setValue(data.duration);
        if (data.corso          !== undefined) sheet.getRange(row, E_CORSO    + 1).setValue(data.corso);
        if (data.mode           !== undefined) sheet.getRange(row, E_MODALITA + 1).setValue(data.mode);
        if (data.status         !== undefined) sheet.getRange(row, E_STATO    + 1).setValue(data.status);
        if (data.track_password !== undefined) sheet.getRange(row, E_PASSWORD + 1).setValue(data.track_password);
        if (data.shuffle        !== undefined) sheet.getRange(row, E_SHUFFLE  + 1).setValue(data.shuffle === false || data.shuffle === "no" ? "no" : "");
        // Sincronizza foglio Esami nel foglio risultati
        const meta  = getMetaSheet();
        const mvals = meta.getDataRange().getValues();
        for (let j = 1; j < mvals.length; j++) {
          if (String(mvals[j][META_COLS.exam_id]) !== data.exam_id) continue;
          const mrow = j + 1;
          if (data.exam_date !== undefined) meta.getRange(mrow, META_COLS.exam_date + 1).setValue(data.exam_date);
          if (data.duration  !== undefined) meta.getRange(mrow, META_COLS.duration  + 1).setValue(data.duration);
          if (data.corso     !== undefined) meta.getRange(mrow, META_COLS.corso     + 1).setValue(data.corso);
          if (data.mode      !== undefined) meta.getRange(mrow, META_COLS.mode      + 1).setValue(data.mode);
          if (data.status    !== undefined) meta.getRange(mrow, META_COLS.status    + 1).setValue(data.status);
          break;
        }
        return corsResponse({ status: "ok" });
      }
      return corsResponse({ status: "error", message: "Esame non trovato: " + data.exam_id });
    }

    // ----------------------------------------------------------------
    // getMonitor — studenti di un esame (admin)
    // ----------------------------------------------------------------
    if (data.action === "getMonitor") {
      if (data.password !== getAdminPassword()) {
        return corsResponse({ status: "error", message: "Password errata" });
      }
      const examId  = data.examId;
      const esame   = readEsame(examId);
      const traccia = esame ? readTraccia(esame.traccia_id) : null;
      const nQ      = traccia ? traccia.items.length : 20;
      const resumeAll = getResumeAll(examId);
      const ss      = SpreadsheetApp.openById(getSheetResultsId());
      const sheet   = ss.getSheetByName(examId);
      if (!sheet) return corsResponse({ status: "ok", rows: [], track: readMetaTrack(examId), resume_all: resumeAll });

      const values = sheet.getDataRange().getValues();
      const rows   = [];
      for (let i = 1; i < values.length; i++) {
        const row = values[i];
        const qids = parseQIds(row[COL_QIDS - 1]);
        const rowNQ = qids.length || nQ;
        let answered = 0;
        for (let q = 0; q < rowNQ; q++) {
          if (row[COL_ANS_FIRST - 1 + q * 2] !== "") answered++;
        }
        rows.push({
          matricola:  row[COL_MATRICOLA - 1],
          nominativo: row[COL_NOMINATIVO - 1],
          email:      row[COL_EMAIL - 1],
          score:      row[COL_SCORE - 1],
          tsStart:    formatTs(row[COL_TS_START - 1]),
          tsEnd:      formatTs(row[COL_TS_END - 1]),
          elapsed:    String(row[COL_ELAPSED - 1] || ""),
          answered,
          finalized:  row[COL_TS_END - 1] !== ""
        });
      }
      return corsResponse({ status: "ok", rows, track: readMetaTrack(examId), resume_all: resumeAll });
    }

    // ----------------------------------------------------------------
    // getResults — punteggi per domanda (admin)
    // ----------------------------------------------------------------
    if (data.action === "getResults") {
      if (data.password !== getAdminPassword()) {
        return corsResponse({ status: "error", message: "Password errata" });
      }
      const examId  = data.examId;
      const esame2  = readEsame(examId);
      const traccia2 = esame2 ? readTraccia(esame2.traccia_id) : null;
      const nQ      = traccia2 ? traccia2.items.length : 20;
      const ss      = SpreadsheetApp.openById(getSheetResultsId());
      const sheet   = ss.getSheetByName(examId);
      if (!sheet) return corsResponse({ status: "ok", rows: [], track: readMetaTrack(examId) });

      const values = sheet.getDataRange().getValues();
      const rows   = [];
      for (let i = 1; i < values.length; i++) {
        const row = values[i];
        if (row[COL_TS_END - 1] === "") continue;
        const qidsPuntiRow = parseQIdsPunti(row[COL_QIDS - 1]);
        const qids   = qidsPuntiRow.map(x => x.id);
        const qpunti = qidsPuntiRow.map(x => x.punti);
        const rowNQ  = qids.length || nQ;
        const pts = [], answers = [];
        for (let q = 0; q < rowNQ; q++) {
          answers.push(String(row[COL_ANS_FIRST - 1 + q * 2] ?? ""));
          pts.push(Number(row[COL_ANS_FIRST - 1 + q * 2 + 1]) || 0);
        }
        rows.push({
          matricola:  row[COL_MATRICOLA - 1],
          nominativo: row[COL_NOMINATIVO - 1],
          score:      row[COL_SCORE - 1],
          tsStart:    formatTs(row[COL_TS_START - 1]),
          tsEnd:      formatTs(row[COL_TS_END - 1]),
          elapsed:    String(row[COL_ELAPSED - 1] || ""),
          pts,
          answers,
          qids,
          qpunti
        });
      }
      return corsResponse({ status: "ok", rows, track: readMetaTrack(examId) });
    }

    // ----------------------------------------------------------------
    // getQuestionStats — statistiche per domanda (admin)
    // Legge tutti i tab del foglio Risultati e aggrega correct/wrong/skipped per domanda.
    // ----------------------------------------------------------------
    if (data.action === "getQuestionStats") {
      if (data.password !== getAdminPassword()) {
        return corsResponse({ status: "error", message: "Password errata" });
      }
      const ss     = SpreadsheetApp.openById(getSheetResultsId());
      const sheets = ss.getSheets();
      const SKIP   = new Set(["_config", "Esami"]);
      const stats  = {}; // qId → { asked, correct, wrong, skipped }
      for (const sheet of sheets) {
        if (SKIP.has(sheet.getName())) continue;
        const values = sheet.getDataRange().getValues();
        for (let i = 1; i < values.length; i++) {
          const row = values[i];
          if (row[COL_TS_END - 1] === "" || row[COL_TS_END - 1] === null) continue;
          const qpRow = parseQIdsPunti(row[COL_QIDS - 1]);
          qpRow.forEach(({ id }, qi) => {
            if (!id) return;
            if (!stats[id]) stats[id] = { asked: 0, correct: 0, wrong: 0, skipped: 0 };
            const ans = String(row[COL_ANS_FIRST - 1 + qi * 2] ?? "");
            const pts = Number(row[COL_ANS_FIRST - 1 + qi * 2 + 1]) || 0;
            stats[id].asked++;
            if (pts > 0)      stats[id].correct++;
            else if (ans !== "") stats[id].wrong++;
            else                stats[id].skipped++;
          });
        }
      }
      return corsResponse({ status: "ok", stats });
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
    // Qui arriva anche un'azione che questa versione non conosce (pagina più nuova dello script):
    // dirlo chiaramente, invece di un "examId mancante" che fa cercare il problema altrove
    const AZIONI_ESAME = ["init", "update", "finalize", "resetPractice", "abandon", "resume", "getImages"];
    if (AZIONI_ESAME.indexOf(data.action) === -1) {
      return corsResponse({ status: "error", message: "Azione «" + data.action + "» non disponibile nello script " + VERSION +
                                                       ": probabilmente serve un deploy più recente." });
    }
    if (!examId) return corsResponse({ status: "error", message: "examId mancante" });

    const resolved = resolveEsame(examId);
    if (!resolved) return corsResponse({ status: "error", message: "Esame non trovato: " + examId });

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
      // Le domande sono assegnate dal SERVER (resolved.questions), mai dal client
      const assigned          = resolved.questions;
      const epMap             = resolved.effectivePuntiMap || {};
      const qIds              = assigned.map(q => q.id);
      const seed              = track.shuffle_options !== false ? Math.floor(Math.random() * 2147483647) : null;
      const qidsCellParts     = qIds.map(id => epMap[id] !== undefined ? id + ":" + epMap[id] : id);
      const qidsCell          = qidsCellParts.join(",") + (seed !== null ? ";seed=" + seed : "");
      const row = [String(data.matricola), data.nominativo || "", data.email || "",
                   "", totalPts, new Date(), "", "",
                   qidsCell];
      for (let i = 0; i < assigned.length; i++) { row.push(""); row.push(""); }
      sheet.appendRow(row);
      sheet.getRange(sheet.getLastRow(), COL_MATRICOLA).setNumberFormat("@");
      return corsResponse({ status: "ok", questions: assigned, total_pts: totalPts, seed });
    }

    // ---- INIT ----
    if (data.action === "init") {
      const lock = LockService.getScriptLock();
      try { lock.waitLock(15000); } catch(e) {}
      try {
        const values = sheet.getDataRange().getValues();
        for (let i = 1; i < values.length; i++) {
          if (String(values[i][COL_MATRICOLA - 1]) === String(data.matricola)) {
            return corsResponse({ status: "duplicate", finalized: values[i][COL_TS_END - 1] !== "" });
          }
        }
        // SICUREZZA: le domande sono assegnate dal SERVER, mai accettate dal client.
        // resolved.questions è la risoluzione server-side (senza risposte corrette).
        const assigned      = resolved.questions;
        const epMap         = resolved.effectivePuntiMap || {};
        const qIds          = assigned.map(q => q.id);
        const seed          = track.shuffle_options !== false ? Math.floor(Math.random() * 2147483647) : null;
        const qidsCellParts = qIds.map(id => epMap[id] !== undefined ? id + ":" + epMap[id] : id);
        const qidsCell      = qidsCellParts.join(",") + (seed !== null ? ";seed=" + seed : "");
        // Colonne fisse: Matricola, Nominativo, Email, Score, Totale, Inizio, Fine, Durata, QIDs
        const row = [String(data.matricola), data.nominativo || "", data.email || "",
                     "", totalPts, new Date(), "", "",
                     qidsCell];
        for (let i = 0; i < assigned.length; i++) { row.push(""); row.push(""); }
        sheet.appendRow(row);
        sheet.getRange(sheet.getLastRow(), COL_MATRICOLA).setNumberFormat("@");
        // Restituisce le domande autoritative: il client DEVE renderizzare esattamente queste
        return corsResponse({ status: "ok", questions: assigned, total_pts: totalPts, seed });
      } finally {
        try { lock.releaseLock(); } catch(e) {}
      }
    }

    // ---- UPDATE ----
    if (data.action === "update") {
      const rowIndex = findRow(sheet, data.matricola);
      if (rowIndex === -1) return corsResponse({ status: "error", message: "Matricola non trovata" });
      // Blocca modifiche dopo la consegna definitiva (anti-manomissione, exam mode)
      if (track.mode !== "practice") {
        const ended = sheet.getRange(rowIndex, COL_TS_END).getValue();
        if (ended !== "" && ended !== null) {
          return corsResponse({ status: "error", message: "Esame già consegnato" });
        }
      }
      const qIdx = parseInt(data.qIndex, 10);
      // Protezione: qIndex valido (>=1) per non scrivere mai nelle colonne di metadati
      // (Score, Totale, Durata...) che precedono la prima colonna risposta.
      if (!Number.isInteger(qIdx) || qIdx < 1) {
        return corsResponse({ status: "error", message: "qIndex non valido" });
      }
      const col  = COL_ANS_FIRST + (qIdx - 1) * 2;
      // Salva solo la risposta grezza — il punteggio è calcolato server-side in finalize
      sheet.getRange(rowIndex, col).setValue(data.ans !== undefined ? data.ans : "");
      // Restituisce extra tempo individuale (NON include "all", già gestito via getTrack)
      const extraInd = getExtraMinutesIndividual(track.exam_id, data.matricola);
      return corsResponse({ status: "ok", extra_minutes_individual: extraInd });
    }

    // ---- RESUME (ripresa d'emergenza, es. blackout) ----
    // Consente di recuperare una sessione NON consegnata da qualsiasi dispositivo,
    // SOLO se il docente ha acceso l'interruttore globale per questo esame.
    // Non rivela mai le risposte corrette; rifiuta sessioni già finalizzate.
    // getImages — immagini delle sole domande assegnate a questo studente. Senza riga
    // (cioè prima dell'init) non restituisce nulla: le immagini non escono prima dell'esame.
    // Canale separato da init/update perché resolveEsame gira a ogni azione, e leggere
    // il Drive lì renderebbe lento ogni salvataggio di risposta.
    if (data.action === "getImages") {
      const rowIndex = findRow(sheet, data.matricola);
      if (rowIndex === -1) return corsResponse({ status: "error", message: "Sessione non trovata" });
      const qidsCell = sheet.getRange(rowIndex, COL_QIDS).getValue();
      const allQ = loadAllQuestions();
      const ids = [];
      parseQIds(qidsCell).forEach(qId => {
        if (allQ[qId]) imageIdsInText(allQ[qId].testo).forEach(id => { if (ids.indexOf(id) === -1) ids.push(id); });
      });
      return corsResponse({ status: "ok", images: imagesForStudent(loadImagesData(ids)) });
    }

    if (data.action === "resume") {
      if (!getResumeAll(track.exam_id)) {
        return corsResponse({ status: "error", message: "Ripresa non consentita" });
      }
      const rowIndex = findRow(sheet, data.matricola);
      if (rowIndex === -1) return corsResponse({ status: "error", message: "Nessuna sessione da riprendere" });
      const existingRow = sheet.getRange(rowIndex, 1, 1, sheet.getLastColumn()).getValues()[0];
      // Mai riaprire un esame già consegnato (vale anche durante la finestra globale)
      if (track.mode !== "practice" && existingRow[COL_TS_END - 1] !== "" && existingRow[COL_TS_END - 1] !== null) {
        return corsResponse({ status: "error", message: "Esame già consegnato" });
      }
      const allQ        = loadAllQuestions();
      const assignedIds = parseQIds(existingRow[COL_QIDS - 1]);
      const seed        = parseQIdsSeed(existingRow[COL_QIDS - 1]);
      // Ricostruisce ESATTAMENTE le domande memorizzate (mai una nuova risoluzione: le random
      // differirebbero), senza risposte corrette — come init.
      const rQuestions = assignedIds.map((qId, i) => {
        const q = allQ[qId];
        if (!q) return { id: qId, error: "Domanda non trovata: " + qId, pts: 0, type: "mc", text: "", pos: i + 1 };
        return buildQuestionObj(q, i + 1, false);
      });
      // Risposte già salvate (via update), riconvertite nel formato in-memory del client
      const rAnswers = assignedIds.map((qId, i) => {
        const raw  = existingRow[COL_ANS_FIRST - 1 + i * 2];
        const type = allQ[qId] ? allQ[qId].tipo : "mc";
        if (raw === "" || raw === null || raw === undefined) return null;
        if (type === "mc") { const n = parseInt(raw, 10); return isNaN(n) ? null : n; }
        if (type === "match" || type === "multi-fitb" || type === "cloze") {
          try { return JSON.parse(raw); } catch(e) { return null; }
        }
        return String(raw); // fitb / free
      });
      const totalPtsResume = Number(existingRow[COL_TOTALE - 1])
        || assignedIds.reduce((s, id) => s + (allQ[id] ? (Number(allQ[id].punti) || 1) : 0), 0)
        || totalPts;
      const tsStart = parseTs(existingRow[COL_TS_START - 1]);
      return corsResponse({
        status:       "ok",
        questions:    rQuestions,
        answers:      rAnswers,
        seed:         seed,
        total_pts:    totalPtsResume,
        ts_start_iso: tsStart ? tsStart.toISOString() : null
      });
    }

    // ---- FINALIZE ----
    if (data.action === "finalize") {
      const lock = LockService.getScriptLock();
      try { lock.waitLock(15000); } catch(e) {}
      try {
        const rowIndex = findRow(sheet, data.matricola);
        if (rowIndex === -1) return corsResponse({ status: "error", message: "Matricola non trovata" });

        const existingRow = sheet.getRange(rowIndex, 1, 1, sheet.getLastColumn()).getValues()[0];

        // ANTI-ORACLE: in exam mode, una volta consegnato il punteggio è CONGELATO.
        // Una ri-finalizzazione NON ricalcola e restituisce sempre lo score memorizzato,
        // ignorando eventuali nuove risposte. Questo impedisce di sottomettere set di
        // risposte diversi leggendo lo score per dedurre le risposte corrette per tentativi.
        // È idempotente: i retry di rete legittimi ricevono comunque il loro punteggio.
        if (track.mode !== "practice" && existingRow[COL_TS_END - 1] !== "" && existingRow[COL_TS_END - 1] !== null) {
          return corsResponse({
            status: "ok", already: true,
            score: existingRow[COL_SCORE - 1],
            total_pts: Number(existingRow[COL_TOTALE - 1]) || totalPts
          });
        }

        // Punteggio ricalcolato SERVER-SIDE usando gli ID assegnati (COL_QIDS), mai score/pts dal client
        const allQ      = loadAllQuestions();
        const qidsPunti = parseQIdsPunti(existingRow[COL_QIDS - 1]);
        const assignedIds = qidsPunti.map(x => x.id);

        // Denominatore (totale punti) coerente con le domande EFFETTIVAMENTE assegnate.
        // Per tracce random, resolveEsame() ridisegna domande diverse ad ogni chiamata: usare
        // resolved.total_pts qui darebbe un denominatore (e una conversione in /30) sbagliato.
        // Priorità: COL_TOTALE salvato all'init (ciò che lo studente ha visto) → ricalcolo dagli ID → fallback.
        const totalPtsResp = Number(existingRow[COL_TOTALE - 1])
          || qidsPunti.reduce((s, { id, punti }) => {
               const q = allQ[id];
               return s + (q ? (punti !== null ? punti : (Number(q.punti) || 1)) : 0);
             }, 0)
          || totalPts;

        let serverScore = 0;
        const scoredAnswers = [];
        qidsPunti.forEach(({ id: qId, punti: ep }, i) => {
          // Usa la risposta inviata se presente, altrimenti quella già salvata da update
          let ans;
          if (data.answers && data.answers[i] !== undefined) {
            ans = data.answers[i].ans !== undefined ? data.answers[i].ans : String(data.answers[i]);
          } else {
            ans = existingRow[COL_ANS_FIRST - 1 + i * 2] ?? "";
          }
          // Applica i punti effettivi della traccia sovrascrivendo il default della domanda
          const qRaw = allQ[qId];
          const q    = (qRaw && ep !== null) ? Object.assign({}, qRaw, { punti: ep }) : qRaw;
          const pts  = scoreAnswer(q, ans);
          serverScore += pts;
          scoredAnswers.push({ ans, pts });
        });

        const nScored  = assignedIds.filter(qId => allQ[qId] && allQ[qId].tipo !== "free").length;
        const nCorrect = scoredAnswers.filter((sa, i) => {
          const { id: qId, punti: ep } = qidsPunti[i];
          const qRaw = allQ[qId];
          if (!qRaw || qRaw.tipo === "free") return false;
          const maxPts = ep !== null ? ep : (Number(qRaw.punti) || 1);
          return sa.pts >= maxPts;
        }).length;

        // Tempo calcolato SERVER-SIDE: inizio dal foglio (scritto all'init), fine = adesso.
        // Ignora tsStart/tsEnd/elapsed inviati dal client (manomissibili).
        const serverStart = parseTs(existingRow[COL_TS_START - 1]);
        const serverEnd   = new Date();
        let elapsedStr = data.elapsed || "";
        let overtime = false;
        if (serverStart) {
          const secs = Math.round((serverEnd - serverStart) / 1000);
          elapsedStr = Math.floor(secs / 60) + "m " + (secs % 60) + "s";
          const extraAll = getExtraMinutesAll(track.exam_id);
          const extraInd = getExtraMinutesIndividual(track.exam_id, data.matricola);
          const durMin = parseInt(track.duration, 10) + extraAll + extraInd;
          if (durMin > 0 && secs > durMin * 60 + 60) { // 60s di tolleranza
            overtime = true;
            elapsedStr += " ⚠ oltre tempo";
          }
        }

        sheet.getRange(rowIndex, COL_NOMINATIVO).setValue(data.nominativo || existingRow[COL_NOMINATIVO - 1] || "");
        sheet.getRange(rowIndex, COL_EMAIL).setValue(data.email || existingRow[COL_EMAIL - 1] || "");
        sheet.getRange(rowIndex, COL_SCORE).setValue(serverScore);            // score server-side
        sheet.getRange(rowIndex, COL_TS_END).setValue(serverEnd); // fine server-side
        sheet.getRange(rowIndex, COL_ELAPSED).setValue(elapsedStr);
        scoredAnswers.forEach((item, i) => {
          const col = COL_ANS_FIRST + i * 2;
          sheet.getRange(rowIndex, col).setValue(item.ans !== undefined ? item.ans : "");
          sheet.getRange(rowIndex, col + 1).setValue(item.pts);
        });

        const response = { status: "ok", score: serverScore, total_pts: totalPtsResp, overtime: overtime, n_correct: nCorrect, n_scored: nScored };
        // Le risposte corrette si rivelano SOLO in practice e SOLO dopo la consegna
        if (track.mode === "practice") {
          const qForFeedback = assignedIds.map(qId => buildQuestionObj(allQ[qId], 0, true));
          response.correct_answers = qForFeedback.map((q, idx) => ({
            id: q.id, correct: q.correct, type: q.type,
            options: q.options, right: q.right, boxes: q.boxes, dropdowns: q.dropdowns,
            scored_pts: scoredAnswers[idx].pts,
            max_pts: (qidsPunti[idx]?.punti !== null ? qidsPunti[idx]?.punti : null)
                     ?? (Number(allQ[assignedIds[idx]]?.punti) || 1)
          }));
        }
        return corsResponse(response);
      } finally {
        try { lock.releaseLock(); } catch(e) {}
      }
    }

    return corsResponse({ status: "error", message: "Azione non riconosciuta: " + data.action });

  } catch (err) {
    return corsResponse({ status: "error", message: err.toString() });
  }
}
