# CheckCasa — Fondamenta (Piano 1/3) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Creare il progetto Expo/React Native di CheckCasa con lo stesso stack di Quiete, il layer dati SQLite locale, e le schermate per gestire proprietà e stanze (setup che precede ogni sessione di check-in/check-out).

**Architecture:** App React Native/Expo, solo Android, nessun server/account — tutti i dati su SQLite locale via `expo-sqlite`, stesso principio di Quiete (`../quiete-app/app`). Navigazione con React Navigation (native-stack). Le schermate leggono/scrivono tramite funzioni async in `src/db/database.ts`, mai SQL diretto nei componenti.

**Tech Stack:** Expo SDK ~57 (React Native 0.86, React 19.2.x), TypeScript ~6.0.3 in modalità strict, `expo-sqlite`, `@react-navigation/native` + `native-stack`, Jest (`jest-expo`) per la logica pura.

**Cosa NON copre questo piano** (rimandato ai piani 2 e 3, vedi `docs/superpowers/specs/2026-07-12-checkcasa-mvp-design.md`): cattura foto, sessioni di check-in/check-out, generazione PDF, firma digitale. A fine piano l'app permette solo di creare proprietà e le loro stanze — è comunque software funzionante e verificabile, non uno scheletro vuoto.

## Global Constraints

- Stesso stack di Quiete: Expo ~57.0.4, React 19.2.3, React Native 0.86.0, TypeScript ~6.0.3 strict — versioni esatte prese da `../quiete-app/app/package.json`.
- Nessun server, nessun account: unica persistenza è SQLite locale (`expo-sqlite`).
- Target: solo Android (niente funzionalità o test specifici iOS).
- Tutti i testi in-app, i commenti e i messaggi di commit sono in italiano.
- Test automatici solo su logica pura (mapping, lookup, validazioni). DB layer e screen NON si testano con Jest — mirroring la scelta di Quiete, dove `expo-sqlite` non è mockabile in `jest-expo` in modo affidabile — si verificano avviando l'app (`npx expo start`) ed esercitando il flusso a mano.
- Nomenclatura DB: colonne `snake_case`, tipi TypeScript `camelCase`, con funzioni `rowToX` di mappatura esplicita (pattern identico a `quiete-app/app/src/db/database.ts`).
- ID: stringhe generate con `newId()` (`${Date.now()}-${Math.random().toString(36).slice(2, 8)}`), stesso pattern di Quiete — niente libreria uuid esterna.

---

### Task 1: Scaffold del progetto Expo, allineato allo stack di Quiete

**Files:**
- Create: `app/` (intero progetto, via `create-expo-app`)
- Modify: `app/package.json`
- Modify: `app/tsconfig.json`
- Modify: `app/app.json`

**Interfaces:**
- Produces: progetto Expo avviabile con `npx expo start`, TypeScript strict configurato, `expo-sqlite` installato e dichiarato come plugin.

- [ ] **Step 1: Genera il progetto**

Dalla radice del repo (`checkcasa/`):

```bash
npx create-expo-app@latest app --template blank-typescript
```

Expected: viene creata la cartella `app/` con `App.tsx`, `index.ts`, `app.json`, `package.json`, `tsconfig.json`, `assets/`, `.gitignore`.

- [ ] **Step 2: Sostituisci `app/package.json`** con le versioni allineate a Quiete (stesse dipendenze di `../quiete-app/app/package.json`, solo il sottoinsieme necessario a questo piano — le altre, es. `expo-print`/`expo-sharing`/`expo-camera`, arriveranno nei piani 2 e 3):

