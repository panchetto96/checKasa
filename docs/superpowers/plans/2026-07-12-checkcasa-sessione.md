# CheckCasa — Sessione di documentazione (Piano 2/3) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aggiungere il flusso di sessione check-in/check-out: per ogni stanza della proprietà, l'utente scatta una o più foto e scrive una nota facoltativa; a fine giro la sessione viene marcata completata.

**Architecture:** Estende il Piano 1 (proprietà/stanze già esistenti). Aggiunge tre nuove entità SQLite (sessioni, foto, note) e due nuove schermate (checklist di sessione, cattura per singola stanza). Le foto scattate/scelte vengono copiate in una cartella locale stabile dell'app (stesso pattern di Quiete per l'audio), mai caricate altrove.

**Tech Stack:** Stesso stack del Piano 1 (Expo ~57, React 19.2.3, React Native 0.86.0, TypeScript strict). Aggiunge `expo-image-picker` ed `expo-file-system` (installati via `npx expo install`, non pinnati a mano — lascia che sia Expo a risolvere le versioni compatibili con l'SDK installato).

## Global Constraints

- Tutto quello del Piano 1 resta valido (stesso stack, nessun server/account, solo Android, italiano ovunque, snake_case↔camelCase con `rowToX`, `newId()` per gli ID).
- **Fuori perimetro per questo piano** (rimandato al Piano 3): generazione PDF del report, firma digitale, export/condivisione. Questo piano produce sessioni completate con foto e note salvate — non ancora esportabili.
- Le foto vivono in `${FileSystem.documentDirectory}foto/` (cartella dedicata, stesso pattern di `AUDIO_DIR` in Quiete), mai nella cache temporanea del picker.
- Una nota per stanza per sessione al massimo: la tabella `notes` ha un indice unico su `(session_id, room_id)`, gestito con `INSERT ... ON CONFLICT ... DO UPDATE` (stesso pattern usato da Quiete per `settings`). Se l'utente svuota il campo nota, la riga va cancellata, non lasciata vuota.
- Il completamento di una sessione è "morbido": se alcune stanze non hanno ancora foto, si avvisa con un Alert ma non si blocca — l'utente può completare comunque.
- Test automatici solo su logica pura (mirroring il Piano 1): il layer DB e gli screen si verificano manualmente su dispositivo reale, non con Jest.
- La cancellazione di una proprietà (già implementata nel Piano 1) deve continuare a cancellare tutto ciò che dipende da lei: ora include anche sessioni, foto e note — e i file immagine corrispondenti vanno rimossi dal disco, non solo le righe DB.

---

### Task 1: Installa `expo-image-picker` ed `expo-file-system`, configura i permessi

**Files:**
- Modify: `app/package.json` (dipendenze aggiunte da `npx expo install`, non a mano)
- Modify: `app/app.json`

**Interfaces:**
- Produces: `expo-image-picker` ed `expo-file-system` disponibili come dipendenze del progetto, con i permessi Android dichiarati.

- [ ] **Step 1: Installa le librerie con il tool di Expo (risolve automaticamente le versioni compatibili con l'SDK installato)**

```bash
cd app
npx expo install expo-image-picker expo-file-system
```

Expected: `package.json` si aggiorna con le nuove dipendenze (versioni scelte da Expo, coerenti con l'SDK ~57 già installato), `npm install` gira in automatico.

- [ ] **Step 2: Aggiungi la configurazione del plugin `expo-image-picker` in `app/app.json`**

Apri `app/app.json` e aggiungi questa voce all'array `plugins` esistente (che oggi contiene solo `"expo-sqlite"`), lasciando invariato il resto del file:

```json
"plugins": [
  "expo-sqlite",
  [
    "expo-image-picker",
    {
      "photosPermission": "CheckCasa accede alle tue foto per allegarle alla documentazione di check-in e check-out.",
      "cameraPermission": "CheckCasa usa la fotocamera per fotografare lo stato dell'immobile durante il check-in e il check-out.",
      "microphonePermission": false
    }
  ]
]
```

`microphonePermission: false` disattiva il permesso microfono che il plugin aggiungerebbe di default (CheckCasa non registra audio).

- [ ] **Step 3: Verifica**

```bash
npx tsc --noEmit
```

Expected: nessun errore.

- [ ] **Step 4: Commit**

```bash
git add app/package.json app/package-lock.json app/app.json
git commit -m "Installa expo-image-picker ed expo-file-system, configura i permessi"
```

---

### Task 2: Libreria foto locali

**Files:**
- Create: `app/src/lib/photos.ts`

**Interfaces:**
- Consumes: `expo-file-system/legacy` (già usato da Quiete con lo stesso sottopercorso, vedi Global Constraints del Piano 1 e `quiete-app/app/src/lib/paths.ts`).
- Produces:
  - `const PHOTOS_DIR: string`
  - `function savePickedPhoto(pickedUri: string): Promise<string>`
  - `function deletePhotoFile(uri: string): Promise<void>`

- [ ] **Step 1: Crea `app/src/lib/photos.ts`**

```ts
import * as FileSystem from 'expo-file-system/legacy';

/** Cartella locale dove vivono le foto delle sessioni di check-in/check-out. */
export const PHOTOS_DIR = `${FileSystem.documentDirectory}foto/`;

/** Copia la foto scattata/scelta (che vive in una cache temporanea) nella cartella stabile dell'app. */
export async function savePickedPhoto(pickedUri: string): Promise<string> {
  await FileSystem.makeDirectoryAsync(PHOTOS_DIR, { intermediates: true }).catch(() => {});
  const dest = `${PHOTOS_DIR}foto-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
  await FileSystem.copyAsync({ from: pickedUri, to: dest });
  return dest;
}

/** Rimuove il file di una foto dal disco. Non fallisce se il file non esiste più. */
export async function deletePhotoFile(uri: string): Promise<void> {
  await FileSystem.deleteAsync(uri, { idempotent: true });
}
```

Nessun test: sono chiamate dirette al file system nativo, non mockabili in modo significativo in `jest-expo` — stessa scelta già fatta per `src/db/database.ts` nel Piano 1.

- [ ] **Step 2: Verifica**

```bash
npx tsc --noEmit
```

Expected: nessun errore.

- [ ] **Step 3: Commit**

```bash
git add app/src/lib/photos.ts
git commit -m "Aggiunge la libreria per il salvataggio locale delle foto"
```

---

### Task 3: Modello dati sessione, foto e nota

**Files:**
- Create: `app/src/types/session.ts`

**Interfaces:**
- Produces:
  - `type SessionType = 'check-in' | 'check-out'`
  - `type SessionStatus = 'in_corso' | 'completata'`
  - `function sessionTypeLabel(type: SessionType): string`
  - `interface Session { id: string; propertyId: string; type: SessionType; status: SessionStatus; createdAt: string; completedAt?: string }`
  - `interface Photo { id: string; sessionId: string; roomId: string; uri: string; createdAt: string }`
  - `interface RoomNote { id: string; sessionId: string; roomId: string; text: string; createdAt: string }`

- [ ] **Step 1: Crea `app/src/types/session.ts`**

```ts
export type SessionType = 'check-in' | 'check-out';
export type SessionStatus = 'in_corso' | 'completata';

export function sessionTypeLabel(type: SessionType): string {
  return type === 'check-in' ? 'Check-in' : 'Check-out';
}

export interface Session {
  id: string;
  propertyId: string;
  type: SessionType;
  status: SessionStatus;
  createdAt: string;
  completedAt?: string;
}

export interface Photo {
  id: string;
  sessionId: string;
  roomId: string;
  uri: string;
  createdAt: string;
}

export interface RoomNote {
  id: string;
  sessionId: string;
  roomId: string;
  text: string;
  createdAt: string;
}
```

Nessun test: `sessionTypeLabel` è un ramo binario senza casi limite (a differenza di `roomTypeInfo` nel Piano 1, qui non c'è un valore "sconosciuto" da gestire — `SessionType` ha solo due valori possibili).

- [ ] **Step 2: Verifica**

```bash
npx tsc --noEmit
```

Expected: nessun errore.

- [ ] **Step 3: Commit**

```bash
git add app/src/types/session.ts
git commit -m "Aggiunge il modello dati di sessione, foto e nota"
```

---

### Task 4: Logica pura — stanze senza foto (TDD)

**Files:**
- Create: `app/src/lib/sessionProgress.ts`
- Test: `app/src/lib/sessionProgress.test.ts`

**Interfaces:**
- Consumes: `Room` da `../types/property` (Piano 1); `Photo` da `../types/session` (Task 3).
- Produces: `function roomsWithoutPhotos(rooms: Room[], photos: Photo[]): Room[]` — usata da `SessionScreen` (Task 7) per decidere se avvisare prima di completare la sessione.

- [ ] **Step 1: Scrivi il test (fallisce, il file `sessionProgress.ts` non esiste ancora)**

Crea `app/src/lib/sessionProgress.test.ts`:

```ts
import { roomsWithoutPhotos } from './sessionProgress';
import type { Room } from '../types/property';
import type { Photo } from '../types/session';

function room(id: string, name: string): Room {
  return { id, propertyId: 'p1', name, type: 'altro', createdAt: '2026-01-01T00:00:00.000Z' };
}

function photo(id: string, roomId: string): Photo {
  return { id, sessionId: 's1', roomId, uri: `file://${id}.jpg`, createdAt: '2026-01-01T00:00:00.000Z' };
}

describe('roomsWithoutPhotos', () => {
  it('restituisce tutte le stanze se non è stata scattata nessuna foto', () => {
    const rooms = [room('r1', 'Cucina'), room('r2', 'Bagno')];
    expect(roomsWithoutPhotos(rooms, [])).toEqual(rooms);
  });

  it('esclude le stanze che hanno almeno una foto', () => {
    const rooms = [room('r1', 'Cucina'), room('r2', 'Bagno')];
    const photos = [photo('f1', 'r1')];
    expect(roomsWithoutPhotos(rooms, photos)).toEqual([room('r2', 'Bagno')]);
  });

  it('restituisce un array vuoto se tutte le stanze hanno almeno una foto', () => {
    const rooms = [room('r1', 'Cucina'), room('r2', 'Bagno')];
    const photos = [photo('f1', 'r1'), photo('f2', 'r2'), photo('f3', 'r2')];
    expect(roomsWithoutPhotos(rooms, photos)).toEqual([]);
  });
});
```

- [ ] **Step 2: Esegui il test e verifica che fallisca**

```bash
npx jest src/lib/sessionProgress.test.ts
```

Expected: FAIL — `Cannot find module './sessionProgress'`.

- [ ] **Step 3: Implementa `app/src/lib/sessionProgress.ts`**

```ts
import type { Room } from '../types/property';
import type { Photo } from '../types/session';

/** Stanze che non hanno ancora nessuna foto in questa sessione. */
export function roomsWithoutPhotos(rooms: Room[], photos: Photo[]): Room[] {
  const roomIdsWithPhotos = new Set(photos.map((p) => p.roomId));
  return rooms.filter((r) => !roomIdsWithPhotos.has(r.id));
}
```

- [ ] **Step 4: Esegui il test e verifica che passi**

```bash
npx jest src/lib/sessionProgress.test.ts
```

Expected: PASS, 3 test superati.

- [ ] **Step 5: Commit**

```bash
git add app/src/lib/sessionProgress.ts app/src/lib/sessionProgress.test.ts
git commit -m "Aggiunge la logica per individuare le stanze senza foto"
```

---

### Task 5: Estensione del layer dati SQLite — sessioni, foto, note

**Files:**
- Modify: `app/src/db/database.ts`

**Interfaces:**
- Consumes: `Session`, `SessionType`, `SessionStatus`, `Photo`, `RoomNote` da `../types/session` (Task 3); `Room` da `../types/property` (Piano 1).
- Produces:
  - `function getRoom(id: string): Promise<Room | null>`
  - `function insertSession(session: Session): Promise<void>`
  - `function getInProgressSession(propertyId: string, type: SessionType): Promise<Session | null>`
  - `function getSession(id: string): Promise<Session | null>`
  - `function completeSession(id: string, completedAt: string): Promise<void>`
  - `function insertPhoto(photo: Photo): Promise<void>`
  - `function getPhotosForSession(sessionId: string): Promise<Photo[]>`
  - `function getPhotosForRoom(sessionId: string, roomId: string): Promise<Photo[]>`
  - `function deletePhoto(id: string): Promise<void>`
  - `function getPhotosForProperty(propertyId: string): Promise<Photo[]>`
  - `function upsertNote(note: RoomNote): Promise<void>`
  - `function deleteNoteForRoom(sessionId: string, roomId: string): Promise<void>`
  - `function getNotesForSession(sessionId: string): Promise<RoomNote[]>`
  - `function getNoteForRoom(sessionId: string, roomId: string): Promise<RoomNote | null>`
  - `deleteProperty` (esistente) modificata per cancellare a cascata sessioni/foto/note.

- [ ] **Step 1: Aggiungi l'import in cima al file, subito dopo l'import esistente di `../types/property`**

```ts
import { Session, SessionType, SessionStatus, Photo, RoomNote } from '../types/session';
```

- [ ] **Step 2: Sostituisci la funzione `initDatabase` esistente con questa versione estesa (aggiunge tre tabelle e un indice)**

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
  `);
}
```

- [ ] **Step 3: Aggiungi `getRoom`, subito dopo la funzione `getRoomsForProperty` esistente**

```ts
export async function getRoom(id: string): Promise<Room | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<RoomRow>('SELECT * FROM rooms WHERE id = ?', id);
  return row ? rowToRoom(row) : null;
}
```

- [ ] **Step 4: Sostituisci la funzione `deleteProperty` esistente con questa versione (cascata estesa a sessioni/foto/note)**

```ts
/** Elimina la proprietà, le sue stanze, e tutte le sessioni/foto/note collegate: SQLite qui non ha vincoli di FK a cascata. */
export async function deleteProperty(id: string): Promise<void> {
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM photos WHERE session_id IN (SELECT id FROM sessions WHERE property_id = ?)', id);
    await db.runAsync('DELETE FROM notes WHERE session_id IN (SELECT id FROM sessions WHERE property_id = ?)', id);
    await db.runAsync('DELETE FROM sessions WHERE property_id = ?', id);
    await db.runAsync('DELETE FROM rooms WHERE property_id = ?', id);
    await db.runAsync('DELETE FROM properties WHERE id = ?', id);
  });
}
```

- [ ] **Step 5: Aggiungi le funzioni per le sessioni alla fine del file**

```ts
interface SessionRow {
  id: string;
  property_id: string;
  type: string;
  status: string;
  created_at: string;
  completed_at: string | null;
}

