# CheckCasa — PDF + Firma (Piano 3/3) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Chiudere il flusso principale di CheckCasa: da una sessione di check-in/check-out (già costruita nel Piano 2), generare un report PDF condivisibile e raccogliere, se l'altra parte è presente, la sua firma disegnata sullo schermo.

**Architecture:** Aggiunge una tabella `signatures` (una firma per sessione, salvata come file PNG locale), una schermata Cronologia (elenco sessioni di una proprietà), una schermata di Riepilogo sessione (sola lettura + azioni PDF/firma, ma con le stanze ancora navigabili — una sessione completata resta modificabile), una schermata di cattura firma con canvas, e la generazione del PDF via HTML→`expo-print`, sempre rigenerato dai dati correnti.

**Tech Stack:** Stesso stack dei Piani 1-2. Aggiunge `react-native-signature-canvas` (+ `react-native-webview`, sua dipendenza), `expo-print`, `expo-sharing`.

## Global Constraints

- Tutto quello dei Piani 1-2 resta valido (stesso stack, nessun server/account, solo Android, italiano ovunque, snake_case↔camelCase con `rowToX`, `newId()`).
- Le dipendenze Expo-native (`react-native-webview`, `expo-print`, `expo-sharing`) si installano con `npx expo install`, non pinnate a mano. `react-native-signature-canvas` non è nel database di compatibilità di Expo: si installa con `npm install` diretto.
- Le firme vivono come file PNG in `${FileSystem.documentDirectory}firme/` (stesso pattern di `photos.ts`), **non** come base64 diretto in SQLite — il DB salva solo l'URI del file.
- Al più una firma per sessione: la tabella `signatures` ha un indice unico su `session_id`.
- Il PDF si genera **sempre dai dati correnti al momento della richiesta**, mai salvato o cacheato: nessuna logica di invalidazione da gestire.
- Le foto vengono incorporate nel PDF come immagini base64 inline (non `file://` diretti — su iOS servirebbe comunque, e così il comportamento è identico su ogni piattaforma). Se il file di una foto non esiste più su disco, viene **saltata** nel report invece di far fallire la generazione.
- Una sessione "completata" resta modificabile: dal Riepilogo si può ancora entrare in una stanza (`CatturaStanza`, già esistente dal Piano 2) e aggiungere foto/note. "Completata" è uno stato, non un lucchetto.
- Nessuna modifica/cancellazione di una firma già salvata — fuori perimetro per questo piano.
- Test automatici solo su logica pura: `buildReportHtml` (funzione pura, separata dalla funzione async `exportReport` che tocca file system/stampa/condivisione). Tutto il resto (screen, layer DB, canvas di firma, `expo-print`/`expo-sharing`) si verifica manualmente su dispositivo reale, come nei Piani 1-2.

---

### Task 1: Installa le dipendenze per firma e PDF

**Files:**
- Modify: `app/package.json` (dipendenze aggiunte dagli installer, non a mano)

**Interfaces:**
- Produces: `react-native-signature-canvas`, `react-native-webview`, `expo-print`, `expo-sharing` disponibili come dipendenze del progetto.

- [ ] **Step 1: Installa le dipendenze Expo-native con l'installer di Expo (risolve le versioni compatibili con l'SDK ~57 già installato)**

```bash
cd app
npx expo install react-native-webview expo-print expo-sharing
```

Expected: `package.json` si aggiorna con le tre dipendenze (versioni scelte da Expo), `npm install` gira in automatico.

- [ ] **Step 2: Installa `react-native-signature-canvas` (non è nel database di compatibilità di Expo, va installato con npm)**

```bash
npm install react-native-signature-canvas@^5.1.0
```

Expected: `package.json` si aggiorna con `react-native-signature-canvas`.

- [ ] **Step 3: Verifica**

```bash
npx tsc --noEmit
```

Expected: nessun errore.

- [ ] **Step 4: Commit**

```bash
git add app/package.json app/package-lock.json
git commit -m "Installa react-native-signature-canvas, expo-print ed expo-sharing"
```

---

### Task 2: Libreria firme locali

**Files:**
- Create: `app/src/lib/signature.ts`

**Interfaces:**
- Consumes: `expo-file-system/legacy` (stesso sottopercorso già usato da `photos.ts`).
- Produces:
  - `const SIGNATURES_DIR: string`
  - `function saveSignature(dataUrl: string): Promise<string>`
  - `function deleteSignatureFile(uri: string): Promise<void>`

- [ ] **Step 1: Crea `app/src/lib/signature.ts`**

```ts
import * as FileSystem from 'expo-file-system/legacy';

/** Cartella locale dove vive la firma catturata per una sessione. */
export const SIGNATURES_DIR = `${FileSystem.documentDirectory}firme/`;

/** Salva la firma (data URL "data:image/png;base64,...") come file PNG locale. */
export async function saveSignature(dataUrl: string): Promise<string> {
  await FileSystem.makeDirectoryAsync(SIGNATURES_DIR, { intermediates: true }).catch(() => {});
  const base64 = dataUrl.replace(/^data:image\/png;base64,/, '');
  const dest = `${SIGNATURES_DIR}firma-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.png`;
  await FileSystem.writeAsStringAsync(dest, base64, { encoding: FileSystem.EncodingType.Base64 });
  return dest;
}

/** Rimuove il file di una firma dal disco. Non fallisce se il file non esiste più. */
export async function deleteSignatureFile(uri: string): Promise<void> {
  await FileSystem.deleteAsync(uri, { idempotent: true });
}
```

Nessun test: chiamate dirette al file system nativo, stessa scelta già fatta per `photos.ts` nel Piano 2.

- [ ] **Step 2: Verifica**

```bash
npx tsc --noEmit
```

Expected: nessun errore.

- [ ] **Step 3: Commit**

```bash
git add app/src/lib/signature.ts
git commit -m "Aggiunge la libreria per il salvataggio locale delle firme"
```

---

### Task 3: Modello dati firma

**Files:**
- Create: `app/src/types/signature.ts`

**Interfaces:**
- Produces: `interface Signature { id: string; sessionId: string; uri: string; createdAt: string }`

- [ ] **Step 1: Crea `app/src/types/signature.ts`**

```ts
export interface Signature {
  id: string;
  sessionId: string;
  uri: string;
  createdAt: string;
}
```

Nessun test: è una semplice interfaccia dati, nessuna logica da verificare.

- [ ] **Step 2: Verifica**

```bash
npx tsc --noEmit
```

Expected: nessun errore.

- [ ] **Step 3: Commit**

```bash
git add app/src/types/signature.ts
git commit -m "Aggiunge il modello dati della firma"
```

