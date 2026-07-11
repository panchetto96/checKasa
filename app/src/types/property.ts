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
