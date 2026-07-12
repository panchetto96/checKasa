import * as SQLite from 'expo-sqlite';
import { Property, Room, RoomType } from '../types/property';
import { Session, SessionType, SessionStatus, Photo, RoomNote } from '../types/session';

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

export async function getRoom(id: string): Promise<Room | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<RoomRow>('SELECT * FROM rooms WHERE id = ?', id);
  return row ? rowToRoom(row) : null;
}

export async function deleteRoom(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM rooms WHERE id = ?', id);
}

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
