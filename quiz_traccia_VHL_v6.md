# Quiz — Traccia VHL v6
## Applicazioni di Bioinformatica — Genetica Umana (MedTec)

> Tempo stimato: 70–80 minuti. Punteggio totale: 30 punti.
> Una sola risposta corretta per le domande a scelta multipla.
> Punteggi: dom. 4–6 valgono 2 pt; dom. 14: 2 pt; dom. 15: 3 pt; dom. 17–18: 2 pt; dom. 19: 3 pt; tutte le altre valgono 1 pt. Totale: 30 pt.

---

## Parte 1 — Domande teoriche

**1.** [1 pt] L'effettività è una proprietà fondamentale degli algoritmi. Quale delle seguenti situazioni rappresenta una sua violazione?

- A) Un programma che non termina su input molto grandi
- B) Lo stesso algoritmo produce risultati diversi eseguito due volte sugli stessi dati
- C) Un'istruzione che richiede un sottoalgoritmo per essere eseguita
- D) Un algoritmo che richiede più dati di quelli forniti in ingresso

---

**2.** [1 pt] Secondo il teorema di Böhm-Jacopini, qualsiasi algoritmo può essere espresso usando esclusivamente tre strutture fondamentali. Quali sono?

- A) Lettura, scrittura e confronto
- B) Sequenziale, condizionale e iterativa
- C) Ricorsiva, iterativa e parallela
- D) Assegnamento, selezione e funzione

---

**3.** [1 pt] In BLAST, se il parametro W (lunghezza del seed) viene aumentato da 3 a 5, qual è l'effetto atteso?

- A) La ricerca diventa più lenta ma più sensibile, perché vengono confrontati più k-mers per ogni posizione
- B) La ricerca diventa più veloce ma meno sensibile alle sequenze molto divergenti, perché seeds più lunghi trovano meno corrispondenze iniziali
- C) L'E-value di ogni hit diminuisce proporzionalmente, perché il database effettivo di confronto si riduce
- D) Il numero di falsi positivi aumenta, perché seeds più lunghi generano più estensioni da valutare

---

**4.** [2 pt] Qual è il limite fondamentale dei reads corti (short reads) nell'assemblaggio de novo di un genoma?

- A) Hanno un tasso di errore sistematico che cresce con la lunghezza del read, rendendo necessaria la correzione prima dell'assemblaggio
- B) Non possono attraversare regioni ripetute più lunghe del read stesso, rendendo impossibile stabilire come tali regioni si colleghino al resto del genoma
- C) Producono un numero di errori di base proporzionale alla lunghezza del genoma, rendendo necessaria la validazione sperimentale dell'assemblato
- D) Sono prodotti in quantità insufficiente per coprire genomi eucariotici in modo uniforme

---

**5.** [2 pt] Nell'allineamento multiplo di sequenze (MSA), cosa si intende per "posizione conservata" e quale informazione biologica fornisce?

- A) Una posizione in cui tutte le sequenze hanno lo stesso residuo; indica un sito funzionalmente o strutturalmente vincolato dalla selezione purificante
- B) Una posizione con gap in almeno una sequenza; indica un'inserzione recente avvenuta in uno specifico lineaggio evolutivo
- C) Una posizione con alta variabilità tra le sequenze; indica un sito sottoposto a selezione positiva in tutte le specie analizzate
- D) Una posizione presente solo nelle sequenze omologhe più vicine; indica un caso di evoluzione convergente indipendente

---

**6.** [2 pt] Qual è il presupposto dell'algoritmo UPGMA che ne limita l'applicabilità rispetto a Neighbor-Joining?

- A) UPGMA richiede che tutte le sequenze abbiano la stessa lunghezza, mentre NJ gestisce sequenze di lunghezze diverse
- B) UPGMA assume che tutte le sequenze evolvano a velocità costante (orologio molecolare), un'ipotesi spesso non verificata nei dati reali
- C) UPGMA esplora tutti gli alberi possibili per trovare quello ottimale, rendendo il calcolo proibitivo per molte sequenze
- D) UPGMA utilizza una matrice Q rielaborata che penalizza i rami lunghi, introducendo un bias sistematico verso alberi non ultrametrici

---