function rowToSession(row: SessionRow): Session {
  return {
    id: row.id,
    propertyId: row.property_id,
    type: row.type as SessionType,
    status: row.status as SessionStatus,
    createdAt: row.created_at,
    completedAt: row.completed_at ?? undefined,
  };
}

export async function insertSession(session: Session): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO sessions (id, property_id, type, status, created_at, completed_at) VALUES (?, ?, ?, ?, ?, ?)`,
    session.id,
    session.propertyId,
    session.type,
    session.status,
    session.createdAt,
    session.completedAt ?? null
  );
}

/** Sessione dello stesso tipo già in corso per questa proprietà, se esiste — evita di aprirne una nuova ogni volta. */
export async function getInProgressSession(propertyId: string, type: SessionType): Promise<Session | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<SessionRow>(
    `SELECT * FROM sessions WHERE property_id = ? AND type = ? AND status = 'in_corso' ORDER BY created_at DESC LIMIT 1`,
    propertyId,
    type
  );
  return row ? rowToSession(row) : null;
}

export async function getSession(id: string): Promise<Session | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<SessionRow>('SELECT * FROM sessions WHERE id = ?', id);
  return row ? rowToSession(row) : null;
}

export async function completeSession(id: string, completedAt: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(`UPDATE sessions SET status = 'completata', completed_at = ? WHERE id = ?`, completedAt, id);
}
```