```json
{
  "name": "app",
  "version": "1.0.0",
  "main": "index.ts",
  "dependencies": {
    "@react-navigation/native": "^7.3.8",
    "@react-navigation/native-stack": "^7.17.10",
    "expo": "~57.0.4",
    "expo-asset": "~57.0.3",
    "expo-constants": "~57.0.3",
    "expo-sqlite": "~57.0.0",
    "expo-status-bar": "~57.0.0",
    "react": "19.2.3",
    "react-native": "0.86.0",
    "react-native-safe-area-context": "~5.7.0",
    "react-native-screens": "4.25.2"
  },
  "devDependencies": {
    "@types/jest": "^30.0.0",
    "@types/react": "~19.2.2",
    "jest": "^29.7.0",
    "jest-expo": "^57.0.1",
    "typescript": "~6.0.3"
  },
  "scripts": {
    "start": "expo start",
    "android": "expo run:android",
    "web": "expo start --web",
    "test": "jest"
  },
  "private": true,
  "jest": {
    "preset": "jest-expo"
  }
}
```

- [ ] **Step 3: Sostituisci `app/tsconfig.json`**:

```json
{
  "extends": "expo/tsconfig.base",
  "compilerOptions": {
    "strict": true,
    "types": ["jest"]
  }
}
```

- [ ] **Step 4: Modifica `app/app.json`** — apri il file generato dal template e aggiorna questi campi, lasciando invariati i percorsi delle icone/asset già generati dal template:

```json
{
  "expo": {
    "name": "CheckCasa",
    "slug": "checkcasa",
    "scheme": "checkcasa",
    "version": "0.1.0",
    "orientation": "portrait",
    "userInterfaceStyle": "automatic",
    "android": {
      "package": "app.checkcasa.ispezioni"
    },
    "plugins": ["expo-sqlite"]
  }
}
```

Mantieni invariate le chiavi `icon`, `splash`, `ios`, `web` così come generate dal template — vanno personalizzate solo in un secondo momento (naming/branding, vedi §5 della spec).

- [ ] **Step 5: Installa le dipendenze**

```bash
cd app
npm install
```

Expected: `npm install` termina senza errori, viene creato/aggiornato `package-lock.json`.

- [ ] **Step 6: Verifica il type-check**

```bash
npx tsc --noEmit
```

Expected: nessun errore.

- [ ] **Step 7: Commit**

```bash
git add app
git commit -m "Inizializza progetto Expo con lo stack di Quiete (SQLite, React Navigation)"
```

---

### Task 2: Tema colori chiaro/scuro

**Files:**
- Create: `app/src/theme/colors.ts`

**Interfaces:**
- Produces: `useTheme(): Theme` (hook), `Theme` (type) — usati da ogni schermata per gli stili.

- [ ] **Step 1: Crea `app/src/theme/colors.ts`**

```ts
import { useColorScheme } from 'react-native';

// Palette placeholder: coerente nella forma con quella di Quiete (stessi token),
// ma colori propri di CheckCasa. Va rivista con una passata di design dedicata
// prima del lancio pubblico — non blocca lo sviluppo dell'MVP.
const dark = {
  bg: '#10151B',
  surface: '#171F29',
  surface2: '#1E2733',
  text: '#E7EAEE',
  muted: '#93A0AC',
  accent: '#3FA796',
  accentInk: '#06201C',
  line: '#26313D',
  danger: '#E5484D',
};

const light = {
  bg: '#F5F6F4',
  surface: '#FFFFFF',
  surface2: '#ECEFEE',
  text: '#14181C',
  muted: '#5B6670',
  accent: '#1F7A6C',
  accentInk: '#FFFFFF',
  line: '#DCE1E0',
  danger: '#C4302B',
};

export type Theme = typeof dark;

export function useTheme(): Theme {
  const scheme = useColorScheme();
  return scheme === 'light' ? light : dark;
}
```

Nessun test: sono costanti e un hook che legge `useColorScheme()`, non testabile in modo significativo senza rendering — stessa scelta di Quiete (`quiete-app/app/src/theme/colors.ts` non ha test).

- [ ] **Step 2: Verifica**

```bash
npx tsc --noEmit
```

Expected: nessun errore.

- [ ] **Step 3: Commit**

```bash
git add app/src/theme/colors.ts
git commit -m "Aggiunge tema colori chiaro/scuro"
```

---

### Task 3: Modello dati e tipi di stanza preimpostati (TDD)

**Files:**
- Create: `app/src/types/property.ts`
- Test: `app/src/types/property.test.ts`

