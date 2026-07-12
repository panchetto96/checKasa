import React, { useCallback, useState } from 'react';
import { View, Text, FlatList, Pressable, StyleSheet, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTheme, Theme } from '../theme/colors';
import { getSession, getProperty, getRoomsForProperty, getPhotosForSession, completeSession } from '../db/database';
import { roomTypeInfo } from '../types/property';
import type { Property, Room } from '../types/property';
import type { Session, Photo } from '../types/session';
import { sessionTypeLabel } from '../types/session';
import { roomsWithoutPhotos } from '../lib/sessionProgress';
import type { RootStackParamList } from '../types/navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'Sessione'>;

export default function SessionScreen({ navigation, route }: Props) {
  const theme = useTheme();
  const styles = makeStyles(theme);
  const { sessionId } = route.params;
  const [session, setSession] = useState<Session | null>(null);
  const [property, setProperty] = useState<Property | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [completing, setCompleting] = useState(false);

  const load = useCallback(async () => {
    const loadedSession = await getSession(sessionId);
    if (!loadedSession) return;
    const [loadedProperty, loadedRooms, loadedPhotos] = await Promise.all([
      getProperty(loadedSession.propertyId),
      getRoomsForProperty(loadedSession.propertyId),
      getPhotosForSession(sessionId),
    ]);
    setSession(loadedSession);
    setProperty(loadedProperty);
    setRooms(loadedRooms);
    setPhotos(loadedPhotos);
  }, [sessionId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  function photoCountForRoom(roomId: string): number {
    return photos.filter((p) => p.roomId === roomId).length;
  }

  async function finishCompletion() {
    setCompleting(true);
    try {
      await completeSession(sessionId, new Date().toISOString());
      navigation.goBack();
    } finally {
      setCompleting(false);
    }
  }

  function handleComplete() {
    if (completing) return;
    const missing = roomsWithoutPhotos(rooms, photos);
    if (missing.length > 0) {
      Alert.alert(
        'Alcune stanze non hanno foto',
        `${missing.map((r) => r.name).join(', ')} — vuoi completare comunque la sessione?`,
        [
          { text: 'Annulla', style: 'cancel' },
          { text: 'Completa comunque', style: 'destructive', onPress: finishCompletion },
        ]
      );
      return;
    }
    finishCompletion();
  }

  if (!session || !property) {
    return <View style={styles.container} />;
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{sessionTypeLabel(session.type)}</Text>
        <Text style={styles.subtitle}>{property.name}</Text>
      </View>

      <FlatList
        data={rooms}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => {
          const info = roomTypeInfo(item.type);
          const count = photoCountForRoom(item.id);
          return (
            <Pressable
              style={styles.row}
              onPress={() => navigation.navigate('CatturaStanza', { sessionId, roomId: item.id })}
            >
              <Text style={styles.rowIcon}>{info.icon}</Text>
              <View style={styles.rowBody}>
                <Text style={styles.rowTitle}>{item.name}</Text>
                <Text style={count > 0 ? styles.rowMetaDone : styles.rowMeta}>
                  {count > 0 ? `✓ ${count} foto` : 'Nessuna foto ancora'}
                </Text>
              </View>
            </Pressable>
          );
        }}
      />

      <Pressable
        style={[styles.completeBtn, completing && styles.completeBtnDisabled]}
        onPress={handleComplete}
        disabled={completing}
      >
        <Text style={styles.completeBtnText}>{completing ? 'Completamento...' : 'Completa sessione'}</Text>
      </Pressable>
    </View>
  );
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.bg },
    header: { paddingHorizontal: 20, paddingTop: 64, paddingBottom: 20 },
    title: { fontSize: 24, fontWeight: '700', color: theme.text },
    subtitle: { fontSize: 13, color: theme.muted, marginTop: 4 },
    list: { paddingHorizontal: 20, paddingBottom: 120 },
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
    completeBtn: {
      position: 'absolute',
      left: 20,
      right: 20,
      bottom: 32,
      backgroundColor: theme.accent,
      borderRadius: 12,
      paddingVertical: 16,
      alignItems: 'center',
    },
    completeBtnDisabled: { opacity: 0.6 },
    completeBtnText: { color: theme.accentInk, fontSize: 16, fontWeight: '700' },
  });
}