- [ ] **Step 6: Aggiungi le funzioni per le foto, subito dopo**

```ts
interface PhotoRow {
  id: string;
  session_id: string;
  room_id: string;
  uri: string;
  created_at: string;
}

function rowToPhoto(row: PhotoRow): Photo {
  return {
    id: row.id,
    sessionId: row.session_id,
    roomId: row.room_id,
    uri: row.uri,
    createdAt: row.created_at,
  };
}

export async function insertPhoto(photo: Photo): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO photos (id, session_id, room_id, uri, created_at) VALUES (?, ?, ?, ?, ?)`,
    photo.id,
    photo.sessionId,
    photo.roomId,
    photo.uri,
    photo.createdAt
  );
}

export async function getPhotosForSession(sessionId: string): Promise<Photo[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<PhotoRow>(
    'SELECT * FROM photos WHERE session_id = ? ORDER BY created_at ASC',
    sessionId
  );
  return rows.map(rowToPhoto);
}

export async function getPhotosForRoom(sessionId: string, roomId: string): Promise<Photo[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<PhotoRow>(
    'SELECT * FROM photos WHERE session_id = ? AND room_id = ? ORDER BY created_at ASC',
    sessionId,
    roomId
  );
  return rows.map(rowToPhoto);
}

export async function deletePhoto(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM photos WHERE id = ?', id);
}