**Interfaces:**
- Produces:
  - `type RoomType = 'camera' | 'bagno' | 'cucina' | 'soggiorno' | 'balcone' | 'altro'`
  - `interface RoomTypeInfo { value: RoomType; label: string; icon: string }`
  - `const ROOM_TYPES: RoomTypeInfo[]`
  - `function roomTypeInfo(type: RoomType): RoomTypeInfo`
  - `interface Property { id: string; name: string; address?: string; createdAt: string }`
  - `interface Room { id: string; propertyId: string; name: string; type: RoomType; createdAt: string }`

- [ ] **Step 1: Scrivi il test (fallisce, il file `property.ts` non esiste ancora)**

Crea `app/src/types/property.test.ts`:

```ts
import { roomTypeInfo, ROOM_TYPES } from './property';
import type { RoomType } from './property';

describe('roomTypeInfo', () => {
  it('trova la label corretta per ogni tipo preimpostato', () => {
    expect(roomTypeInfo('camera').label).toBe('Camera da letto');
    expect(roomTypeInfo('bagno').label).toBe('Bagno');
    expect(roomTypeInfo('cucina').label).toBe('Cucina');
    expect(roomTypeInfo('soggiorno').label).toBe('Soggiorno');
    expect(roomTypeInfo('balcone').label).toBe('Balcone/Terrazzo');
  });

  it('ricade su "Altro" per un tipo non riconosciuto (es. dato corrotto nel database)', () => {
    const unknown = 'ripostiglio' as RoomType;
    expect(roomTypeInfo(unknown)).toBe(ROOM_TYPES[ROOM_TYPES.length - 1]);
    expect(roomTypeInfo(unknown).label).toBe('Altro');
  });
});
```

- [ ] **Step 2: Esegui il test e verifica che fallisca**

```bash
npx jest src/types/property.test.ts
```

Expected: FAIL — `Cannot find module './property'`.

- [ ] **Step 3: Implementa `app/src/types/property.ts`**

```ts
export type RoomType = 'camera' | 'bagno' | 'cucina' | 'soggiorno' | 'balcone' | 'altro';

export interface RoomTypeInfo {
  value: RoomType;
  label: string;
  icon: string;
}

export const ROOM_TYPES: RoomTypeInfo[] = [
  { value: 'camera', label: 'Camera da letto', icon: '\u{1F6CF}\u{FE0F}' },
  { value: 'bagno', label: 'Bagno', icon: '\u{1F6BF}' },
  { value: 'cucina', label: 'Cucina', icon: '\u{1F373}' },
  { value: 'soggiorno', label: 'Soggiorno', icon: '\u{1F6CB}\u{FE0F}' },
  { value: 'balcone', label: 'Balcone/Terrazzo', icon: '\u{1F33F}' },
  { value: 'altro', label: 'Altro', icon: '\u{1F6AA}' },
];

export function roomTypeInfo(type: RoomType): RoomTypeInfo {
  return ROOM_TYPES.find((t) => t.value === type) ?? ROOM_TYPES[ROOM_TYPES.length - 1];
}

export interface Property {
  id: string;
  name: string;
  address?: string;
  createdAt: string;
}

export interface Room {
  id: string;
  propertyId: string;
  name: string;
  type: RoomType;
  createdAt: string;
}
```

- [ ] **Step 4: Esegui il test e verifica che passi**

```bash
npx jest src/types/property.test.ts
```

Expected: PASS, 2 test superati.

- [ ] **Step 5: Commit**

```bash
git add app/src/types/property.ts app/src/types/property.test.ts
git commit -m "Aggiunge modello dati e tipi di stanza preimpostati"
```

---

### Task 4: Layer dati SQLite — proprietà e stanze

**Files:**
- Create: `app/src/db/database.ts`

**Interfaces:**
- Consumes: `Property`, `Room`, `RoomType` da `../types/property` (Task 3).
- Produces:
  - `function initDatabase(): Promise<void>`
  - `function insertProperty(property: Property): Promise<void>`
  - `function getAllProperties(): Promise<Property[]>`
  - `function getProperty(id: string): Promise<Property | null>`
  - `function deleteProperty(id: string): Promise<void>` (elimina anche le stanze collegate)
  - `function insertRoom(room: Room): Promise<void>`
  - `function getRoomsForProperty(propertyId: string): Promise<Room[]>`
  - `function deleteRoom(id: string): Promise<void>`