---

### Task 4: Estensione del layer dati SQLite — firme e cronologia sessioni

**Files:**
- Modify: `app/src/db/database.ts`

**Interfaces:**
- Consumes: `Signature` da `../types/signature` (Task 3).
- Produces:
  - `function getSessionsForProperty(propertyId: string): Promise<Session[]>`
  - `function insertSignature(signature: Signature): Promise<void>`
  - `function getSignatureForSession(sessionId: string): Promise<Signature | null>`
  - `function getSignaturesForProperty(propertyId: string): Promise<Signature[]>`
  - `deleteProperty` (esistente) modificata per cancellare a cascata anche le firme.

- [ ] **Step 1: Aggiungi l'import in cima al file, subito dopo l'import esistente di `../types/session`**

```ts
import { Signature } from '../types/signature';
```

- [ ] **Step 2: Sostituisci la funzione `initDatabase` esistente con questa versione estesa (aggiunge la tabella `signatures` e il suo indice unico)**

```ts
export async function initDatabase(): Promise<void> {
  const db = await getDb();
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS properties (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      address TEXT,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS rooms (
      id TEXT PRIMARY KEY NOT NULL,
      property_id TEXT NOT NULL,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY NOT NULL,
      property_id TEXT NOT NULL,
      type TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL,
      completed_at TEXT
    );
    CREATE TABLE IF NOT EXISTS photos (
      id TEXT PRIMARY KEY NOT NULL,
      session_id TEXT NOT NULL,
      room_id TEXT NOT NULL,
      uri TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS notes (
      id TEXT PRIMARY KEY NOT NULL,
      session_id TEXT NOT NULL,
      room_id TEXT NOT NULL,
      text TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_notes_session_room ON notes(session_id, room_id);
    CREATE TABLE IF NOT EXISTS signatures (
      id TEXT PRIMARY KEY NOT NULL,
      session_id TEXT NOT NULL,
      uri TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_signatures_session ON signatures(session_id);
  `);
}
```

- [ ] **Step 3: Aggiungi `getSessionsForProperty`, subito dopo la funzione `completeSession` esistente**

```ts
export async function getSessionsForProperty(propertyId: string): Promise<Session[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<SessionRow>(
    'SELECT * FROM sessions WHERE property_id = ? ORDER BY created_at DESC',
    propertyId
  );
  return rows.map(rowToSession);
}
```

- [ ] **Step 4: Sostituisci la funzione `deleteProperty` esistente con questa versione (cascata estesa alle firme)**

```ts
/** Elimina la proprietà, le sue stanze, e tutte le sessioni/foto/note/firme collegate: SQLite qui non ha vincoli di FK a cascata. */
export async function deleteProperty(id: string): Promise<void> {
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM photos WHERE session_id IN (SELECT id FROM sessions WHERE property_id = ?)', id);
    await db.runAsync('DELETE FROM notes WHERE session_id IN (SELECT id FROM sessions WHERE property_id = ?)', id);
    await db.runAsync(
      'DELETE FROM signatures WHERE session_id IN (SELECT id FROM sessions WHERE property_id = ?)',
      id
    );
    await db.runAsync('DELETE FROM sessions WHERE property_id = ?', id);
    await db.runAsync('DELETE FROM rooms WHERE property_id = ?', id);
    await db.runAsync('DELETE FROM properties WHERE id = ?', id);
  });
}
```

- [ ] **Step 5: Aggiungi le funzioni per le firme alla fine del file**

```ts
interface SignatureRow {
  id: string;
  session_id: string;
  uri: string;
  created_at: string;
}

function rowToSignature(row: SignatureRow): Signature {
  return {
    id: row.id,
    sessionId: row.session_id,
    uri: row.uri,
    createdAt: row.created_at,
  };
}

export async function insertSignature(signature: Signature): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO signatures (id, session_id, uri, created_at) VALUES (?, ?, ?, ?)`,
    signature.id,
    signature.sessionId,
    signature.uri,
    signature.createdAt
  );
}

export async function getSignatureForSession(sessionId: string): Promise<Signature | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<SignatureRow>('SELECT * FROM signatures WHERE session_id = ?', sessionId);
  return row ? rowToSignature(row) : null;
}

/** Tutte le firme di tutte le sessioni di una proprietà — usata per ripulire i file quando la proprietà viene eliminata. */
export async function getSignaturesForProperty(propertyId: string): Promise<Signature[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<SignatureRow>(
    `SELECT signatures.* FROM signatures
     JOIN sessions ON sessions.id = signatures.session_id
     WHERE sessions.property_id = ?`,
    propertyId
  );
  return rows.map(rowToSignature);
}
```

Nessun test automatico per queste funzioni (native SQLite, stessa scelta dei Piani 1-2) — si verificano manualmente nel Task 9.

- [ ] **Step 6: Verifica**

```bash
npx tsc --noEmit
```

Expected: nessun errore.

- [ ] **Step 7: Commit**

```bash
git add app/src/db/database.ts
git commit -m "Estende il layer dati SQLite con firme e cronologia sessioni"
```

---

### Task 5: Generazione dell'HTML del report (TDD)

**Files:**
- Create: `app/src/lib/pdf.ts`
- Test: `app/src/lib/pdf.test.ts`

**Interfaces:**
- Consumes: `Property`, `Room`, `roomTypeInfo` da `../types/property` (Piano 1); `Session`, `Photo`, `RoomNote`, `sessionTypeLabel` da `../types/session` (Piano 2); `Signature` da `../types/signature` (Task 3).
- Produces:
  - `interface EmbeddedPhoto { roomId: string; base64: string }`
  - `function buildReportHtml(property: Property, session: Session, rooms: Room[], photos: EmbeddedPhoto[], notes: RoomNote[], signatureBase64: string | null): string` — funzione pura.
  - `function exportReport(property: Property, session: Session, rooms: Room[], photos: Photo[], notes: RoomNote[], signature: Signature | null): Promise<void>` — usata da `RiepilogoSessioneScreen` (Task 7).

- [ ] **Step 1: Scrivi il test (fallisce, il file `pdf.ts` non esiste ancora)**

Crea `app/src/lib/pdf.test.ts`:

```ts
import { buildReportHtml } from './pdf';
import type { Property, Room } from '../types/property';
import type { Session, RoomNote } from '../types/session';

const property: Property = {
  id: 'p1',
  name: 'Casa Test',
  address: 'Via Roma 1',
  createdAt: '2026-01-01T00:00:00.000Z',
};

const session: Session = {
  id: 's1',
  propertyId: 'p1',
  type: 'check-in',
  status: 'completata',
  createdAt: '2026-01-01T10:00:00.000Z',
  completedAt: '2026-01-01T11:00:00.000Z',
};

const rooms: Room[] = [
  { id: 'r1', propertyId: 'p1', name: 'Cucina', type: 'cucina', createdAt: '2026-01-01T00:00:00.000Z' },
  { id: 'r2', propertyId: 'p1', name: 'Bagno', type: 'bagno', createdAt: '2026-01-01T00:00:00.000Z' },
];

describe('buildReportHtml', () => {
  it('include la nota di una stanza', () => {
    const notes: RoomNote[] = [
      { id: 'n1', sessionId: 's1', roomId: 'r1', text: 'graffio sul parquet', createdAt: '2026-01-01T10:00:00.000Z' },
    ];
    const html = buildReportHtml(property, session, rooms, [], notes, null);
    expect(html).toContain('graffio sul parquet');
  });

  it('dichiara esplicitamente le stanze senza foto', () => {
    const html = buildReportHtml(property, session, rooms, [], [], null);
    expect(html).toContain('Nessuna foto');
  });

  it('include la riga sul verbale unilaterale quando la firma è assente', () => {
    const html = buildReportHtml(property, session, rooms, [], [], null);
    expect(html).toContain('redatto unilateralmente');
  });

  it("include l'immagine della firma quando presente, senza la riga sul verbale unilaterale", () => {
    const html = buildReportHtml(property, session, rooms, [], [], 'ZmFrZS1iYXNlNjQ=');
    expect(html).toContain('data:image/png;base64,ZmFrZS1iYXNlNjQ=');
    expect(html).not.toContain('redatto unilateralmente');
  });

  it('include la foto di una stanza come immagine base64', () => {
    const html = buildReportHtml(property, session, rooms, [{ roomId: 'r1', base64: 'Zm90bw==' }], [], null);
    expect(html).toContain('data:image/jpeg;base64,Zm90bw==');
  });
});
```

- [ ] **Step 2: Esegui il test e verifica che fallisca**

```bash
npx jest src/lib/pdf.test.ts
```

Expected: FAIL — `Cannot find module './pdf'`.

- [ ] **Step 3: Implementa `app/src/lib/pdf.ts`**

