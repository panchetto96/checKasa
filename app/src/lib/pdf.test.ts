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
