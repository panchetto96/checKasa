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
  await db.withTransactionAsync(async () => {
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

export async function deleteRoom(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM rooms WHERE id = ?', id);
}