- [ ] **Step 1: Crea `app/src/db/database.ts`**

```ts
import * as SQLite from 'expo-sqlite';
import { Property, Room, RoomType } from '../types/property';

// Nome file locale sul dispositivo: nessuna sincronizzazione, nessun server.
export const DB_NAME = 'checkcasa.db';

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = SQLite.openDatabaseAsync(DB_NAME);
  }
  return dbPromise;
}

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
  `);
}

interface PropertyRow {
  id: string;
  name: string;
  address: string | null;
  created_at: string;
}

function rowToProperty(row: PropertyRow): Property {
  return {
    id: row.id,
    name: row.name,
    address: row.address ?? undefined,
    createdAt: row.created_at,
  };
}

export async function insertProperty(property: Property): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO properties (id, name, address, created_at) VALUES (?, ?, ?, ?)`,
    property.id,
    property.name,
    property.address ?? null,
    property.createdAt
  );
}

export async function getAllProperties(): Promise<Property[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<PropertyRow>('SELECT * FROM properties ORDER BY created_at DESC');
  return rows.map(rowToProperty);
}

export async function getProperty(id: string): Promise<Property | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<PropertyRow>('SELECT * FROM properties WHERE id = ?', id);
  return row ? rowToProperty(row) : null;
}

/** Elimina la proprietà e tutte le sue stanze: SQLite qui non ha vincoli di FK a cascata. */
export async function deleteProperty(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM rooms WHERE property_id = ?', id);
  await db.runAsync('DELETE FROM properties WHERE id = ?', id);
}

interface RoomRow {
  id: string;
  property_id: string;
  name: string;
  type: string;
  created_at: string;
}

function rowToRoom(row: RoomRow): Room {
  return {
    id: row.id,
    propertyId: row.property_id,
    name: row.name,
    type: row.type as RoomType,
    createdAt: row.created_at,
  };
}

export async function insertRoom(room: Room): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO rooms (id, property_id, name, type, created_at) VALUES (?, ?, ?, ?, ?)`,
    room.id,
    room.propertyId,
    room.name,
    room.type,
    room.createdAt
  );
}

export async function getRoomsForProperty(propertyId: string): Promise<Room[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<RoomRow>(
    'SELECT * FROM rooms WHERE property_id = ? ORDER BY created_at ASC',
    propertyId
  );
  return rows.map(rowToRoom);
}

export async function deleteRoom(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM rooms WHERE id = ?', id);
}
```

Nessun test automatico: `expo-sqlite` richiede un runtime nativo, non è mockabile in modo affidabile in `jest-expo` — stessa scelta di `quiete-app/app/src/db/database.ts`, che non ha test diretti. Si verifica manualmente nel Task 8.

- [ ] **Step 2: Verifica**

```bash
npx tsc --noEmit
```

Expected: nessun errore.

- [ ] **Step 3: Commit**

```bash
git add app/src/db/database.ts
git commit -m "Aggiunge layer dati SQLite per proprietà e stanze"
```

---

### Task 5: Navigazione e generatore di ID condiviso

**Files:**
- Create: `app/src/lib/id.ts`
- Create: `app/src/types/navigation.ts`

**Interfaces:**
- Produces:
  - `function newId(): string`
  - `type RootStackParamList = { Proprieta: undefined; NuovaProprieta: undefined; DettaglioProprieta: { id: string }; NuovaStanza: { propertyId: string } }`

- [ ] **Step 1: Crea `app/src/lib/id.ts`**

```ts
/** ID locale univoco a sufficienza per questo caso d'uso: timestamp + suffisso casuale. */
export function newId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
```

- [ ] **Step 2: Crea `app/src/types/navigation.ts`**

```ts
export type RootStackParamList = {
  Proprieta: undefined;
  NuovaProprieta: undefined;
  DettaglioProprieta: { id: string };
  NuovaStanza: { propertyId: string };
};
```

- [ ] **Step 3: Verifica**

```bash
npx tsc --noEmit
```

Expected: nessun errore.

- [ ] **Step 4: Commit**

```bash
git add app/src/lib/id.ts app/src/types/navigation.ts
git commit -m "Aggiunge navigazione e generatore di ID condiviso"
```

---

### Task 6: Schermata elenco proprietà + creazione proprietà

**Files:**
- Create: `app/src/screens/PropertiesScreen.tsx`
- Create: `app/src/screens/NewPropertyScreen.tsx`

**Interfaces:**
- Consumes: `getAllProperties`, `insertProperty` (Task 4); `newId` (Task 5); `RootStackParamList` (Task 5); `useTheme`, `Theme` (Task 2).
- Produces: componenti `PropertiesScreen` e `NewPropertyScreen` (default export), usati da `App.tsx` nel Task 8.

- [ ] **Step 1: Crea `app/src/screens/PropertiesScreen.tsx`**

```tsx
import React, { useCallback, useState } from 'react';
import { View, Text, FlatList, Pressable, StyleSheet, RefreshControl } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTheme, Theme } from '../theme/colors';
import { getAllProperties } from '../db/database';
import type { Property } from '../types/property';
import type { RootStackParamList } from '../types/navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'Proprieta'>;

