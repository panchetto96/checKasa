import type { Room } from '../types/property';
import type { Photo } from '../types/session';

/** Stanze che non hanno ancora nessuna foto in questa sessione. */
export function roomsWithoutPhotos(rooms: Room[], photos: Photo[]): Room[] {
  const roomIdsWithPhotos = new Set(photos.map((p) => p.roomId));
  return rooms.filter((r) => !roomIdsWithPhotos.has(r.id));
}
