# CheckCasa — PDF + Firma (Piano 3/3) — Design

## Obiettivo

Chiudere il flusso principale della spec MVP (`2026-07-12-checkcasa-mvp-design.md` §1, punti 3-4): a partire da una sessione di check-in/check-out (già costruita nel Piano 2, con foto e note per stanza), generare un report PDF condivisibile e, se l'altra parte è fisicamente presente, raccogliere la sua firma disegnata sullo schermo e includerla nel PDF.

## Lacuna da colmare prima di tutto il resto

Oggi (fine Piano 2), quando l'utente tocca "Completa sessione" in `SessionScreen`, l'app torna a `PropertyDetailScreen` e non esiste alcun modo di riaprire quella sessione in seguito. Il Piano 3 introduce quindi, come prerequisito per PDF/firma, un punto d'accesso alle sessioni passate e in corso di una proprietà.

## Flusso

1. `PropertyDetailScreen` guadagna un pulsante/link "Cronologia" verso una nuova schermata `CronologiaScreen`.
2. `CronologiaScreen` elenca tutte le sessioni della proprietà (in corso e completate), ordinate dalla più recente, con tipo (Check-in/Check-out), data, stato. Tap su una sessione → `RiepilogoSessioneScreen`.
3. `RiepilogoSessioneScreen` mostra, in sola lettura, le stanze della sessione con conteggio foto e nota (se presente) — stesso stile a righe di `SessionScreen`, ma ogni riga resta cliccabile verso `RoomCaptureScreen` esistente: **una sessione completata resta modificabile** (coerente con lo spirito "morbido" già usato nel Piano 2 — "completata" è uno stato, non un lucchetto). La schermata ha due azioni in più:
   - **"Aggiungi firma"** (nascosto se una firma esiste già) → apre `SignatureScreen` modale.
   - **"Genera PDF"** → costruisce l'HTML del report dai dati correnti e apre la condivisione nativa.
4. `SignatureScreen`: canvas di firma (`react-native-signature-canvas`), pulsanti "Salva"/"Annulla". Al salvataggio, l'immagine (PNG) viene copiata nella cartella locale stabile dell'app (stesso pattern di `photos.ts`) e la riga `signatures` inserita. Torna a `RiepilogoSessioneScreen`, che ora mostra la firma catturata e nasconde il pulsante "Aggiungi firma".
5. Il PDF si genera **sempre dai dati correnti al momento della richiesta** — nessuna cache/snapshot salvata. Se l'utente aggiunge una foto o una firma dopo aver già generato/condiviso un PDF, la generazione successiva la include automaticamente, senza bisogno di logica di invalidazione.

## Modello dati

Una nuova tabella, aggiunta con lo stesso pattern delle precedenti (`CREATE TABLE IF NOT EXISTS` in `initDatabase`, funzioni `rowToX` esplicite):

```
signatures: id, session_id (indice UNIQUE — al più una firma per sessione), uri, created_at
```

`deleteProperty` (già transazionale, già cascata su sessioni/foto/note dal Piano 2) va estesa per cancellare anche `signatures` e il relativo file immagine, con lo stesso schema già usato per le foto (fetch degli URI prima della cascata DB, cancellazione file dopo).

Nuove route in `RootStackParamList`:

```ts
Cronologia: { propertyId: string };
RiepilogoSessione: { sessionId: string };
Firma: { sessionId: string };
```

## Contenuto del PDF

HTML → PDF con `expo-print` (`Print.printToFileAsync`) + condivisione con `expo-sharing`, stesso pattern di `pdf.ts` in Quiete (`quiete-app/app/src/lib/pdf.ts`):

- **Intestazione**: nome/indirizzo proprietà, tipo sessione (Check-in/Check-out), data.
- **Per ogni stanza**: nome + icona, nota (se presente), foto in griglia. Una stanza senza foto lo dichiara esplicitamente ("Nessuna foto") invece di essere omessa in silenzio — coerente col principio "mai cancellazioni/omissioni silenziose" di `PRODUCT.md`.
- **Firma**: se presente, immagine + didascalia con data; se assente, una riga che richiama la prassi del "verbale unilaterale" già descritta in `mvp-design.md` §4 (documentare comunque, anche senza controparte).
- **Disclaimer legale** in fondo, stesso registro del disclaimer già usato in Quiete: riferimento ad art. 1590 c.c. (riconsegna nello stato ricevuto), art. 2712 c.c. (valore probatorio delle riproduzioni fotografiche), L. 431/1998 (deposito cauzionale), e la dicitura "strumento di documentazione, non consulenza legale".

**Edge case**: se il file di una foto non esiste più su disco (es. cancellato fuori dall'app), quella foto viene saltata nella generazione del PDF invece di far fallire l'intera operazione.

## Testing

Stesso principio dei Piani 1 e 2 — solo la logica pura si testa con Jest, il layer nativo (file system, stampa, canvas di firma) si verifica manualmente su dispositivo reale:

- `buildReportHtml(property, session, rooms, photos, notes, signature): string` — funzione pura, separata dalla funzione async che chiama `Print.printToFileAsync`/`Sharing.shareAsync`. Testata verificando che l'output contenga: la nota di una stanza, la dichiarazione esplicita per una stanza senza foto, la riga sul verbale unilaterale quando la firma è assente. Stesso pattern di `pdf.ts`/`pdf.test.ts` in Quiete.
- Nessun test per `CronologiaScreen`, `RiepilogoSessioneScreen`, `SignatureScreen`, il layer DB esteso, o l'integrazione con `expo-print`/`expo-sharing`/`react-native-signature-canvas` — verifica manuale su dispositivo, come nei piani precedenti.

## Fuori perimetro per questo piano

Dalla spec MVP (`mvp-design.md` §2), ancora valido:

- Firma a distanza (remote signing via link/email).
- Confronto automatico check-in vs check-out (diff fotografico).
- Multi-dispositivo/sincronizzazione.
- Gestione professionale di portfolio ampi.

Aggiunto in questo piano:

- Nessuna modifica/cancellazione di una firma già salvata (se sbagliata, per l'MVP non c'è un "rifai" — si può aggiungere in futuro se emerge il bisogno reale).