export default function PropertiesScreen({ navigation }: Props) {
  const theme = useTheme();
  const styles = makeStyles(theme);
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setProperties(await getAllProperties());
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Le tue proprietà</Text>
        <Text style={styles.subtitle}>
          {properties.length === 0 ? 'Nessuna proprietà ancora' : `${properties.length} proprietà`}
        </Text>
      </View>

      {properties.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>🏠</Text>
          <Text style={styles.emptyText}>
            Aggiungi una proprietà e le sue stanze per iniziare a documentare un check-in o un check-out.
          </Text>
        </View>
      ) : (
        <FlatList
          data={properties}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={theme.accent} />}
          renderItem={({ item }) => (
            <Pressable
              style={styles.row}
              onPress={() => navigation.navigate('DettaglioProprieta', { id: item.id })}
            >
              <Text style={styles.rowIcon}>🏠</Text>
              <View style={styles.rowBody}>
                <Text style={styles.rowTitle}>{item.name}</Text>
                {item.address ? <Text style={styles.rowMeta}>{item.address}</Text> : null}
              </View>
            </Pressable>
          )}
        />
      )}

      <Pressable
        style={styles.fab}
        onPress={() => navigation.navigate('NuovaProprieta')}
        accessibilityLabel="Aggiungi una nuova proprietà"
      >
        <Text style={styles.fabText}>+</Text>
      </Pressable>
    </View>
  );
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.bg },
    header: { paddingHorizontal: 20, paddingTop: 64, paddingBottom: 20 },
    title: { fontSize: 28, fontWeight: '700', color: theme.text },
    subtitle: { fontSize: 13, color: theme.muted, marginTop: 4 },
    empty: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
    emptyIcon: { fontSize: 40, marginBottom: 16 },
    emptyText: { color: theme.muted, textAlign: 'center', fontSize: 15, lineHeight: 22, maxWidth: 280 },
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
  });
}
```

- [ ] **Step 2: Crea `app/src/screens/NewPropertyScreen.tsx`**

```tsx
import React, { useState } from 'react';
import { View, Text, Pressable, TextInput, StyleSheet, ScrollView, Alert } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTheme, Theme } from '../theme/colors';
import { insertProperty } from '../db/database';
import { newId } from '../lib/id';
import type { RootStackParamList } from '../types/navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'NuovaProprieta'>;