**7.** [1 pt] Nel sequenziamento NGS, cosa si intende per "coverage" (o profondità di copertura) e quale impatto ha sulla chiamata delle varianti?

- A) Il numero totale di reads prodotti dal sequenziatore; non influisce sulla qualità della chiamata ma solo sulla velocità di analisi
- B) Il numero medio di reads che coprono ciascuna base del genoma; una coverage più alta aumenta la confidenza nella chiamata delle varianti, specialmente per le varianti a bassa frequenza allelica
- C) La percentuale del genoma coperta da almeno un read; determina solo la completezza dell'assemblaggio, non la qualità della genotipizzazione
- D) La lunghezza media dei reads generati; reads più lunghi aumentano la coverage totale indipendentemente dal numero di reads prodotti

---

**8.** [1 pt] Qual è la principale differenza tra Whole Genome Sequencing (WGS) e Whole Exome Sequencing (WES) nell'identificazione di varianti patogene?

- A) WGS sequenzia solo i geni codificanti, mentre WES sequenzia l'intero genoma incluse le regioni non codificanti
- B) WES è più economico e sufficiente per varianti codificanti, ma manca varianti introniche, regolatorie e strutturali rilevabili solo con WGS
- C) WGS produce reads più corti rispetto a WES, rendendolo meno preciso per la chiamata puntuale degli SNV
- D) WES è preferibile per la diagnosi delle malattie mendeliane, mentre WGS è lo standard per i tumori

---

**9.** [1 pt] Quale delle seguenti affermazioni descrive correttamente la differenza tra SNV, indel e variante strutturale (SV)?

- A) SNV è una sostituzione di singola base; indel è un'inserzione o delezione di 1–50 bp; SV è un riarrangiamento genomico ≥50 bp (CNV, inversione, traslocazione)
- B) SNV è una sostituzione di singola base; indel è sinonimo di SV e indica qualsiasi riarrangiamento superiore a 1 bp, indipendentemente dalla dimensione
- C) SNV riguarda sostituzioni fino a 10 bp; indel indica varianti tra 10 e 100 bp; SV indica riarrangiamenti superiori a 100 bp rilevabili solo con long reads
- D) SNV e indel si distinguono per frequenza allelica, non per dimensione; SV indica invece qualsiasi variante che altera il numero di copie di un gene

---

**10.** [1 pt] Nel database gnomAD, un gene ha pLI = 0.99. Qual è l'interpretazione corretta?

- A) Il 99% delle varianti osservate nel gene sono state classificate come patogeniche nei database clinici
- B) Il gene è sotto forte pressione selettiva contro varianti che ne eliminano la funzione, essendo quasi completamente privo di tali varianti nella popolazione sana
- C) La frequenza allelica media delle varianti nel gene è del 99% nella popolazione generale analizzata
- D) Il 99% degli individui nel database porta almeno una variante missenso nel gene, suggerendo alta tolleranza alla variazione

---

**11.** [1 pt] In RNA-seq, qual è il vantaggio della normalizzazione TPM rispetto a RPKM?

- A) È computazionalmente più efficiente, richiedendo un solo passaggio sui dati invece di due normalizzazioni successive
- B) Rende i valori direttamente confrontabili tra campioni diversi, poiché la somma dei TPM è costante per campione indipendentemente dalla profondità di sequenziamento
- C) Non richiede la stima della lunghezza del trascritto, eliminando così una fonte di incertezza sistematica
- D) Elimina completamente l'effetto della coverage, rendendo superflua la normalizzazione per la profondità di lettura

---

**12.** [1 pt] Una variante identificata in un paziente con una malattia dominante rara (prevalenza 1/50.000) ha una frequenza allelica del 4% in gnomAD. Quale conclusione è più ragionevole?

- A) La variante è probabilmente causativa, perché la sua presenza in pazienti affetti supera quella nei controlli sani
- B) La variante è quasi certamente benigna, perché la sua frequenza nella popolazione sana è incompatibile con una malattia rara ad alta penetranza
- C) La variante è di significato incerto, perché la frequenza in gnomAD non è direttamente confrontabile con la prevalenza della malattia
- D) La variante è patogenica con penetranza ridotta, perché è presente sia in pazienti che in individui apparentemente sani

