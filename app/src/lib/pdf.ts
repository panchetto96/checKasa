import * as FileSystem from 'expo-file-system/legacy';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { roomTypeInfo } from '../types/property';
import type { Property, Room } from '../types/property';
import type { Session, Photo, RoomNote } from '../types/session';
import { sessionTypeLabel } from '../types/session';
import type { Signature } from '../types/signature';

export interface EmbeddedPhoto {
  roomId: string;
  base64: string;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('it-IT', { dateStyle: 'full', timeStyle: 'short' });
}

export function buildReportHtml(
  property: Property,
  session: Session,
  rooms: Room[],
  photos: EmbeddedPhoto[],
  notes: RoomNote[],
  signatureBase64: string | null
): string {
  const roomSections = rooms
    .map((room) => {
      const info = roomTypeInfo(room.type);
      const roomPhotos = photos.filter((p) => p.roomId === room.id);
      const note = notes.find((n) => n.roomId === room.id);

      const photosHtml =
        roomPhotos.length > 0
          ? `<div class="photo-grid">${roomPhotos
              .map((p) => `<img src="data:image/jpeg;base64,${p.base64}" class="photo" />`)
              .join('')}</div>`
          : `<p class="no-photo">Nessuna foto</p>`;

      const noteHtml = note ? `<p class="note">Nota: ${escapeHtml(note.text)}</p>` : '';

      return `
      <div class="room">
        <h2>${info.icon} ${escapeHtml(room.name)}</h2>
        ${photosHtml}
        ${noteHtml}
      </div>`;
    })
    .join('');

  const signatureHtml = signatureBase64
    ? `<div class="signature">
        <p><strong>Firma dell'altra parte</strong></p>
        <img src="data:image/png;base64,${signatureBase64}" class="signature-img" />
        <p class="signature-date">Raccolta il ${formatDate(session.completedAt ?? session.createdAt)}</p>
      </div>`
    : `<p class="unilateral">Documento redatto unilateralmente: l'altra parte non era presente o non ha firmato.
        Secondo le fonti legali italiane, si raccomanda comunque di formalizzare l'invio di questo documento
        via PEC o raccomandata A/R.</p>`;

  return `
  <html>
    <head>
      <meta charset="utf-8" />
      <style>
        body { font-family: -apple-system, Helvetica, Arial, sans-serif; color: #1A2233; padding: 32px; }
        h1 { font-size: 22px; margin-bottom: 4px; }
        h2 { font-size: 16px; margin: 20px 0 8px; }
        .sub { color: #5C6474; font-size: 12px; margin-bottom: 24px; }
        .room { margin-bottom: 20px; page-break-inside: avoid; }
        .photo-grid { display: flex; flex-wrap: wrap; gap: 8px; }
        .photo { width: 150px; height: 150px; object-fit: cover; border-radius: 6px; }
        .no-photo { color: #5C6474; font-size: 12px; font-style: italic; }
        .note { font-size: 13px; margin-top: 6px; }
        .signature { margin-top: 32px; border-top: 1px solid #D9D6CB; padding-top: 16px; }
        .signature-img { width: 240px; height: 100px; object-fit: contain; border: 1px solid #D9D6CB; }
        .signature-date { font-size: 11px; color: #5C6474; }
        .unilateral { margin-top: 32px; font-size: 12px; color: #5C6474; border-top: 1px solid #D9D6CB; padding-top: 16px; }
        .disclaimer { margin-top: 24px; font-size: 10px; color: #5C6474; line-height: 1.5; }
      </style>
    </head>
    <body>
      <h1>${sessionTypeLabel(session.type)} — ${escapeHtml(property.name)}</h1>
      <p class="sub">${property.address ? escapeHtml(property.address) + ' — ' : ''}${formatDate(session.createdAt)}</p>

      ${roomSections}

      ${signatureHtml}

      <p class="disclaimer">
        Questo documento è generato da CheckCasa come strumento di documentazione personale. Non costituisce
        consulenza legale. Ai sensi dell'art. 1590 c.c. l'inquilino deve riconsegnare l'immobile nello stato
        in cui l'ha ricevuto, salvo il normale deterioramento d'uso: la documentazione fotografica di check-in
        è prova diretta di come l'ha ricevuto. Ai sensi dell'art. 2712 c.c. le riproduzioni fotografiche formano
        piena prova dei fatti rappresentati se la parte contro cui sono prodotte non ne disconosce la conformità;
        il valore probatorio finale resta comunque rimesso alla valutazione dell'autorità competente.
      </p>
    </body>
  </html>`;
}

/** Legge un file locale e lo converte in base64, o `null` se il file non esiste più (foto/firma cancellata fuori dall'app). */
async function readFileAsBase64(uri: string): Promise<string | null> {
  try {
    return await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
  } catch {
    return null;
  }
}

/** Genera il PDF dai dati correnti della sessione e apre la condivisione nativa. Foto/firma mancanti su disco vengono saltate. */
export async function exportReport(
  property: Property,
  session: Session,
  rooms: Room[],
  photos: Photo[],
  notes: RoomNote[],
  signature: Signature | null
): Promise<void> {
  const embeddedPhotos: EmbeddedPhoto[] = [];
  for (const photo of photos) {
    const base64 = await readFileAsBase64(photo.uri);
    if (base64) embeddedPhotos.push({ roomId: photo.roomId, base64 });
  }

  const signatureBase64 = signature ? await readFileAsBase64(signature.uri) : null;

  const html = buildReportHtml(property, session, rooms, embeddedPhotos, notes, signatureBase64);
  const { uri } = await Print.printToFileAsync({ html });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, {
      mimeType: 'application/pdf',
      dialogTitle: 'Condividi report',
    });
  }
}