export default function NewPropertyScreen({ navigation }: Props) {
  const theme = useTheme();
  const styles = makeStyles(theme);
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (saving) return;
    const trimmedName = name.trim();
    if (!trimmedName) {
      Alert.alert(
        'Nome mancante',
        'Dai un nome alla proprietà per riconoscerla facilmente (es. "Casa in affitto - Via Roma").'
      );
      return;
    }
    setSaving(true);
    try {
      await insertProperty({
        id: newId(),
        name: trimmedName,
        address: address.trim() || undefined,
        createdAt: new Date().toISOString(),
      });
      navigation.goBack();
    } catch (err) {
      Alert.alert('Errore', 'Non è stato possibile salvare la proprietà. Riprova.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.screenTitle}>Nuova proprietà</Text>

      <Text style={styles.label}>Nome</Text>
      <TextInput
        style={styles.input}
        placeholder='Es. "Casa in affitto - Via Roma"'
        placeholderTextColor={theme.muted}
        value={name}
        onChangeText={setName}
      />

      <Text style={styles.label}>Indirizzo (facoltativo)</Text>
      <TextInput
        style={styles.input}
        placeholder="Via, città"
        placeholderTextColor={theme.muted}
        value={address}
        onChangeText={setAddress}
      />

      <Pressable style={[styles.saveBtn, saving && styles.saveBtnDisabled]} onPress={handleSave} disabled={saving}>
        <Text style={styles.saveBtnText}>{saving ? 'Salvataggio...' : 'Salva proprietà'}</Text>
      </Pressable>

      <Pressable style={styles.cancelBtn} onPress={() => navigation.goBack()}>
        <Text style={styles.cancelBtnText}>Annulla</Text>
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
    input: {
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.line,
      borderRadius: 12,
      padding: 14,
      color: theme.text,
      fontSize: 14,
    },
    saveBtn: { backgroundColor: theme.accent, borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 32 },
    saveBtnDisabled: { opacity: 0.6 },
    saveBtnText: { color: theme.accentInk, fontSize: 16, fontWeight: '700' },
    cancelBtn: { padding: 14, alignItems: 'center', marginTop: 4 },
    cancelBtnText: { color: theme.muted, fontSize: 14 },
  });
}
```

- [ ] **Step 3: Verifica**

```bash
npx tsc --noEmit
```

Expected: nessun errore (verifica manuale a schermo nel Task 8, dopo il cablaggio in `App.tsx`).

- [ ] **Step 4: Commit**

```bash
git add app/src/screens/PropertiesScreen.tsx app/src/screens/NewPropertyScreen.tsx
git commit -m "Aggiunge schermata elenco proprietà e creazione proprietà"
```

---

### Task 7: Schermata dettaglio proprietà + creazione stanza

**Files:**
- Create: `app/src/screens/PropertyDetailScreen.tsx`
- Create: `app/src/screens/NewRoomScreen.tsx`

**Interfaces:**
- Consumes: `getProperty`, `getRoomsForProperty`, `deleteRoom`, `deleteProperty`, `insertRoom` (Task 4); `roomTypeInfo`, `ROOM_TYPES`, `RoomType` (Task 3); `newId` (Task 5); `RootStackParamList` (Task 5).
- Produces: componenti `PropertyDetailScreen` e `NewRoomScreen` (default export), usati da `App.tsx` nel Task 8.

- [ ] **Step 1: Crea `app/src/screens/PropertyDetailScreen.tsx`**

```tsx
import React, { useCallback, useState } from 'react';
import { View, Text, FlatList, Pressable, StyleSheet, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTheme, Theme } from '../theme/colors';
import { getProperty, getRoomsForProperty, deleteRoom, deleteProperty } from '../db/database';
import { roomTypeInfo } from '../types/property';
import type { Property, Room } from '../types/property';
import type { RootStackParamList } from '../types/navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'DettaglioProprieta'>;

export default function PropertyDetailScreen({ navigation, route }: Props) {
  const theme = useTheme();
  const styles = makeStyles(theme);
  const { id } = route.params;
  const [property, setProperty] = useState<Property | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);

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
          await deleteProperty(id);
          navigation.goBack();
        },
      },
    ]);
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

- [ ] **Step 2: Crea `app/src/screens/NewRoomScreen.tsx`**

