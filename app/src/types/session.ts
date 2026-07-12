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
