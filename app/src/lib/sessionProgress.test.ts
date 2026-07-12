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
