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
