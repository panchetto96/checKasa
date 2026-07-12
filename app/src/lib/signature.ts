import * as FileSystem from 'expo-file-system/legacy';

/** Cartella locale dove vive la firma catturata per una sessione. */
export const SIGNATURES_DIR = `${FileSystem.documentDirectory}firme/`;

/** Salva la firma (data URL "data:image/png;base64,...") come file PNG locale. */
export async function saveSignature(dataUrl: string): Promise<string> {
  await FileSystem.makeDirectoryAsync(SIGNATURES_DIR, { intermediates: true }).catch(() => {});
  const base64 = dataUrl.replace(/^data:image\/png;base64,/, '');
  const dest = `${SIGNATURES_DIR}firma-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.png`;
  await FileSystem.writeAsStringAsync(dest, base64, { encoding: FileSystem.EncodingType.Base64 });
  return dest;
}

/** Rimuove il file di una firma dal disco. Non fallisce se il file non esiste più. */
export async function deleteSignatureFile(uri: string): Promise<void> {
  await FileSystem.deleteAsync(uri, { idempotent: true });
}