/** Tutte le foto di tutte le sessioni di una proprietà — usata per ripulire i file quando la proprietà viene eliminata. */
export async function getPhotosForProperty(propertyId: string): Promise<Photo[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<PhotoRow>(
    `SELECT photos.* FROM photos
     JOIN sessions ON sessions.id = photos.session_id
     WHERE sessions.property_id = ?`,
    propertyId
  );
  return rows.map(rowToPhoto);
}
```

- [ ] **Step 7: Aggiungi le funzioni per le note, subito dopo**

```ts
interface NoteRow {
  id: string;
  session_id: string;
  room_id: string;
  text: string;
  created_at: string;
}

function rowToNote(row: NoteRow): RoomNote {
  return {
    id: row.id,
    sessionId: row.session_id,
    roomId: row.room_id,
    text: row.text,
    createdAt: row.created_at,
  };
}

/** Crea o aggiorna la nota di una stanza in una sessione: al più una nota per coppia (sessione, stanza). */
export async function upsertNote(note: RoomNote): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO notes (id, session_id, room_id, text, created_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(session_id, room_id) DO UPDATE SET text = excluded.text`,
    note.id,
    note.sessionId,
    note.roomId,
    note.text,
    note.createdAt
  );
}

export async function deleteNoteForRoom(sessionId: string, roomId: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM notes WHERE session_id = ? AND room_id = ?', sessionId, roomId);
}

export async function getNotesForSession(sessionId: string): Promise<RoomNote[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<NoteRow>('SELECT * FROM notes WHERE session_id = ?', sessionId);
  return rows.map(rowToNote);
}

export async function getNoteForRoom(sessionId: string, roomId: string): Promise<RoomNote | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<NoteRow>(
    'SELECT * FROM notes WHERE session_id = ? AND room_id = ?',
    sessionId,
    roomId
  );
  return row ? rowToNote(row) : null;
}
```

Nessun test automatico per queste funzioni (native SQLite, stessa scelta del Piano 1) — si verificano manualmente nel Task 9.

- [ ] **Step 8: Verifica**

```bash
npx tsc --noEmit
```

Expected: nessun errore.

- [ ] **Step 9: Commit**

```bash
git add app/src/db/database.ts
git commit -m "Estende il layer dati SQLite con sessioni, foto e note"
```

---

### Task 6: Navigazione e avvio sessione da `PropertyDetailScreen`

**Files:**
- Modify: `app/src/types/navigation.ts`
- Modify: `app/src/screens/PropertyDetailScreen.tsx`

**Interfaces:**
- Consumes: `getInProgressSession`, `insertSession`, `getPhotosForProperty`, `deleteProperty` (Task 5); `deletePhotoFile` (Task 2); `SessionType` (Task 3); `newId` (Piano 1).
- Produces: due nuove route in `RootStackParamList` (`Sessione`, `CatturaStanza`), usate da `App.tsx` (Task 9) e da `SessionScreen`/`RoomCaptureScreen` (Task 7, 8).

- [ ] **Step 1: Sostituisci `app/src/types/navigation.ts`**

```ts
export type RootStackParamList = {
  Proprieta: undefined;
  NuovaProprieta: undefined;
  DettaglioProprieta: { id: string };
  NuovaStanza: { propertyId: string };
  Sessione: { sessionId: string };
  CatturaStanza: { sessionId: string; roomId: string };
};
```

- [ ] **Step 2: Sostituisci `app/src/screens/PropertyDetailScreen.tsx` per intero**

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
} from '../db/database';
import { roomTypeInfo } from '../types/property';
import type { Property, Room } from '../types/property';
import type { SessionType } from '../types/session';
import { newId } from '../lib/id';
import { deletePhotoFile } from '../lib/photos';
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
          const photos = await getPhotosForProperty(id);
          await deleteProperty(id);
          await Promise.all(photos.map((photo) => deletePhotoFile(photo.uri)));
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
    sessionButtons: { flexDirection: 'row', gap: 10, paddingHorizontal: 20, marginBottom: 16 },
    sessionBtn: {
      flex: 1,
      backgroundColor: theme.accent,
      borderRadius: 12,
      paddingVertical: 14,
      alignItems: 'center',
    },
    sessionBtnDisabled: { opacity: 0.6 },
    sessionBtnText: { color: theme.accentInk, fontSize: 14, fontWeight: '700' },
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