```tsx
import React, { useState } from 'react';
import { View, Text, Pressable, TextInput, StyleSheet, ScrollView, Alert } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTheme, Theme } from '../theme/colors';
import { insertRoom } from '../db/database';
import { newId } from '../lib/id';
import { ROOM_TYPES, RoomType } from '../types/property';
import type { RootStackParamList } from '../types/navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'NuovaStanza'>;

export default function NewRoomScreen({ navigation, route }: Props) {
  const theme = useTheme();
  const styles = makeStyles(theme);
  const { propertyId } = route.params;
  const [type, setType] = useState<RoomType>('camera');
  const [name, setName] = useState(ROOM_TYPES[0].label);
  const [nameEdited, setNameEdited] = useState(false);
  const [saving, setSaving] = useState(false);

  function selectType(next: RoomType) {
    setType(next);
    if (!nameEdited) {
      const info = ROOM_TYPES.find((t) => t.value === next);
      setName(next === 'altro' ? '' : info?.label ?? '');
    }
  }

  async function handleSave() {
    if (saving) return;
    const trimmedName = name.trim();
    if (!trimmedName) {
      Alert.alert('Nome mancante', 'Dai un nome a questa stanza (es. "Ripostiglio").');
      return;
    }
    setSaving(true);
    try {
      await insertRoom({
        id: newId(),
        propertyId,
        name: trimmedName,
        type,
        createdAt: new Date().toISOString(),
      });
      navigation.goBack();
    } catch (err) {
      Alert.alert('Errore', 'Non è stato possibile salvare la stanza. Riprova.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.screenTitle}>Nuova stanza</Text>

      <Text style={styles.label}>Tipo</Text>
      <View style={styles.typeGrid}>
        {ROOM_TYPES.map((t) => (
          <Pressable
            key={t.value}
            onPress={() => selectType(t.value)}
            style={[styles.typeChip, type === t.value && styles.typeChipActive]}
          >
            <Text style={styles.typeIcon}>{t.icon}</Text>
            <Text style={[styles.typeLabel, type === t.value && styles.typeLabelActive]}>{t.label}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.label}>Nome stanza</Text>
      <TextInput
        style={styles.input}
        placeholder='Es. "Camera 1"'
        placeholderTextColor={theme.muted}
        value={name}
        onChangeText={(text) => {
          setName(text);
          setNameEdited(true);
        }}
      />

      <Pressable style={[styles.saveBtn, saving && styles.saveBtnDisabled]} onPress={handleSave} disabled={saving}>
        <Text style={styles.saveBtnText}>{saving ? 'Salvataggio...' : 'Salva stanza'}</Text>
      </Pressable>

      <Pressable style={styles.cancelBtn} onPress={() => navigation.goBack()}>
        <Text style={styles.cancelBtnText}>Annulla</Text>
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
    typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    typeChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.line,
      borderRadius: 999,
      paddingVertical: 10,
      paddingHorizontal: 14,
    },
    typeChipActive: { borderColor: theme.accent, backgroundColor: theme.surface2 },
    typeIcon: { fontSize: 15 },
    typeLabel: { color: theme.muted, fontSize: 13 },
    typeLabelActive: { color: theme.text, fontWeight: '600' },
    input: {
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.line,
      borderRadius: 12,
      padding: 14,
      color: theme.text,
      fontSize: 14,
    },
    saveBtn: { backgroundColor: theme.accent, borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 32 },
    saveBtnDisabled: { opacity: 0.6 },
    saveBtnText: { color: theme.accentInk, fontSize: 16, fontWeight: '700' },
    cancelBtn: { padding: 14, alignItems: 'center', marginTop: 4 },
    cancelBtnText: { color: theme.muted, fontSize: 14 },
  });
}
```

- [ ] **Step 3: Verifica**

```bash
npx tsc --noEmit
```

Expected: nessun errore.

- [ ] **Step 4: Commit**

```bash
git add app/src/screens/PropertyDetailScreen.tsx app/src/screens/NewRoomScreen.tsx
git commit -m "Aggiunge schermata dettaglio proprietà e creazione stanza"
```

---

### Task 8: Cablaggio in `App.tsx` e verifica manuale end-to-end

