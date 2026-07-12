import * as FileSystem from 'expo-file-system/legacy';

/** Cartella locale dove vivono le foto delle sessioni di check-in/check-out. */
export const PHOTOS_DIR = `${FileSystem.documentDirectory}foto/`;

/** Copia la foto scattata/scelta (che vive in una cache temporanea) nella cartella stabile dell'app. */
export async function savePickedPhoto(pickedUri: string): Promise<string> {
  await FileSystem.makeDirectoryAsync(PHOTOS_DIR, { intermediates: true }).catch(() => {});
  const dest = `${PHOTOS_DIR}foto-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
  await FileSystem.copyAsync({ from: pickedUri, to: dest });
  return dest;
}

/** Rimuove il file di una foto dal disco. Non fallisce se il file non esiste più. */
export async function deletePhotoFile(uri: string): Promise<void> {
  await FileSystem.deleteAsync(uri, { idempotent: true });
}