Il cambiamento rispetto al Piano 1: `confirmDeleteProperty` ora recupera le foto della proprietà prima di cancellarla, e le rimuove dal disco dopo la cancellazione DB (best-effort, in parallelo). `startSession` riusa una sessione dello stesso tipo già in corso invece di crearne una nuova ogni volta che si preme il pulsante.

- [ ] **Step 3: Verifica**

```bash
npx tsc --noEmit
```

Expected: nessun errore (le route `Sessione`/`CatturaStanza` non hanno ancora uno screen assegnato in `App.tsx` — va bene, viene cablato nel Task 9).

- [ ] **Step 4: Commit**

```bash
git add app/src/types/navigation.ts app/src/screens/PropertyDetailScreen.tsx
git commit -m "Aggiunge l'avvio di una sessione di check-in/check-out dal dettaglio proprietà"
```

---

### Task 7: `SessionScreen` — checklist delle stanze e completamento sessione

**Files:**
- Create: `app/src/screens/SessionScreen.tsx`

**Interfaces:**
- Consumes: `getSession`, `getProperty`, `getRoomsForProperty`, `getPhotosForSession`, `completeSession` (Task 5); `roomsWithoutPhotos` (Task 4); `sessionTypeLabel` (Task 3); `roomTypeInfo` (Piano 1); `RootStackParamList` (Task 6).
- Produces: componente `SessionScreen` (default export), usato da `App.tsx` (Task 9). Naviga verso `CatturaStanza: { sessionId, roomId }` (Task 8).

- [ ] **Step 1: Crea `app/src/screens/SessionScreen.tsx`**