**Files:**
- Modify: `app/App.tsx`

**Interfaces:**
- Consumes: `initDatabase` (Task 4); `useTheme`, `Theme` (Task 2); `RootStackParamList` (Task 5); tutti e 4 gli screen (Task 6, Task 7).

- [ ] **Step 1: Sostituisci `app/App.tsx`**

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

- [ ] **Step 2: Verifica il type-check**

```bash
npx tsc --noEmit
```

Expected: nessun errore.

- [ ] **Step 3: Verifica manuale end-to-end**

```bash
npx expo start
```

Apri l'app in Expo Go su un dispositivo/emulatore Android (tasto `a`, o scansiona il QR code). Esercita a mano l'intero flusso del Piano 1:

1. L'app si apre sulla schermata "Le tue proprietà", vuota — Expected: messaggio "Aggiungi una proprietà e le sue stanze...".
2. Tocca "+" → compila nome ("Casa in affitto - Via Roma") e salva — Expected: torni all'elenco e la proprietà compare.
3. Tocca la proprietà → sei nel dettaglio, stanze vuote — Expected: messaggio "Aggiungi le stanze...".
4. Tocca "+" → scegli tipo "Camera da letto" (nome precompilato), salva — Expected: torni al dettaglio e la stanza compare con l'icona giusta.
5. Ripeti per tipo "Altro" — Expected: il nome NON è precompilato e provare a salvare senza nome mostra l'alert "Nome mancante".
6. Tocca 🗑 su una stanza → conferma — Expected: la stanza sparisce dalla lista.
7. Tocca "Elimina proprietà" → conferma — Expected: torni all'elenco proprietà e non c'è più.
8. Chiudi e riapri l'app (o ricarica con `r` nel terminale Expo) — Expected: le proprietà create al punto 2 (se non eliminate) sono ancora lì: conferma che i dati persistono davvero su SQLite locale tra riavvii.

Se un passaggio si comporta diversamente da quanto atteso, non procedere al commit: sistema il problema nel file interessato e ripeti la verifica.

- [ ] **Step 4: Commit**

```bash
git add app/App.tsx
git commit -m "Collega le schermate proprietà/stanze in App.tsx"
```

---

### Task 9: CI (type check + test), come in Quiete

**Files:**
- Create: `app/.github/workflows/ci.yml`

**Interfaces:**
- Nessuna (configurazione, non codice applicativo).

- [ ] **Step 1: Crea `app/.github/workflows/ci.yml`**

```yaml
name: CI

on:
  push:
    branches: [master]
  pull_request:
    branches: [master]

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: app/package-lock.json

      - name: Install dependencies
        working-directory: app
        run: npm ci

      - name: Type check
        working-directory: app
        run: npx tsc --noEmit

      - name: Test
        working-directory: app
        run: npx jest --ci
```

Nota: a differenza del workflow di Quiete (dove `app/` è la radice del repo), qui `app/` è una sottocartella del repo `checkcasa` — servono `working-directory` e `cache-dependency-path` espliciti perché il workflow gira dalla radice del repo.

- [ ] **Step 2: Verifica in locale che i comandi usati dalla CI passino**

```bash
cd app
npm ci
npx tsc --noEmit
npx jest --ci
```

Expected: tutti e tre i comandi terminano con successo (il test suite include almeno `src/types/property.test.ts` dal Task 3).

- [ ] **Step 3: Commit**

```bash
git add app/.github/workflows/ci.yml
git commit -m "Aggiunge CI (type check + test)"
```

---

## Verifica finale del piano

Dopo il Task 9, l'app CheckCasa permette di: creare una proprietà, aggiungere/rimuovere le sue stanze scegliendo tra i tipi preimpostati della spec (Camera da letto, Bagno, Cucina, Soggiorno, Balcone/Terrazzo, Altro), eliminare una proprietà con le sue stanze — tutto persistito su SQLite locale, nessun server. Questo copre la sezione "Setup proprietà" del flusso principale (§1 della spec di design). I Piani 2 (sessione di documentazione con foto/note) e 3 (PDF + firma) partiranno da qui.
