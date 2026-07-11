# CheckCasa (nome provvisorio) — Design MVP

## Obiettivo

App locale (nessun server, nessun account, dati solo sul telefono — stesso principio di Quiete) per documentare fotograficamente lo stato di un immobile in affitto, al momento dell'ingresso (check-in) e dell'uscita (check-out), con firma digitale finale se le due parti sono fisicamente presenti insieme.

## Target

**Il privato**, non il gestore professionale di portfolio:
- L'**affittuario** che vuole tutelarsi sulla restituzione della cauzione, documentando lo stato dell'immobile che riceve e quello che lascia
- Il **proprietario privato** (una o poche case, non un'agenzia) che vuole tutelarsi sui danni causati da un inquilino

Non è pensata per property manager professionali con portfolio ampi — quel segmento è già presidiato da prodotti maturi e aggressivamente economici (RentCheck, zInspector, SnapInspect, Smoobu/Hostaway/Guesty), vedi `ricerca-di-mercato.md` §3. Restare fermi sul target privato è la scelta di posizionamento che evita lo scontro diretto con quei prodotti.

## Validazione di mercato (sintesi — dettaglio in `ricerca-di-mercato.md`)

- Oltre 1,3 milioni di nuovi contratti di affitto/anno in Italia — mercato indirizzabile strutturalmente più ampio di quello di Quiete, perché ogni contratto ha un momento di ingresso e uno di uscita (non situazionale come i rumori molesti).
- Il consiglio di "documentare con foto lo stato dell'immobile, anche unilateralmente" è **raccomandazione esplicita e ricorrente delle fonti legali italiane** sulla cauzione — il bisogno non è ipotizzato, è verificato.
- Nessuna app gratuita generica dedicata trovata per questo caso d'uso specifico rivolta al privato, né in italiano né a livello internazionale in questa fascia.
- Rischio principale: il "verbale di consegna" fatto a mano (foto sciolte + template PDF gratuito) è pratica già nota in Italia — il collo di bottiglia è la disciplina nel farlo, non l'assenza di uno strumento. Da validare con una landing page, come già fatto per Quiete, prima di investire nello sviluppo completo.

## 1. Flusso principale

**Setup proprietà** (una tantum, poi riutilizzato):
1. Crea una proprietà (nome/indirizzo)
2. Aggiungi le stanze, scegliendo da tipi preimpostati (Camera da letto, Bagno, Cucina, Soggiorno, Balcone/Terrazzo, Altro)

**Sessione di documentazione** (check-in o check-out, ripetuta nel tempo sulla stessa proprietà):
1. Scegli "Check-in" o "Check-out" e la proprietà
2. L'app guida stanza per stanza (usando l'elenco già creato): per ciascuna, una o più foto e una nota facoltativa (es. "graffio sul parquet già presente")
3. A fine giro, generazione del report (PDF con tutte le foto, stanza per stanza, data/ora automatica)
4. Se l'altra parte è presente, cattura della sua firma disegnata sullo schermo, incorporata nel PDF finale

## 2. Esplicitamente fuori perimetro per l'MVP

- **Firma a distanza** (remote signing via link/email) — rimandata a una versione futura, solo se emerge come bisogno reale dopo la validazione. Motivo: eviterebbe la necessità di un backend proprio, mantenendo l'app 100% locale come Quiete.
- **Confronto automatico check-in vs check-out** della stessa stanza (diff fotografico) — funzionalità potenzialmente utile ma che aggiunge complessità; da valutare dopo la validazione.
- **Multi-dispositivo/sincronizzazione** — non necessaria nel modello "un operatore, firma in loco".
- **Gestione professionale di portfolio ampi** (dashboard multi-immobile in stile SaaS B2B) — fuori target per scelta di posizionamento, non solo per scope.

## 3. Modello dati e architettura tecnica

Stesso stack di Quiete: React Native/Expo, solo Android, SQLite locale, nessun server.

**Entità principali:**
- **Proprietà**: nome, indirizzo, lista stanze
- **Stanza**: nome, tipo (preimpostato o personalizzato), appartiene a una proprietà
- **Sessione**: tipo (check-in/check-out), data, proprietà collegata, stato (in corso/completata/firmata)
- **Foto**: una o più per stanza, dentro una sessione, con timestamp
- **Nota**: testo facoltativo per stanza, dentro una sessione
- **Firma**: immagine disegnata, allegata alla sessione a completamento

**Librerie chiave** (equivalenti dirette di Quiete):
- `expo-sqlite` — database locale
- `expo-camera` / `expo-image-picker` — cattura foto
- `expo-print` — generazione PDF del report
- Una libreria di firma su canvas (es. `react-native-signature-canvas`) — unica dipendenza nuova rispetto allo stack Quiete

**Export**: PDF del report, esportabile/condivisibile tramite il sistema operativo (`Sharing.shareAsync`, stesso pattern di Quiete).

## 4. Base legale (riferimenti italiani, pannello informativo — non consulenza legale)

- **Art. 1590 c.c.** — l'inquilino deve riconsegnare l'immobile nello stato in cui l'ha ricevuto, salvo il deterioramento dovuto all'uso normale: la documentazione fotografica di check-in è la prova diretta di "come l'ha ricevuto".
- **Deposito cauzionale** (L. 431/1998 per le locazioni abitative) — la trattenuta per danni è la fonte di contenzioso più comune, come verificato in `ricerca-di-mercato.md` §2.
- **Art. 2712 c.c.** — le riproduzioni fotografiche formano piena prova se la controparte non ne disconosce la conformità (stesso principio già usato in Quiete): la firma in loco rafforza ulteriormente il valore probatorio.
- **Verbale unilaterale**: se l'altra parte non è presente/disponibile, le fonti legali raccomandano di documentare comunque e formalizzare l'invio via PEC/raccomandata — l'app può generare il PDF anche senza firma della controparte, coerente con questa prassi.
- Disclaimer: strumento di documentazione, non consulenza legale.

## 5. Prossimi passi (non ancora avviati)

- Naming: verifica del nome definitivo (marchio, dominio) — rimandata, non blocca la validazione, stesso approccio di Quiete.
- Landing page di validazione: da valutare se costruirla prima dello sviluppo completo, sul modello di quanto fatto per Quiete.
- Modello di business: non deciso, da affrontare dopo la validazione.