```tsx
import React, { useCallback, useState } from 'react';
import { View, Text, FlatList, Pressable, StyleSheet, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTheme, Theme } from '../theme/colors';
import { getSession, getProperty, getRoomsForProperty, getPhotosForSession, completeSession } from '../db/database';
import { roomTypeInfo } from '../types/property';
import type { Property, Room } from '../types/property';
import type { Session, Photo } from '../types/session';
import { sessionTypeLabel } from '../types/session';
import { roomsWithoutPhotos } from '../lib/sessionProgress';
import type { RootStackParamList } from '../types/navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'Sessione'>;

export default function SessionScreen({ navigation, route }: Props) {
  const theme = useTheme();
  const styles = makeStyles(theme);
  const { sessionId } = route.params;
  const [session, setSession] = useState<Session | null>(null);
  const [property, setProperty] = useState<Property | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [completing, setCompleting] = useState(false);

  const load = useCallback(async () => {
    const loadedSession = await getSession(sessionId);
    if (!loadedSession) return;
    const [loadedProperty, loadedRooms, loadedPhotos] = await Promise.all([
      getProperty(loadedSession.propertyId),
      getRoomsForProperty(loadedSession.propertyId),
      getPhotosForSession(sessionId),
    ]);
    setSession(loadedSession);
    setProperty(loadedProperty);
    setRooms(loadedRooms);
    setPhotos(loadedPhotos);
  }, [sessionId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  function photoCountForRoom(roomId: string): number {
    return photos.filter((p) => p.roomId === roomId).length;
  }

  async function finishCompletion() {
    setCompleting(true);
    try {
      await completeSession(sessionId, new Date().toISOString());
      navigation.goBack();
    } finally {
      setCompleting(false);
    }
  }

  function handleComplete() {
    if (completing) return;
    const missing = roomsWithoutPhotos(rooms, photos);
    if (missing.length > 0) {
      Alert.alert(
        'Alcune stanze non hanno foto',
        `${missing.map((r) => r.name).join(', ')} — vuoi completare comunque la sessione?`,
        [
          { text: 'Annulla', style: 'cancel' },
          { text: 'Completa comunque', style: 'destructive', onPress: finishCompletion },
        ]
      );
      return;
    }
    finishCompletion();
  }

  if (!session || !property) {
    return <View style={styles.container} />;
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{sessionTypeLabel(session.type)}</Text>
        <Text style={styles.subtitle}>{property.name}</Text>
      </View>

      <FlatList
        data={rooms}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => {
          const info = roomTypeInfo(item.type);
          const count = photoCountForRoom(item.id);
          return (
            <Pressable
              style={styles.row}
              onPress={() => navigation.navigate('CatturaStanza', { sessionId, roomId: item.id })}
            >
              <Text style={styles.rowIcon}>{info.icon}</Text>
              <View style={styles.rowBody}>
                <Text style={styles.rowTitle}>{item.name}</Text>
                <Text style={count > 0 ? styles.rowMetaDone : styles.rowMeta}>
                  {count > 0 ? `✓ ${count} foto` : 'Nessuna foto ancora'}
                </Text>
              </View>
            </Pressable>
          );
        }}
      />

      <Pressable
        style={[styles.completeBtn, completing && styles.completeBtnDisabled]}
        onPress={handleComplete}
        disabled={completing}
      >
        <Text style={styles.completeBtnText}>{completing ? 'Completamento...' : 'Completa sessione'}</Text>
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
    list: { paddingHorizontal: 20, paddingBottom: 120 },
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
    completeBtn: {
      position: 'absolute',
      left: 20,
      right: 20,
      bottom: 32,
      backgroundColor: theme.accent,
      borderRadius: 12,
      paddingVertical: 16,
      alignItems: 'center',
    },
    completeBtnDisabled: { opacity: 0.6 },
    completeBtnText: { color: theme.accentInk, fontSize: 16, fontWeight: '700' },
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
git add app/src/screens/SessionScreen.tsx
git commit -m "Aggiunge la schermata di sessione con checklist delle stanze"
```

---

### Task 8: `RoomCaptureScreen` — foto e nota per una singola stanza

**Files:**
- Create: `app/src/screens/RoomCaptureScreen.tsx`

**Interfaces:**
- Consumes: `getRoom`, `getPhotosForRoom`, `insertPhoto`, `deletePhoto`, `getNoteForRoom`, `upsertNote`, `deleteNoteForRoom` (Task 5); `savePickedPhoto`, `deletePhotoFile` (Task 2); `newId` (Piano 1); `roomTypeInfo` (Piano 1); `RootStackParamList` (Task 6).
- Produces: componente `RoomCaptureScreen` (default export), usato da `App.tsx` (Task 9).

- [ ] **Step 1: Crea `app/src/screens/RoomCaptureScreen.tsx`**