---

**13.** [1 pt] Il framework ACMG/AMP è stato sviluppato principalmente per:

- A) Calcolare automaticamente la patogenicità di qualsiasi variante tramite un algoritmo deterministico basato su dati genomici
- B) Standardizzare il linguaggio e i criteri di classificazione delle varianti tra laboratori di genetica clinica
- C) Sostituire la valutazione clinica con un sistema di punteggio quantitativo basato esclusivamente su dati di popolazione
- D) Classificare le varianti somatiche nei tumori secondo criteri di rilevanza terapeutica e prognostica

---

## Parte 2 — Caso applicativo: il gene VHL

*Il gene VHL (von Hippel-Lindau) codifica per una proteina che agisce come soppressore tumorale. Mutazioni germinali in VHL causano la sindrome di von Hippel-Lindau, una sindrome tumorale ereditaria autosomica dominante caratterizzata da emangioblastomi, carcinoma renale a cellule chiare e feocromocitoma. Nelle sezioni seguenti vengono utilizzati dati reali relativi a questo gene.*

---

**14.** [2 pt] L'output BLAST mostra che la proteina VHL umana (213 aa) e l'omologo di *Danio rerio* (213 aa) hanno il 70% di identità sull'intera lunghezza, con 1 gap. BLAST utilizza un algoritmo di allineamento locale. Quale sarebbe la differenza se si applicasse invece un allineamento globale (Needleman-Wunsch) alle stesse due sequenze?

- A) L'allineamento globale produrrebbe uno score sempre più alto, perché somma i contributi di ogni posizione lungo l'intera lunghezza delle sequenze
- B) L'allineamento globale includerebbe obbligatoriamente le estremità di entrambe le sequenze, producendo potenzialmente uno score inferiore se le regioni terminali sono poco conservate
- C) L'allineamento globale richiederebbe di penalizzare tutti i gap interni, rendendo impossibile il confronto quando una delle due sequenze è più corta dell'altra
- D) L'allineamento globale e locale producono risultati identici quando le sequenze hanno la stessa lunghezza e non ci sono gap alle estremità

---

### Edit distance

Nel confronto tra un frammento del gene VHL e la sequenza corrispondente di un omologo in un'altra specie vengono estratti due brevi frammenti nucleotidici: **Sequenza 1 = ATGCTC** e **Sequenza 2 = ACTG**. La Sequenza 1 scorre sulle colonne, la Sequenza 2 sulle righe. Le operazioni ammesse sono inserzione, delezione e sostituzione, di costo 1 ciascuna.

**15.** [3 pt] Riporta i valori dell'ultima colonna della matrice di programmazione dinamica (dalla riga 0 alla riga 4) e la Edit Distance finale tra le due sequenze.

---

### Output BLAST

Di seguito è riportato un estratto dell'output di una ricerca blastp eseguita con la sequenza proteica di VHL umana (NP_000542.1, 213 aa) contro il database RefSeq nr. L'output è già fornito: non è necessario eseguire la ricerca.

```
Query: NP_000542.1 VHL protein isoform 1 [Homo sapiens]

                                                               Score    E
Sequences producing significant alignments:                   (Bits)  Value

NP_000542.1   VHL protein isoform 1 [Homo sapiens]             436    2e-155
XP_016799693.1  VHL disease protein [Pan troglodytes]           434    4e-154
XP_008974688.1  VHL disease protein [Mus musculus]              388    3e-136
XP_015147021.1  VHL protein [Danio rerio]                       278    2e-94
XP_033058812.1  VHL protein [Drosophila melanogaster]            52    7e-08
hypothetical protein [uncultured bacterium]                      18    0.6

> XP_015147021.1  VHL protein [Danio rerio]  Length=213
  Score = 278 bits, Expect = 2e-94
  Identities = 149/213 (70%), Positives = 175/213 (82%), Gaps = 1/213 (0%)
```

**16.** [1 pt] Quale hit deve essere scartato perché non statisticamente significativo, e perché?

