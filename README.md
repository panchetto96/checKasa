# CheckCasa

App Android per documentare fotograficamente, stanza per stanza, lo stato di un immobile in affitto al check-in e al check-out, con report PDF firmabile.

## Il problema

La cauzione è una delle clausole più controverse dei contratti di locazione, e le guide legali italiane raccomandano di fotografare sistematicamente ogni stanza all'ingresso e all'uscita. Nella pratica lo si fa in modo disordinato, con foto sciolte nella galleria. CheckCasa trasforma questa disciplina nel percorso di minor resistenza: un flusso guidato che non fa saltare stanze e produce una documentazione completa, pensata per l'affittuario e per il proprietario privato (non per le agenzie).

## Funzionalità

- Gestione di più proprietà, ciascuna con le proprie stanze (per tipo, con nome personalizzabile).
- Sessioni di check-in e check-out guidate stanza per stanza, con foto da fotocamera o galleria e una nota per stanza.
- Riepilogo della sessione che evidenzia le stanze ancora senza foto prima di chiudere.
- Cronologia delle sessioni di ciascuna proprietà.
- Cattura della firma dell'altra parte su schermata dedicata.
- Generazione di un report PDF con foto, note e firma, condivisibile tramite il menu di condivisione nativo. Senza firma il documento è dichiarato esplicitamente come redatto unilateralmente.
- Eliminazioni sempre precedute da conferma esplicita; tema chiaro/scuro automatico.
- Funziona offline: nessun server, nessun account, dati solo sul dispositivo.

## Stack tecnologico

- Expo SDK 57, React Native 0.86, React 19, TypeScript
- React Navigation (native stack)
- expo-sqlite per la persistenza, expo-file-system per foto e firme
- expo-image-picker (fotocamera/galleria), react-native-signature-canvas (firma)
- expo-print ed expo-sharing (generazione e condivisione del PDF)
- Jest con jest-expo per i test

## Architettura

Il codice è in `app/`; l'entry point è `App.tsx`, che inizializza il database e monta lo stack di navigazione.

- `src/screens/`: una schermata per passo del flusso (proprietà, stanze, sessione, cattura stanza, cronologia, riepilogo, firma).
- `src/db/`: schema SQLite (proprietà, stanze, sessioni, foto, note, firme) e funzioni di accesso ai dati.
- `src/lib/`: logica non legata all'interfaccia: salvataggio/rimozione di foto e firme, avanzamento della sessione (stanze senza foto), generazione del report, generazione ID.
- `src/types/`: modelli di dominio e tipi di navigazione.
- `src/theme/`: palette per tema chiaro e scuro.

Foto e firme sono copiate dalla cache temporanea in cartelle stabili dell'app (`foto/`, `firme/`); nel database restano solo gli URI. La firma viene catturata come immagine PNG e salvata come file, una per sessione. Per il PDF, `buildReportHtml` costruisce un documento HTML (funzione pura, testata) con le immagini incorporate in base64; `exportReport` legge i file, ignora quelli non più presenti su disco, produce il PDF con `expo-print` e apre la condivisione nativa. Il report include un'avvertenza che non si tratta di consulenza legale.

## Avvio in sviluppo

Tutti i comandi vanno eseguiti dentro `app/`. Richiede Node.js 20 e, per la build nativa, Android SDK / emulatore o dispositivo collegato.

```bash
cd app
npm ci
npx expo start        # server di sviluppo (Metro)
npm run android       # build e avvio su dispositivo/emulatore Android
npm run web           # anteprima web (funzionalità native limitate)
```

## Test e CI

```bash
cd app
npx tsc --noEmit      # controllo dei tipi
npm test              # Jest (jest-expo)
```

I test coprono la generazione del report HTML (note, foto, firma, caso unilaterale), l'avanzamento della sessione e i modelli di dominio. La CI GitHub Actions (`.github/workflows/ci.yml`) gira su push e pull request verso `master`: installa le dipendenze con `npm ci` (Node 20), esegue `tsc --noEmit` e `jest --ci`.

## Documentazione

- [PRODUCT.md](PRODUCT.md): utenti, scopo, posizionamento e principi di design.
- [ricerca-di-mercato.md](ricerca-di-mercato.md): ricerca di mercato e verifica di fattibilità, con fonti.
- [docs/](docs/): specifiche di design e piani di implementazione (`docs/superpowers/specs`, `docs/superpowers/plans`).