```tsx
import React, { useCallback, useState } from 'react';
import { View, Text, Image, FlatList, Pressable, TextInput, StyleSheet, ScrollView, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTheme, Theme } from '../theme/colors';
import {
  getRoom,
  getPhotosForRoom,
  insertPhoto,
  deletePhoto,
  getNoteForRoom,
  upsertNote,
  deleteNoteForRoom,
} from '../db/database';
import { roomTypeInfo } from '../types/property';
import type { Room } from '../types/property';
import type { Photo } from '../types/session';
import { newId } from '../lib/id';
import { savePickedPhoto, deletePhotoFile } from '../lib/photos';
import type { RootStackParamList } from '../types/navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'CatturaStanza'>;

export default function RoomCaptureScreen({ navigation, route }: Props) {
  const theme = useTheme();
  const styles = makeStyles(theme);
  const { sessionId, roomId } = route.params;
  const [room, setRoom] = useState<Room | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [note, setNote] = useState('');
  const [capturing, setCapturing] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const [loadedRoom, loadedPhotos, loadedNote] = await Promise.all([
      getRoom(roomId),
      getPhotosForRoom(sessionId, roomId),
      getNoteForRoom(sessionId, roomId),
    ]);
    setRoom(loadedRoom);
    setPhotos(loadedPhotos);
    setNote(loadedNote?.text ?? '');
  }, [sessionId, roomId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function addPhotoFrom(source: 'camera' | 'library') {
    if (capturing) return;
    setCapturing(true);
    try {
      const permission =
        source === 'camera'
          ? await ImagePicker.requestCameraPermissionsAsync()
          : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          source === 'camera' ? 'Permesso fotocamera necessario' : 'Permesso galleria necessario',
          'CheckCasa ha bisogno di questo permesso per allegare una foto alla documentazione. Puoi attivarlo dalle impostazioni del telefono.'
        );
        return;
      }
      const result =
        source === 'camera'
          ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.7 })
          : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 });
      if (result.canceled || !result.assets[0]) return;
      const uri = await savePickedPhoto(result.assets[0].uri);
      await insertPhoto({ id: newId(), sessionId, roomId, uri, createdAt: new Date().toISOString() });
      await load();
    } catch (err) {
      Alert.alert('Errore', 'Non è stato possibile aggiungere la foto. Riprova.');
    } finally {
      setCapturing(false);
    }
  }

  function confirmDeletePhoto(photo: Photo) {
    Alert.alert('Rimuovi foto', 'Rimuovere questa foto dalla documentazione?', [
      { text: 'Annulla', style: 'cancel' },
      {
        text: 'Rimuovi',
        style: 'destructive',
        onPress: async () => {
          await deletePhoto(photo.id);
          await deletePhotoFile(photo.uri);
          await load();
        },
      },
    ]);
  }

  async function handleDone() {
    if (saving) return;
    setSaving(true);
    try {
      const trimmed = note.trim();
      if (trimmed) {
        await upsertNote({ id: newId(), sessionId, roomId, text: trimmed, createdAt: new Date().toISOString() });
      } else {
        await deleteNoteForRoom(sessionId, roomId);
      }
      navigation.goBack();
    } finally {
      setSaving(false);
    }
  }

  if (!room) {
    return <View style={styles.container} />;
  }

  const info = roomTypeInfo(room.type);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.screenTitle}>
        {info.icon} {room.name}
      </Text>

      <Text style={styles.label}>Foto</Text>
      {photos.length === 0 ? (
        <Text style={styles.hint}>Nessuna foto ancora per questa stanza.</Text>
      ) : (
        <FlatList
          data={photos}
          keyExtractor={(item) => item.id}
          horizontal
          contentContainerStyle={styles.photoList}
          renderItem={({ item }) => (
            <Pressable style={styles.photoThumb} onPress={() => confirmDeletePhoto(item)}>
              <Image source={{ uri: item.uri }} style={styles.photoImage} />
              <Text style={styles.photoRemove}>🗑</Text>
            </Pressable>
          )}
        />
      )}

      <View style={styles.captureButtons}>
        <Pressable
          style={[styles.captureBtn, capturing && styles.captureBtnDisabled]}
          onPress={() => addPhotoFrom('camera')}
          disabled={capturing}
        >
          <Text style={styles.captureBtnText}>📷 Scatta foto</Text>
        </Pressable>
        <Pressable
          style={[styles.captureBtn, capturing && styles.captureBtnDisabled]}
          onPress={() => addPhotoFrom('library')}
          disabled={capturing}
        >
          <Text style={styles.captureBtnText}>🖼 Scegli dalla galleria</Text>
        </Pressable>
      </View>

      <Text style={styles.label}>Nota (facoltativa)</Text>
      <TextInput
        style={styles.textArea}
        placeholder='Es. "graffio sul parquet già presente"'
        placeholderTextColor={theme.muted}
        multiline
        numberOfLines={3}
        value={note}
        onChangeText={setNote}
      />

      <Pressable style={[styles.doneBtn, saving && styles.doneBtnDisabled]} onPress={handleDone} disabled={saving}>
        <Text style={styles.doneBtnText}>{saving ? 'Salvataggio...' : 'Fatto'}</Text>
      </Pressable>
    </ScrollView>
  );
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.bg },
    content: { padding: 20, paddingTop: 60, paddingBottom: 60 },
    screenTitle: { fontSize: 22, fontWeight: '700', color: theme.text, marginBottom: 8 },
    label: { color: theme.text, fontSize: 15, fontWeight: '700', marginTop: 24, marginBottom: 10 },
    hint: { color: theme.muted, fontSize: 13 },
    photoList: { gap: 10 },
    photoThumb: { width: 96, height: 96, borderRadius: 10, overflow: 'hidden', position: 'relative' },
    photoImage: { width: '100%', height: '100%' },
    photoRemove: {
      position: 'absolute',
      right: 4,
      top: 4,
      backgroundColor: 'rgba(0,0,0,0.55)',
      color: '#FFFFFF',
      fontSize: 12,
      paddingHorizontal: 4,
      borderRadius: 6,
    },
    captureButtons: { flexDirection: 'row', gap: 10, marginTop: 12 },
    captureBtn: {
      flex: 1,
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.line,
      borderRadius: 12,
      paddingVertical: 14,
      alignItems: 'center',
    },
    captureBtnDisabled: { opacity: 0.6 },
    captureBtnText: { color: theme.text, fontSize: 13, fontWeight: '600' },
    textArea: {
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.line,
      borderRadius: 12,
      padding: 14,
      color: theme.text,
      fontSize: 14,
      textAlignVertical: 'top',
      minHeight: 80,
    },
    doneBtn: {
      backgroundColor: theme.accent,
      borderRadius: 12,
      padding: 16,
      alignItems: 'center',
      marginTop: 32,
    },
    doneBtnDisabled: { opacity: 0.6 },
    doneBtnText: { color: theme.accentInk, fontSize: 16, fontWeight: '700' },
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
git add app/src/screens/RoomCaptureScreen.tsx
git commit -m "Aggiunge la cattura foto e nota per singola stanza"
```