- A) VHL protein — *Drosophila melanogaster*, perché la percentuale di identità è inferiore alla soglia minima accettabile del 30%
- B) hypothetical protein — *uncultured bacterium*, perché l'E-value (0.6) è maggiore della soglia convenzionale di 0.001
- C) VHL protein — *Danio rerio*, perché il bit score è inferiore al valore minimo raccomandato per allineamenti affidabili
- D) VHL disease protein — *Pan troglodytes*, perché la distanza evolutiva dall'uomo rende l'omologia non informativa

---

### Database genomici

*Un paziente di 28 anni con emangioblastoma cerebellare bilaterale porta la variante NM_000551.4(VHL):c.500G>A (p.Arg167Gln) in eterozigosi.*

**17.** [2 pt] Cerca nei database di varianti cliniche la variante descritta. Qual è la classificazione clinica attuale e il livello di revisione?

- A) Pathogenic — no assertion criteria provided
- B) Likely pathogenic — reviewed by expert panel
- C) Pathogenic — reviewed by expert panel
- D) Variant of uncertain significance — single submitter

---

**18.** [2 pt] Cerca nei database di sequenze proteiche la proteina VHL umana (*Homo sapiens*). In quale regione funzionale annotata cade il residuo Arg161, e quale funzione è associata a quella regione?

- A) Regione di interazione con il complesso Elongin BC
- B) Dominio di legame con HIF-1α idrossilato
- C) Sito catalitico dell'attività ubiquitina-ligasica
- D) Regione di ancoraggio alla membrana del reticolo endoplasmatico

---

### Classificazione ACMG/AMP

*Tutti i dati necessari per rispondere sono forniti qui sotto.*

*Il sistema ACMG/AMP classifica le varianti in: Patogenica (P), Probabilmente Patogenica (LP), VUS, Probabilmente Benigna (LB), Benigna (B). Di seguito lo schema completo dei criteri e delle combinazioni:*

**Criteri patogenici**

| Codice | Peso | Descrizione sintetica |
|--------|------|-----------------------|
| PVS1 | Very Strong | Variante loss-of-function in gene dove la LOF è meccanismo noto di malattia |
| PS1 | Strong | Stesso aminoacido di variante patogenica nota (diversa alterazione nucleotidica) |
| PS2 | Strong | De novo confermato (paternità verificata) in paziente con malattia, nessuna storia familiare |
| PS3 | Strong | Studi funzionali validati dimostrano effetto deleterio |
| PS4 | Strong | Prevalenza significativamente aumentata nei pazienti rispetto ai controlli |
| PM1 | Moderate | Localizzata in hotspot mutazionale o dominio funzionale critico senza varianti benigne |
| PM2 | Moderate | Assente o a frequenza estremamente bassa in gnomAD |
| PM3 | Moderate | In trans con variante patogenica (per malattie recessive) |
| PM4 | Moderate | Variante in-frame o stop-loss in regione non ripetuta |
| PM5 | Moderate | Nuova variante missenso allo stesso residuo di variante patogenica nota |
| PM6 | Moderate | De novo presunto (paternità non verificata) |
| PP1 | Supporting | Co-segregazione con malattia in più familiari affetti |
| PP2 | Supporting | Missenso in gene con bassa tolleranza alle varianti missenso |
| PP3 | Supporting | Predizione in silico concordemente deleteria |
| PP4 | Supporting | Fenotipo del paziente altamente specifico per il gene |
| PP5 | Supporting | Segnalata come patogenica da fonte attendibile, senza criteri pubblicati |

**Criteri benigni**

| Codice | Peso | Descrizione sintetica |
|--------|------|-----------------------|
| BA1 | Stand-alone | Frequenza allelica >5% in gnomAD |
| BS1 | Strong | Frequenza allelica superiore a quella attesa per la malattia |
| BS2 | Strong | Osservata in individui sani con malattia ad alta penetranza |
| BS3 | Strong | Studi funzionali dimostrano nessun effetto deleterio |
| BS4 | Strong | Non segregazione con malattia in familiari affetti |
| BP1 | Supporting | Missenso in gene dove solo varianti troncanti sono patogeniche |
| BP2 | Supporting | In trans con variante patogenica dominante, o in cis con patogenica |
| BP3 | Supporting | In-frame in regione ripetuta senza funzione nota |
| BP4 | Supporting | Predizione in silico concordemente benigna |
| BP5 | Supporting | Trovata in caso con diagnosi molecolare alternativa |
| BP6 | Supporting | Segnalata come benigna da fonte attendibile, senza criteri pubblicati |
| BP7 | Supporting | Variante sinonima senza impatto predetto su splicing |