```ts
import * as FileSystem from 'expo-file-system/legacy';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { roomTypeInfo } from '../types/property';
import type { Property, Room } from '../types/property';
import type { Session, Photo, RoomNote } from '../types/session';
import { sessionTypeLabel } from '../types/session';
import type { Signature } from '../types/signature';

export interface EmbeddedPhoto {
  roomId: string;
  base64: string;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('it-IT', { dateStyle: 'full', timeStyle: 'short' });
}

export function buildReportHtml(
  property: Property,
  session: Session,
  rooms: Room[],
  photos: EmbeddedPhoto[],
  notes: RoomNote[],
  signatureBase64: string | null
): string {
  const roomSections = rooms
    .map((room) => {
      const info = roomTypeInfo(room.type);
      const roomPhotos = photos.filter((p) => p.roomId === room.id);
      const note = notes.find((n) => n.roomId === room.id);

      const photosHtml =
        roomPhotos.length > 0
          ? `<div class="photo-grid">${roomPhotos
              .map((p) => `<img src="data:image/jpeg;base64,${p.base64}" class="photo" />`)
              .join('')}</div>`
          : `<p class="no-photo">Nessuna foto</p>`;

      const noteHtml = note ? `<p class="note">Nota: ${escapeHtml(note.text)}</p>` : '';

      return `
      <div class="room">
        <h2>${info.icon} ${escapeHtml(room.name)}</h2>
        ${photosHtml}
        ${noteHtml}
      </div>`;
    })
    .join('');

  const signatureHtml = signatureBase64
    ? `<div class="signature">
        <p><strong>Firma dell'altra parte</strong></p>
        <img src="data:image/png;base64,${signatureBase64}" class="signature-img" />
        <p class="signature-date">Raccolta il ${formatDate(session.completedAt ?? session.createdAt)}</p>
      </div>`
    : `<p class="unilateral">Documento redatto unilateralmente: l'altra parte non era presente o non ha firmato.
        Secondo le fonti legali italiane, si raccomanda comunque di formalizzare l'invio di questo documento
        via PEC o raccomandata A/R.</p>`;

  return `
  <html>
    <head>
      <meta charset="utf-8" />
      <style>
        body { font-family: -apple-system, Helvetica, Arial, sans-serif; color: #1A2233; padding: 32px; }
        h1 { font-size: 22px; margin-bottom: 4px; }
        h2 { font-size: 16px; margin: 20px 0 8px; }
        .sub { color: #5C6474; font-size: 12px; margin-bottom: 24px; }
        .room { margin-bottom: 20px; page-break-inside: avoid; }
        .photo-grid { display: flex; flex-wrap: wrap; gap: 8px; }
        .photo { width: 150px; height: 150px; object-fit: cover; border-radius: 6px; }
        .no-photo { color: #5C6474; font-size: 12px; font-style: italic; }
        .note { font-size: 13px; margin-top: 6px; }
        .signature { margin-top: 32px; border-top: 1px solid #D9D6CB; padding-top: 16px; }
        .signature-img { width: 240px; height: 100px; object-fit: contain; border: 1px solid #D9D6CB; }
        .signature-date { font-size: 11px; color: #5C6474; }
        .unilateral { margin-top: 32px; font-size: 12px; color: #5C6474; border-top: 1px solid #D9D6CB; padding-top: 16px; }
        .disclaimer { margin-top: 24px; font-size: 10px; color: #5C6474; line-height: 1.5; }
      </style>
    </head>
    <body>
      <h1>${sessionTypeLabel(session.type)} — ${escapeHtml(property.name)}</h1>
      <p class="sub">${property.address ? escapeHtml(property.address) + ' — ' : ''}${formatDate(session.createdAt)}</p>

      ${roomSections}

      ${signatureHtml}

      <p class="disclaimer">
        Questo documento è generato da CheckCasa come strumento di documentazione personale. Non costituisce
        consulenza legale. Ai sensi dell'art. 1590 c.c. l'inquilino deve riconsegnare l'immobile nello stato
        in cui l'ha ricevuto, salvo il normale deterioramento d'uso: la documentazione fotografica di check-in
        è prova diretta di come l'ha ricevuto. Ai sensi dell'art. 2712 c.c. le riproduzioni fotografiche formano
        piena prova dei fatti rappresentati se la parte contro cui sono prodotte non ne disconosce la conformità;
        il valore probatorio finale resta comunque rimesso alla valutazione dell'autorità competente.
      </p>
    </body>
  </html>`;
}

/** Legge un file locale e lo converte in base64, o `null` se il file non esiste più (foto/firma cancellata fuori dall'app). */
async function readFileAsBase64(uri: string): Promise<string | null> {
  try {
    return await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
  } catch {
    return null;
  }
}

/** Genera il PDF dai dati correnti della sessione e apre la condivisione nativa. Foto/firma mancanti su disco vengono saltate. */
export async function exportReport(
  property: Property,
  session: Session,
  rooms: Room[],
  photos: Photo[],
  notes: RoomNote[],
  signature: Signature | null
): Promise<void> {
  const embeddedPhotos: EmbeddedPhoto[] = [];
  for (const photo of photos) {
    const base64 = await readFileAsBase64(photo.uri);
    if (base64) embeddedPhotos.push({ roomId: photo.roomId, base64 });
  }

  const signatureBase64 = signature ? await readFileAsBase64(signature.uri) : null;

  const html = buildReportHtml(property, session, rooms, embeddedPhotos, notes, signatureBase64);
  const { uri } = await Print.printToFileAsync({ html });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, {
      mimeType: 'application/pdf',
      dialogTitle: 'Condividi report',
    });
  }
}
```

- [ ] **Step 4: Esegui il test e verifica che passi**

```bash
npx jest src/lib/pdf.test.ts
```

Expected: PASS, 5 test superati.

- [ ] **Step 5: Verifica**

```bash
npx tsc --noEmit
```

Expected: nessun errore.

- [ ] **Step 6: Commit**

```bash
git add app/src/lib/pdf.ts app/src/lib/pdf.test.ts
git commit -m "Aggiunge la generazione del report PDF"
```

---

### Task 6: Navigazione, schermata Cronologia, pulizia firme alla cancellazione proprietà

**Files:**
- Modify: `app/src/types/navigation.ts`
- Create: `app/src/screens/CronologiaScreen.tsx`
- Modify: `app/src/screens/PropertyDetailScreen.tsx`

**Interfaces:**
- Consumes: `getProperty`, `getSessionsForProperty` (Task 4); `getSignaturesForProperty` (Task 4); `deletePhotoFile` (Piano 2), `deleteSignatureFile` (Task 2); `sessionTypeLabel` (Piano 2).
- Produces: tre nuove route in `RootStackParamList` (`Cronologia`, `RiepilogoSessione`, `Firma`), usate da `App.tsx` (Task 9) e dalle schermate dei Task 7-8.

- [ ] **Step 1: Sostituisci `app/src/types/navigation.ts`**

```ts
export type RootStackParamList = {
  Proprieta: undefined;
  NuovaProprieta: undefined;
  DettaglioProprieta: { id: string };
  NuovaStanza: { propertyId: string };
  Sessione: { sessionId: string };
  CatturaStanza: { sessionId: string; roomId: string };
  Cronologia: { propertyId: string };
  RiepilogoSessione: { sessionId: string };
  Firma: { sessionId: string };
};
```

- [ ] **Step 2: Crea `app/src/screens/CronologiaScreen.tsx`**

```tsx
import React, { useCallback, useState } from 'react';
import { View, Text, FlatList, Pressable, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTheme, Theme } from '../theme/colors';
import { getProperty, getSessionsForProperty } from '../db/database';
import type { Property } from '../types/property';
import type { Session } from '../types/session';
import { sessionTypeLabel } from '../types/session';
import type { RootStackParamList } from '../types/navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'Cronologia'>;

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' });
}

export default function CronologiaScreen({ navigation, route }: Props) {
  const theme = useTheme();
  const styles = makeStyles(theme);
  const { propertyId } = route.params;
  const [property, setProperty] = useState<Property | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);

  const load = useCallback(async () => {
    const [loadedProperty, loadedSessions] = await Promise.all([
      getProperty(propertyId),
      getSessionsForProperty(propertyId),
    ]);
    setProperty(loadedProperty);
    setSessions(loadedSessions);
  }, [propertyId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Cronologia</Text>
        {property ? <Text style={styles.subtitle}>{property.name}</Text> : null}
      </View>

      {sessions.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>🗂️</Text>
          <Text style={styles.emptyText}>Nessuna sessione ancora per questa proprietà.</Text>
        </View>
      ) : (
        <FlatList
          data={sessions}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <Pressable
              style={styles.row}
              onPress={() => navigation.navigate('RiepilogoSessione', { sessionId: item.id })}
            >
              <View style={styles.rowBody}>
                <Text style={styles.rowTitle}>{sessionTypeLabel(item.type)}</Text>
                <Text style={styles.rowMeta}>{formatDate(item.createdAt)}</Text>
              </View>
              <Text style={item.status === 'completata' ? styles.statusDone : styles.statusPending}>
                {item.status === 'completata' ? '✓ Completata' : 'In corso'}
              </Text>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.bg },
    header: { paddingHorizontal: 20, paddingTop: 64, paddingBottom: 20 },
    title: { fontSize: 24, fontWeight: '700', color: theme.text },
    subtitle: { fontSize: 13, color: theme.muted, marginTop: 4 },
    empty: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
    emptyIcon: { fontSize: 40, marginBottom: 16 },
    emptyText: { color: theme.muted, textAlign: 'center', fontSize: 15, lineHeight: 22, maxWidth: 280 },
    list: { paddingHorizontal: 20, paddingBottom: 32 },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: theme.surface,
      borderRadius: 12,
      padding: 16,
      marginBottom: 10,
      borderWidth: 1,
      borderColor: theme.line,
    },
    rowBody: { flex: 1 },
    rowTitle: { color: theme.text, fontSize: 15, fontWeight: '600' },
    rowMeta: { color: theme.muted, fontSize: 12, marginTop: 3 },
    statusDone: { color: theme.accent, fontSize: 12, fontWeight: '600' },
    statusPending: { color: theme.muted, fontSize: 12, fontWeight: '600' },
  });
}
```

- [ ] **Step 3: Sostituisci `app/src/screens/PropertyDetailScreen.tsx` per intero** (aggiunge il link "Vedi cronologia" e la pulizia dei file firma in `confirmDeleteProperty`)

```tsx
import React, { useCallback, useState } from 'react';
import { View, Text, FlatList, Pressable, StyleSheet, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTheme, Theme } from '../theme/colors';
import {
  getProperty,
  getRoomsForProperty,
  deleteRoom,
  deleteProperty,
  getInProgressSession,
  insertSession,
  getPhotosForProperty,
  getSignaturesForProperty,
} from '../db/database';
import { roomTypeInfo } from '../types/property';
import type { Property, Room } from '../types/property';
import type { SessionType } from '../types/session';
import { newId } from '../lib/id';
import { deletePhotoFile } from '../lib/photos';
import { deleteSignatureFile } from '../lib/signature';
import type { RootStackParamList } from '../types/navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'DettaglioProprieta'>;

export default function PropertyDetailScreen({ navigation, route }: Props) {
  const theme = useTheme();
  const styles = makeStyles(theme);
  const { id } = route.params;
  const [property, setProperty] = useState<Property | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [startingSession, setStartingSession] = useState(false);

  const load = useCallback(async () => {
    const [loadedProperty, loadedRooms] = await Promise.all([getProperty(id), getRoomsForProperty(id)]);
    setProperty(loadedProperty);
    setRooms(loadedRooms);
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  function confirmDeleteRoom(room: Room) {
    Alert.alert('Rimuovi stanza', `Rimuovere "${room.name}" da questa proprietà?`, [
      { text: 'Annulla', style: 'cancel' },
      {
        text: 'Rimuovi',
        style: 'destructive',
        onPress: async () => {
          await deleteRoom(room.id);
          await load();
        },
      },
    ]);
  }

  function confirmDeleteProperty() {
    Alert.alert('Elimina proprietà', `Eliminare "${property?.name}" e tutte le sue stanze?`, [
      { text: 'Annulla', style: 'cancel' },
      {
        text: 'Elimina',
        style: 'destructive',
        onPress: async () => {
          const [photos, signatures] = await Promise.all([getPhotosForProperty(id), getSignaturesForProperty(id)]);
          await deleteProperty(id);
          await Promise.all([
            ...photos.map((photo) => deletePhotoFile(photo.uri)),
            ...signatures.map((signature) => deleteSignatureFile(signature.uri)),
          ]);
          navigation.goBack();
        },
      },
    ]);
  }

  async function startSession(type: SessionType) {
    if (startingSession) return;
    setStartingSession(true);
    try {
      const existing = await getInProgressSession(id, type);
      const sessionId = existing?.id ?? newId();
      if (!existing) {
        await insertSession({
          id: sessionId,
          propertyId: id,
          type,
          status: 'in_corso',
          createdAt: new Date().toISOString(),
        });
      }
      navigation.navigate('Sessione', { sessionId });
    } finally {
      setStartingSession(false);
    }
  }

  if (!property) {
    return <View style={styles.container} />;
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{property.name}</Text>
        {property.address ? <Text style={styles.subtitle}>{property.address}</Text> : null}
      </View>

      {rooms.length > 0 && (
        <View style={styles.sessionButtons}>
          <Pressable
            style={[styles.sessionBtn, startingSession && styles.sessionBtnDisabled]}
            onPress={() => startSession('check-in')}
            disabled={startingSession}
          >
            <Text style={styles.sessionBtnText}>Inizia check-in</Text>
          </Pressable>
          <Pressable
            style={[styles.sessionBtn, startingSession && styles.sessionBtnDisabled]}
            onPress={() => startSession('check-out')}
            disabled={startingSession}
          >
            <Text style={styles.sessionBtnText}>Inizia check-out</Text>
          </Pressable>
        </View>
      )}

      {rooms.length > 0 && (
        <Pressable style={styles.historyLink} onPress={() => navigation.navigate('Cronologia', { propertyId: id })}>
          <Text style={styles.historyLinkText}>Vedi cronologia sessioni →</Text>
        </Pressable>
      )}

      {rooms.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>🚪</Text>
          <Text style={styles.emptyText}>Aggiungi le stanze di questa proprietà, una alla volta.</Text>
        </View>
      ) : (
        <FlatList
          data={rooms}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => {
            const info = roomTypeInfo(item.type);
            return (
              <View style={styles.row}>
                <Text style={styles.rowIcon}>{info.icon}</Text>
                <View style={styles.rowBody}>
                  <Text style={styles.rowTitle}>{item.name}</Text>
                </View>
                <Pressable onPress={() => confirmDeleteRoom(item)} accessibilityLabel={`Rimuovi ${item.name}`}>
                  <Text style={styles.rowDelete}>🗑</Text>
                </Pressable>
              </View>
            );
          }}
        />
      )}

      <Pressable
        style={styles.fab}
        onPress={() => navigation.navigate('NuovaStanza', { propertyId: id })}
        accessibilityLabel="Aggiungi una stanza"
      >
        <Text style={styles.fabText}>+</Text>
      </Pressable>

      <Pressable style={styles.deletePropertyBtn} onPress={confirmDeleteProperty}>
        <Text style={styles.deletePropertyText}>Elimina proprietà</Text>
      </Pressable>
    </View>
  );
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.bg },
    header: { paddingHorizontal: 20, paddingTop: 64, paddingBottom: 20 },
    title: { fontSize: 24, fontWeight: '700', color: theme.text },
    subtitle: { fontSize: 13, color: theme.muted, marginTop: 4 },
    sessionButtons: { flexDirection: 'row', gap: 10, paddingHorizontal: 20, marginBottom: 12 },
    sessionBtn: {
      flex: 1,
      backgroundColor: theme.accent,
      borderRadius: 12,
      paddingVertical: 14,
      alignItems: 'center',
    },
    sessionBtnDisabled: { opacity: 0.6 },
    sessionBtnText: { color: theme.accentInk, fontSize: 14, fontWeight: '700' },
    historyLink: { paddingHorizontal: 20, marginBottom: 16 },
    historyLinkText: { color: theme.accent, fontSize: 13, fontWeight: '600' },
    empty: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
    emptyIcon: { fontSize: 40, marginBottom: 16 },
    emptyText: { color: theme.muted, textAlign: 'center', fontSize: 15, lineHeight: 22, maxWidth: 280 },
    list: { paddingHorizontal: 20, paddingBottom: 140 },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.surface,
      borderRadius: 12,
      padding: 16,
      marginBottom: 10,
      borderWidth: 1,
      borderColor: theme.line,
    },
    rowIcon: { fontSize: 22, marginRight: 14 },
    rowBody: { flex: 1 },
    rowTitle: { color: theme.text, fontSize: 15, fontWeight: '600' },
    rowDelete: { fontSize: 18, paddingHorizontal: 6 },
    fab: {
      position: 'absolute',
      right: 20,
      bottom: 32,
      width: 58,
      height: 58,
      borderRadius: 29,
      backgroundColor: theme.accent,
      justifyContent: 'center',
      alignItems: 'center',
      elevation: 6,
    },
    fabText: { color: theme.accentInk, fontSize: 30, fontWeight: '400', marginTop: -2 },
    deletePropertyBtn: { position: 'absolute', left: 20, bottom: 44, padding: 8 },
    deletePropertyText: { color: theme.danger, fontSize: 13, fontWeight: '600' },
  });
}
```

- [ ] **Step 4: Verifica**

```bash
npx tsc --noEmit
```

Expected: nessun errore (le route `Cronologia`/`RiepilogoSessione`/`Firma` non hanno ancora uno screen assegnato in `App.tsx` per tutte — va bene, `Cronologia` viene cablata nel Task 9 insieme alle altre).

- [ ] **Step 5: Commit**

```bash
git add app/src/types/navigation.ts app/src/screens/CronologiaScreen.tsx app/src/screens/PropertyDetailScreen.tsx
git commit -m "Aggiunge la cronologia delle sessioni e la pulizia delle firme alla cancellazione proprietà"
```

---

### Task 7: `RiepilogoSessioneScreen` — riepilogo, firma e PDF

**Files:**
- Create: `app/src/screens/RiepilogoSessioneScreen.tsx`

**Interfaces:**
- Consumes: `getSession`, `getProperty`, `getRoomsForProperty`, `getPhotosForSession`, `getNotesForSession`, `getSignatureForSession` (Piano 2 + Task 4); `exportReport` (Task 5); `roomTypeInfo` (Piano 1); `sessionTypeLabel` (Piano 2); `RootStackParamList` (Task 6).
- Produces: componente `RiepilogoSessioneScreen` (default export), usato da `App.tsx` (Task 9). Naviga verso `CatturaStanza` (Piano 2, già esistente) e `Firma` (Task 8).

- [ ] **Step 1: Crea `app/src/screens/RiepilogoSessioneScreen.tsx`**

```tsx
import React, { useCallback, useState } from 'react';
import { View, Text, FlatList, Pressable, StyleSheet, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTheme, Theme } from '../theme/colors';
import {
  getSession,
  getProperty,
  getRoomsForProperty,
  getPhotosForSession,
  getNotesForSession,
  getSignatureForSession,
} from '../db/database';
import { exportReport } from '../lib/pdf';
import { roomTypeInfo } from '../types/property';
import type { Property, Room } from '../types/property';
import type { Session, Photo, RoomNote } from '../types/session';
import { sessionTypeLabel } from '../types/session';
import type { Signature } from '../types/signature';
import type { RootStackParamList } from '../types/navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'RiepilogoSessione'>;

export default function RiepilogoSessioneScreen({ navigation, route }: Props) {
  const theme = useTheme();
  const styles = makeStyles(theme);
  const { sessionId } = route.params;
  const [session, setSession] = useState<Session | null>(null);
  const [property, setProperty] = useState<Property | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [notes, setNotes] = useState<RoomNote[]>([]);
  const [signature, setSignature] = useState<Signature | null>(null);
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async () => {
    const loadedSession = await getSession(sessionId);
    if (!loadedSession) return;
    const [loadedProperty, loadedRooms, loadedPhotos, loadedNotes, loadedSignature] = await Promise.all([
      getProperty(loadedSession.propertyId),
      getRoomsForProperty(loadedSession.propertyId),
      getPhotosForSession(sessionId),
      getNotesForSession(sessionId),
      getSignatureForSession(sessionId),
    ]);
    setSession(loadedSession);
    setProperty(loadedProperty);
    setRooms(loadedRooms);
    setPhotos(loadedPhotos);
    setNotes(loadedNotes);
    setSignature(loadedSignature);
  }, [sessionId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function handleExportPdf() {
    if (!session || !property || exporting) return;
    setExporting(true);
    try {
      await exportReport(property, session, rooms, photos, notes, signature);
    } catch (err) {
      Alert.alert('Errore', 'Non è stato possibile generare il PDF. Riprova.');
    } finally {
      setExporting(false);
    }
  }

  function photoCountForRoom(roomId: string): number {
    return photos.filter((p) => p.roomId === roomId).length;
  }

  function noteForRoom(roomId: string): RoomNote | undefined {
    return notes.find((n) => n.roomId === roomId);
  }

  if (!session || !property) {
    return <View style={styles.container} />;
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{sessionTypeLabel(session.type)}</Text>
        <Text style={styles.subtitle}>
          {property.name} · {session.status === 'completata' ? 'Completata' : 'In corso'}
        </Text>
      </View>

      <FlatList
        data={rooms}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => {
          const info = roomTypeInfo(item.type);
          const count = photoCountForRoom(item.id);
          const note = noteForRoom(item.id);
          return (
            <Pressable
              style={styles.row}
              onPress={() => navigation.navigate('CatturaStanza', { sessionId, roomId: item.id })}
            >
              <Text style={styles.rowIcon}>{info.icon}</Text>
              <View style={styles.rowBody}>
                <Text style={styles.rowTitle}>{item.name}</Text>
                <Text style={count > 0 ? styles.rowMetaDone : styles.rowMeta}>
                  {count > 0 ? `✓ ${count} foto` : 'Nessuna foto'}
                </Text>
                {note ? <Text style={styles.rowNote}>{note.text}</Text> : null}
              </View>
            </Pressable>
          );
        }}
        ListFooterComponent={
          <View style={styles.footer}>
            {signature ? (
              <Text style={styles.signatureDone}>✓ Firma raccolta</Text>
            ) : (
              <Pressable style={styles.secondaryBtn} onPress={() => navigation.navigate('Firma', { sessionId })}>
                <Text style={styles.secondaryBtnText}>Aggiungi firma</Text>
              </Pressable>
            )}
            <Pressable
              style={[styles.primaryBtn, exporting && styles.primaryBtnDisabled]}
              onPress={handleExportPdf}
              disabled={exporting}
            >
              <Text style={styles.primaryBtnText}>{exporting ? 'Generazione...' : 'Genera PDF'}</Text>
            </Pressable>
          </View>
        }
      />
    </View>
  );
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.bg },
    header: { paddingHorizontal: 20, paddingTop: 64, paddingBottom: 20 },
    title: { fontSize: 24, fontWeight: '700', color: theme.text },
    subtitle: { fontSize: 13, color: theme.muted, marginTop: 4 },
    list: { paddingHorizontal: 20, paddingBottom: 40 },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.surface,
      borderRadius: 12,
      padding: 16,
      marginBottom: 10,
      borderWidth: 1,
      borderColor: theme.line,
    },
    rowIcon: { fontSize: 22, marginRight: 14 },
    rowBody: { flex: 1 },
    rowTitle: { color: theme.text, fontSize: 15, fontWeight: '600' },
    rowMeta: { color: theme.muted, fontSize: 12, marginTop: 3 },
    rowMetaDone: { color: theme.accent, fontSize: 12, marginTop: 3, fontWeight: '600' },
    rowNote: { color: theme.muted, fontSize: 12, marginTop: 4, fontStyle: 'italic' },
    footer: { marginTop: 12, gap: 12 },
    secondaryBtn: {
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.line,
      borderRadius: 12,
      paddingVertical: 14,
      alignItems: 'center',
    },
    secondaryBtnText: { color: theme.text, fontSize: 14, fontWeight: '600' },
    signatureDone: { color: theme.accent, fontSize: 14, fontWeight: '600', textAlign: 'center' },
    primaryBtn: { backgroundColor: theme.accent, borderRadius: 12, paddingVertical: 16, alignItems: 'center' },
    primaryBtnDisabled: { opacity: 0.6 },
    primaryBtnText: { color: theme.accentInk, fontSize: 16, fontWeight: '700' },
  });
}
```

- [ ] **Step 2: Verifica**

```bash
npx tsc --noEmit
```

Expected: nessun errore.

- [ ] **Step 3: Commit**

```bash
git add app/src/screens/RiepilogoSessioneScreen.tsx
git commit -m "Aggiunge la schermata di riepilogo sessione con azioni PDF e firma"
```

---

### Task 8: `SignatureScreen` — cattura firma

**Files:**
- Create: `app/src/screens/SignatureScreen.tsx`

**Interfaces:**
- Consumes: `insertSignature` (Task 4); `saveSignature` (Task 2); `newId` (Piano 1); `RootStackParamList` (Task 6); `SignatureCanvas`/`SignatureViewRef` da `react-native-signature-canvas` (Task 1).
- Produces: componente `SignatureScreen` (default export), usato da `App.tsx` (Task 9).

- [ ] **Step 1: Crea `app/src/screens/SignatureScreen.tsx`**

```tsx
import React, { useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Alert } from 'react-native';
import SignatureCanvas, { SignatureViewRef } from 'react-native-signature-canvas';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTheme, Theme } from '../theme/colors';
import { insertSignature } from '../db/database';
import { saveSignature } from '../lib/signature';
import { newId } from '../lib/id';
import type { RootStackParamList } from '../types/navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'Firma'>;

const WEB_STYLE = `
  .m-signature-pad--footer { display: none; margin: 0; }
  .m-signature-pad--body { border: none; }
  .m-signature-pad { box-shadow: none; border: none; }
  body, html { background-color: #FFFFFF; }
`;

export default function SignatureScreen({ navigation, route }: Props) {
  const theme = useTheme();
  const styles = makeStyles(theme);
  const { sessionId } = route.params;
  const signatureRef = useRef<SignatureViewRef>(null);
  const [saving, setSaving] = useState(false);

  async function handleOK(dataUrl: string) {
    if (saving) return;
    setSaving(true);
    try {
      const uri = await saveSignature(dataUrl);
      await insertSignature({ id: newId(), sessionId, uri, createdAt: new Date().toISOString() });
      navigation.goBack();
    } catch (err) {
      Alert.alert('Errore', 'Non è stato possibile salvare la firma. Riprova.');
    } finally {
      setSaving(false);
    }
  }

  function handleEmpty() {
    Alert.alert('Firma mancante', 'Disegna la firma prima di salvare.');
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Firma</Text>
      <Text style={styles.hint}>Chiedi all'altra parte di firmare qui sotto, con il dito.</Text>

      <View style={styles.canvasWrap}>
        <SignatureCanvas
          ref={signatureRef}
          onOK={handleOK}
          onEmpty={handleEmpty}
          webStyle={WEB_STYLE}
          descriptionText=""
          backgroundColor="#FFFFFF"
          penColor="#000000"
        />
      </View>

      <View style={styles.buttons}>
        <Pressable style={styles.secondaryBtn} onPress={() => signatureRef.current?.clearSignature()}>
          <Text style={styles.secondaryBtnText}>Cancella</Text>
        </Pressable>
        <Pressable
          style={[styles.primaryBtn, saving && styles.primaryBtnDisabled]}
          onPress={() => signatureRef.current?.readSignature()}
          disabled={saving}
        >
          <Text style={styles.primaryBtnText}>{saving ? 'Salvataggio...' : 'Salva firma'}</Text>
        </Pressable>
      </View>

      <Pressable style={styles.cancelBtn} onPress={() => navigation.goBack()}>
        <Text style={styles.cancelBtnText}>Annulla</Text>
      </Pressable>
    </View>
  );
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.bg, padding: 20, paddingTop: 60 },
    title: { fontSize: 22, fontWeight: '700', color: theme.text, marginBottom: 8 },
    hint: { color: theme.muted, fontSize: 13, marginBottom: 16 },
    canvasWrap: {
      flex: 1,
      backgroundColor: '#FFFFFF',
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.line,
      overflow: 'hidden',
      marginBottom: 16,
    },
    buttons: { flexDirection: 'row', gap: 10 },
    secondaryBtn: {
      flex: 1,
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.line,
      borderRadius: 12,
      paddingVertical: 14,
      alignItems: 'center',
    },
    secondaryBtnText: { color: theme.text, fontSize: 14, fontWeight: '600' },
    primaryBtn: {
      flex: 1,
      backgroundColor: theme.accent,
      borderRadius: 12,
      paddingVertical: 14,
      alignItems: 'center',
    },
    primaryBtnDisabled: { opacity: 0.6 },
    primaryBtnText: { color: theme.accentInk, fontSize: 14, fontWeight: '700' },
    cancelBtn: { padding: 14, alignItems: 'center', marginTop: 4 },
    cancelBtnText: { color: theme.muted, fontSize: 14 },
  });
}
```

- [ ] **Step 2: Verifica**

```bash
npx tsc --noEmit
```

Expected: nessun errore.

- [ ] **Step 3: Commit**

```bash
git add app/src/screens/SignatureScreen.tsx
git commit -m "Aggiunge la schermata di cattura firma"
```

---

### Task 9: Cablaggio in `App.tsx` e verifica manuale end-to-end

**Files:**
- Modify: `app/App.tsx`

**Interfaces:**
- Consumes: `CronologiaScreen` (Task 6), `RiepilogoSessioneScreen` (Task 7), `SignatureScreen` (Task 8), `RootStackParamList` (Task 6, già esteso con `Cronologia`/`RiepilogoSessione`/`Firma`).

- [ ] **Step 1: Sostituisci `app/App.tsx` per intero**

```tsx
import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator, useColorScheme } from 'react-native';
import { NavigationContainer, DefaultTheme, DarkTheme, Theme as NavTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { initDatabase } from './src/db/database';
import { useTheme, Theme } from './src/theme/colors';
import type { RootStackParamList } from './src/types/navigation';
import PropertiesScreen from './src/screens/PropertiesScreen';
import NewPropertyScreen from './src/screens/NewPropertyScreen';
import PropertyDetailScreen from './src/screens/PropertyDetailScreen';
import NewRoomScreen from './src/screens/NewRoomScreen';
import SessionScreen from './src/screens/SessionScreen';
import RoomCaptureScreen from './src/screens/RoomCaptureScreen';
import CronologiaScreen from './src/screens/CronologiaScreen';
import RiepilogoSessioneScreen from './src/screens/RiepilogoSessioneScreen';
import SignatureScreen from './src/screens/SignatureScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

function LoadingScreen({ theme, danger }: { theme: Theme; danger?: boolean }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.bg }}>
      <ActivityIndicator color={danger ? theme.danger : theme.accent} />
    </View>
  );
}

function AppNavigator() {
  const theme = useTheme();
  const scheme = useColorScheme();

  const baseNavTheme = scheme === 'light' ? DefaultTheme : DarkTheme;
  const navTheme: NavTheme = {
    ...baseNavTheme,
    colors: {
      ...baseNavTheme.colors,
      background: theme.bg,
      card: theme.surface,
      text: theme.text,
      border: theme.line,
      primary: theme.accent,
    },
  };

  return (
    <NavigationContainer theme={navTheme}>
      <StatusBar style={scheme === 'light' ? 'dark' : 'light'} />
      <Stack.Navigator screenOptions={{ headerShown: false }} initialRouteName="Proprieta">
        <Stack.Screen name="Proprieta" component={PropertiesScreen} />
        <Stack.Screen name="NuovaProprieta" component={NewPropertyScreen} options={{ presentation: 'modal' }} />
        <Stack.Screen name="DettaglioProprieta" component={PropertyDetailScreen} />
        <Stack.Screen name="NuovaStanza" component={NewRoomScreen} options={{ presentation: 'modal' }} />
        <Stack.Screen name="Sessione" component={SessionScreen} />
        <Stack.Screen name="CatturaStanza" component={RoomCaptureScreen} />
        <Stack.Screen name="Cronologia" component={CronologiaScreen} />
        <Stack.Screen name="RiepilogoSessione" component={RiepilogoSessioneScreen} />
        <Stack.Screen name="Firma" component={SignatureScreen} options={{ presentation: 'modal' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  const [ready, setReady] = useState(false);
  const [dbError, setDbError] = useState<string | null>(null);
  const theme = useTheme();

  useEffect(() => {
    initDatabase()
      .catch((err) => setDbError(String(err)))
      .finally(() => setReady(true));
  }, []);

  if (!ready) {
    return <LoadingScreen theme={theme} />;
  }

  if (dbError) {
    return <LoadingScreen theme={theme} danger />;
  }

  return <AppNavigator />;
}
```

- [ ] **Step 2: Verifica type-check e bundle**

```bash
npx tsc --noEmit
npx expo export --platform android
```

Expected: entrambi senza errori.

- [ ] **Step 3: Verifica manuale end-to-end su dispositivo Android reale**

Serve un dispositivo Android connesso via USB con Expo Go installato (stesso setup dei Piani 1-2). Avvia `npx expo start` da `app/` e apri l'app sul dispositivo, poi esercita a mano:

1. Apri una proprietà con almeno una sessione già completata (dal Piano 2) o completane una nuova adesso — Expected: nel dettaglio proprietà compare "Vedi cronologia sessioni →".
2. Tocca il link — Expected: si apre `CronologiaScreen` con l'elenco delle sessioni (tipo, data, stato "In corso"/"✓ Completata"), più recenti in cima.
3. Tocca una sessione completata — Expected: si apre `RiepilogoSessioneScreen` con l'elenco delle stanze (icona, nome, conteggio foto, nota se presente), e in fondo i pulsanti "Aggiungi firma" e "Genera PDF".
4. Tocca una stanza — Expected: si apre `CatturaStanza` (già esistente dal Piano 2) anche se la sessione è completata — conferma che una sessione completata resta modificabile. Aggiungi una foto, torna indietro — Expected: il conteggio foto in `RiepilogoSessioneScreen` si aggiorna.
5. Tocca "Genera PDF" — Expected: si apre il selettore di condivisione nativo di Android con un PDF; apri il PDF (es. con un lettore PDF o Google Drive) e verifica: intestazione con nome proprietà e tipo sessione, ogni stanza con le sue foto (o "Nessuna foto" se non ne ha), le note dove presenti, la riga sul verbale unilaterale in fondo (nessuna firma ancora), il disclaimer legale.
6. Torna a `RiepilogoSessioneScreen`, tocca "Aggiungi firma" — Expected: si apre `SignatureScreen` (canvas bianco, sfondo scuro/chiaro dell'app intorno).
7. Tocca "Salva firma" senza disegnare nulla — Expected: alert "Firma mancante".
8. Disegna una firma col dito, tocca "Cancella" — Expected: il canvas si svuota.
9. Disegna di nuovo, tocca "Salva firma" — Expected: torni a `RiepilogoSessioneScreen`, il pulsante "Aggiungi firma" è sparito, sostituito da "✓ Firma raccolta".
10. Tocca di nuovo "Genera PDF" — Expected: il nuovo PDF include l'immagine della firma appena raccolta, senza più la riga sul verbale unilaterale.
11. Chiudi e riapri l'app (force-stop + riavvio, come nei Piani 1-2) — Expected: cronologia, riepilogo, firma sopravvivono al riavvio.
12. Elimina la proprietà usata per il test — Expected: nessun crash; tornando alla lista proprietà, quella proprietà non c'è più.

Se un passaggio si comporta diversamente da quanto atteso, non procedere al commit: sistema il problema nel file interessato e ripeti la verifica.

- [ ] **Step 4: Commit**

```bash
git add app/App.tsx
git commit -m "Collega le schermate di cronologia, riepilogo e firma in App.tsx"
```

---

## Verifica finale del piano

Dopo il Task 9, il flusso principale della spec MVP (`mvp-design.md` §1) è completo: creare una proprietà e le sue stanze (Piano 1), documentare una sessione di check-in/check-out con foto e note per stanza (Piano 2), e generare un report PDF condivisibile con firma facoltativa dell'altra parte (Piano 3). Tutto locale, nessun server, nessun account.