---

### Task 9: Cablaggio in `App.tsx` e verifica manuale end-to-end

**Files:**
- Modify: `app/App.tsx`

**Interfaces:**
- Consumes: `SessionScreen` (Task 7), `RoomCaptureScreen` (Task 8), `RootStackParamList` (Task 6, già esteso con `Sessione`/`CatturaStanza`).

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

Expected: entrambi senza errori (`expo export` bundla con successo, confermando che ogni import si risolve e nessun modulo lancia eccezioni in fase di valutazione).

- [ ] **Step 3: Verifica manuale end-to-end su dispositivo Android reale**

Serve un dispositivo Android connesso via USB con Expo Go installato (stesso setup del Piano 1). Avvia `npx expo start` da `app/` e apri l'app sul dispositivo, poi esercita a mano:

1. Apri una proprietà con almeno una stanza (o creane una) — Expected: compaiono i pulsanti "Inizia check-in" e "Inizia check-out" sopra la lista stanze.
2. Tocca "Inizia check-in" — Expected: si apre `SessionScreen` con titolo "Check-in", nome proprietà, e la checklist delle stanze, tutte con "Nessuna foto ancora".
3. Tocca una stanza — Expected: si apre `RoomCaptureScreen` con nome/icona della stanza, nessuna foto, nessuna nota.
4. Tocca "📷 Scatta foto" — concedi il permesso fotocamera se richiesto — scatta una foto — Expected: la foto compare come miniatura nella lista orizzontale.
5. Tocca "🖼 Scegli dalla galleria" — scegli un'immagine esistente — Expected: anche questa compare come seconda miniatura.
6. Scrivi una nota (es. "graffio sul parquet") e tocca "Fatto" — Expected: torni a `SessionScreen`, la stanza ora mostra "✓ 2 foto".
7. Tocca 🗑 su una delle miniature in `RoomCaptureScreen` (rientrando nella stanza) — conferma — Expected: la foto sparisce, il conteggio in `SessionScreen` scende a 1 dopo il ritorno.
8. Torna a `SessionScreen` senza documentare tutte le stanze, tocca "Completa sessione" — Expected: appare un Alert che elenca le stanze senza foto, con "Annulla" e "Completa comunque".
9. Tocca "Completa comunque" — Expected: torni a `PropertyDetailScreen`.
10. Tocca di nuovo "Inizia check-in" sulla stessa proprietà — Expected: dato che la sessione precedente è "completata", ne viene creata una nuova (non riprendi quella di prima) con la checklist di nuovo vuota.
11. Tocca "Inizia check-out" — Expected: si apre una sessione check-out separata (tipo diverso), la checklist è vuota indipendentemente dal check-in appena fatto.
12. Torna indietro senza completare, poi tocca di nuovo "Inizia check-out" sulla stessa proprietà — Expected: riprendi la STESSA sessione check-out in corso (non se ne crea una seconda) — verificabile perché le foto eventualmente aggiunte prima sono ancora lì.
13. Chiudi e riapri l'app (force-stop + riavvio, come nel Piano 1) — Expected: sessioni, foto e note sopravvivono al riavvio.
14. Elimina la proprietà usata per il test — Expected: nessun crash; tornando alla lista proprietà, quella proprietà non c'è più.

Se un passaggio si comporta diversamente da quanto atteso, non procedere al commit: sistema il problema nel file interessato e ripeti la verifica.

- [ ] **Step 4: Commit**

```bash
git add app/App.tsx
git commit -m "Collega le schermate di sessione in App.tsx"
```

---

## Verifica finale del piano

Dopo il Task 9, per ogni proprietà con almeno una stanza si può avviare un check-in o un check-out, documentare ogni stanza con una o più foto e una nota facoltativa, e completare la sessione (con avviso, non blocco, se qualche stanza è rimasta senza foto). Tutto persistito su SQLite locale e file system locale, nessun server. Questo copre la sezione "Sessione di documentazione" del flusso principale (§1 della spec di design) esclusi generazione PDF e firma, che restano al Piano 3.