**Combinazioni minime per la classificazione**

| Classificazione | Combinazione minima richiesta |
|----------------|-------------------------------|
| Pathogenic | PVS1 + ≥1 PS/PM · oppure · ≥2 PS · oppure · 1 PS + ≥3 PM · oppure · 1 PS + 2 PM + ≥2 PP · oppure · ≥3 PM + ≥2 PP |
| Likely Pathogenic | PVS1 solo · oppure · 1 PS + 1–2 PM · oppure · 1 PS + ≥2 PP · oppure · ≥3 PM · oppure · 2 PM + ≥2 PP · oppure · 1 PM + ≥4 PP |
| Likely Benign | 1 BS + 1 BP · oppure · ≥3 BP |
| Benign | BA1 · oppure · ≥2 BS |
| VUS | Evidenze insufficienti, in conflitto, o non classificabili nelle categorie sopra |

*Dati per la variante NM_000551.4(VHL):c.500G>A (p.Arg167Gln):*

| Evidenza | Peso |
|----------|------|
| Studi funzionali in vitro dimostrano riduzione del legame con Elongin C (peer-reviewed) | **PS3 — Strong** |
| Riportata in ≥19 individui non correlati con sindrome VHL | **PS4 — Strong** |
| Residuo in hotspot germinale documentato nel dominio funzionale critico | **PM1 — Moderate** |
| Varianti patogeniche note allo stesso codone (p.Arg167Trp, p.Arg167Gly) | **PM5 — Moderate** |
| Assente da gnomAD v4.1.0 (>1.400.000 alleli esaminati) | **PM2 — Moderate** |
| Predizione in silico (REVEL = 0.874, sopra soglia patogenicità) | **PP3 — Supporting** |
| Genitori non testati: de novo non confermato | — |

**19.** [3 pt] *(mostra solo tabella combinazioni, non i criteri completi)* Applicando lo schema di combinazione fornito, quale classificazione è corretta per questa variante?

- A) VUS — le evidenze Strong non sono sufficienti in assenza di un criterio Very Strong come PVS1
- B) Likely Pathogenic — la combinazione di 2 PS + 3 PM + 1 PP soddisfa la soglia LP ma non raggiunge quella per Pathogenic
- C) Pathogenic — la combinazione di 2 PS + 3 PM + 1 PP soddisfa la regola ≥2 PS prevista per la classificazione Patogenica
- D) Likely Pathogenic — i criteri Strong vengono declassati a Moderate in assenza di conferma de novo verificata

---

**20.** [1 pt] Se i test familiari confermassero che entrambi i genitori non portano la variante (de novo confermato con paternità verificata), questo nuovo dato corrisponde al criterio **PS2 (Strong patogenico)**. Quale effetto ha sulla classificazione della variante già Pathogenic?

- A) Nessun effetto sulla categoria — la variante rimane Pathogenic, con un'evidenza Strong aggiuntiva che consolida ulteriormente la classificazione già raggiunta
- B) La variante sale a una nuova classe superiore, "Definitively Pathogenic", prevista per varianti con ≥3 criteri Strong
- C) PS2 viene automaticamente elevato a Very Strong quando confermato con test di paternità, modificando il calcolo complessivo
- D) La classificazione scende a Likely Pathogenic perché PS2 da solo, senza altri criteri Strong, non è sufficiente per Pathogenic

---

*Fine quiz — Traccia VHL v6*

---

> **Distribuzione punteggi:**
> Parte 1: 16 pt (dom. 1–3: 1 pt ciascuna; dom. 4–6: 2 pt ciascuna; dom. 7–13: 1 pt ciascuna).
> Parte 2: 14 pt (dom. 14: 2 pt; dom. 15: 3 pt; dom. 16: 1 pt; dom. 17–18: 2 pt; dom. 19: 3 pt; dom. 20: 1 pt).
> **Totale: 30 pt** (20 domande)
