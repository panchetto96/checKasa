import React, { useCallback, useState } from 'react';
import { View, Text, FlatList, Pressable, StyleSheet, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTheme, Theme } from '../theme/colors';
import {
  getSession,
  getProperty,
  getRoomsForProperty,
  getPhotosForSession,
  getNotesForSession,
  getSignatureForSession,
} from '../db/database';
import { exportReport } from '../lib/pdf';
import { roomTypeInfo } from '../types/property';
import type { Property, Room } from '../types/property';
import type { Session, Photo, RoomNote } from '../types/session';
import { sessionTypeLabel } from '../types/session';
import type { Signature } from '../types/signature';
import type { RootStackParamList } from '../types/navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'RiepilogoSessione'>;

export default function RiepilogoSessioneScreen({ navigation, route }: Props) {
  const theme = useTheme();
  const styles = makeStyles(theme);
  const { sessionId } = route.params;
  const [session, setSession] = useState<Session | null>(null);
  const [property, setProperty] = useState<Property | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [notes, setNotes] = useState<RoomNote[]>([]);
  const [signature, setSignature] = useState<Signature | null>(null);
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async () => {
    const loadedSession = await getSession(sessionId);
    if (!loadedSession) return;
    const [loadedProperty, loadedRooms, loadedPhotos, loadedNotes, loadedSignature] = await Promise.all([
      getProperty(loadedSession.propertyId),
      getRoomsForProperty(loadedSession.propertyId),
      getPhotosForSession(sessionId),
      getNotesForSession(sessionId),
      getSignatureForSession(sessionId),
    ]);
    setSession(loadedSession);
    setProperty(loadedProperty);
    setRooms(loadedRooms);
    setPhotos(loadedPhotos);
    setNotes(loadedNotes);
    setSignature(loadedSignature);
  }, [sessionId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function handleExportPdf() {
    if (!session || !property || exporting) return;
    setExporting(true);
    try {
      await exportReport(property, session, rooms, photos, notes, signature);
    } catch (err) {
      Alert.alert('Errore', 'Non è stato possibile generare il PDF. Riprova.');
    } finally {
      setExporting(false);
    }
  }

  function photoCountForRoom(roomId: string): number {
    return photos.filter((p) => p.roomId === roomId).length;
  }

  function noteForRoom(roomId: string): RoomNote | undefined {
    return notes.find((n) => n.roomId === roomId);
  }

  if (!session || !property) {
    return <View style={styles.container} />;
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{sessionTypeLabel(session.type)}</Text>
        <Text style={styles.subtitle}>
          {property.name} · {session.status === 'completata' ? 'Completata' : 'In corso'}
        </Text>
      </View>

      <FlatList
        data={rooms}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => {
          const info = roomTypeInfo(item.type);
          const count = photoCountForRoom(item.id);
          const note = noteForRoom(item.id);
          return (
            <Pressable
              style={styles.row}
              onPress={() => navigation.navigate('CatturaStanza', { sessionId, roomId: item.id })}
            >
              <Text style={styles.rowIcon}>{info.icon}</Text>
              <View style={styles.rowBody}>
                <Text style={styles.rowTitle}>{item.name}</Text>
                <Text style={count > 0 ? styles.rowMetaDone : styles.rowMeta}>
                  {count > 0 ? `✓ ${count} foto` : 'Nessuna foto'}
                </Text>
                {note ? <Text style={styles.rowNote}>{note.text}</Text> : null}
              </View>
            </Pressable>
          );
        }}
        ListFooterComponent={
          <View style={styles.footer}>
            {signature ? (
              <Text style={styles.signatureDone}>✓ Firma raccolta</Text>
            ) : (
              <Pressable style={styles.secondaryBtn} onPress={() => navigation.navigate('Firma', { sessionId })}>
                <Text style={styles.secondaryBtnText}>Aggiungi firma</Text>
              </Pressable>
            )}
            <Pressable
              style={[styles.primaryBtn, exporting && styles.primaryBtnDisabled]}
              onPress={handleExportPdf}
              disabled={exporting}
            >
              <Text style={styles.primaryBtnText}>{exporting ? 'Generazione...' : 'Genera PDF'}</Text>
            </Pressable>
          </View>
        }
      />
    </View>
  );
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.bg },
    header: { paddingHorizontal: 20, paddingTop: 64, paddingBottom: 20 },
    title: { fontSize: 24, fontWeight: '700', color: theme.text },
    subtitle: { fontSize: 13, color: theme.muted, marginTop: 4 },
    list: { paddingHorizontal: 20, paddingBottom: 40 },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.surface,
      borderRadius: 12,
      padding: 16,
      marginBottom: 10,
      borderWidth: 1,
      borderColor: theme.line,
    },
    rowIcon: { fontSize: 22, marginRight: 14 },
    rowBody: { flex: 1 },
    rowTitle: { color: theme.text, fontSize: 15, fontWeight: '600' },
    rowMeta: { color: theme.muted, fontSize: 12, marginTop: 3 },
    rowMetaDone: { color: theme.accent, fontSize: 12, marginTop: 3, fontWeight: '600' },
    rowNote: { color: theme.muted, fontSize: 12, marginTop: 4, fontStyle: 'italic' },
    footer: { marginTop: 12, gap: 12 },
    secondaryBtn: {
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.line,
      borderRadius: 12,
      paddingVertical: 14,
      alignItems: 'center',
    },
    secondaryBtnText: { color: theme.text, fontSize: 14, fontWeight: '600' },
    signatureDone: { color: theme.accent, fontSize: 14, fontWeight: '600', textAlign: 'center' },
    primaryBtn: { backgroundColor: theme.accent, borderRadius: 12, paddingVertical: 16, alignItems: 'center' },
    primaryBtnDisabled: { opacity: 0.6 },
    primaryBtnText: { color: theme.accentInk, fontSize: 16, fontWeight: '700' },
  });
}
