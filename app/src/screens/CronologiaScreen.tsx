import React, { useCallback, useState } from 'react';
import { View, Text, FlatList, Pressable, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTheme, Theme } from '../theme/colors';
import { getProperty, getSessionsForProperty } from '../db/database';
import type { Property } from '../types/property';
import type { Session } from '../types/session';
import { sessionTypeLabel } from '../types/session';
import type { RootStackParamList } from '../types/navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'Cronologia'>;

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' });
}

export default function CronologiaScreen({ navigation, route }: Props) {
  const theme = useTheme();
  const styles = makeStyles(theme);
  const { propertyId } = route.params;
  const [property, setProperty] = useState<Property | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);

  const load = useCallback(async () => {
    const [loadedProperty, loadedSessions] = await Promise.all([
      getProperty(propertyId),
      getSessionsForProperty(propertyId),
    ]);
    setProperty(loadedProperty);
    setSessions(loadedSessions);
  }, [propertyId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Cronologia</Text>
        {property ? <Text style={styles.subtitle}>{property.name}</Text> : null}
      </View>

      {sessions.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>🗂️</Text>
          <Text style={styles.emptyText}>Nessuna sessione ancora per questa proprietà.</Text>
        </View>
      ) : (
        <FlatList
          data={sessions}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <Pressable
              style={styles.row}
              onPress={() => navigation.navigate('RiepilogoSessione', { sessionId: item.id })}
            >
              <View style={styles.rowBody}>
                <Text style={styles.rowTitle}>{sessionTypeLabel(item.type)}</Text>
                <Text style={styles.rowMeta}>{formatDate(item.createdAt)}</Text>
              </View>
              <Text style={item.status === 'completata' ? styles.statusDone : styles.statusPending}>
                {item.status === 'completata' ? '✓ Completata' : 'In corso'}
              </Text>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.bg },
    header: { paddingHorizontal: 20, paddingTop: 64, paddingBottom: 20 },
    title: { fontSize: 24, fontWeight: '700', color: theme.text },
    subtitle: { fontSize: 13, color: theme.muted, marginTop: 4 },
    empty: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
    emptyIcon: { fontSize: 40, marginBottom: 16 },
    emptyText: { color: theme.muted, textAlign: 'center', fontSize: 15, lineHeight: 22, maxWidth: 280 },
    list: { paddingHorizontal: 20, paddingBottom: 32 },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: theme.surface,
      borderRadius: 12,
      padding: 16,
      marginBottom: 10,
      borderWidth: 1,
      borderColor: theme.line,
    },
    rowBody: { flex: 1 },
    rowTitle: { color: theme.text, fontSize: 15, fontWeight: '600' },
    rowMeta: { color: theme.muted, fontSize: 12, marginTop: 3 },
    statusDone: { color: theme.accent, fontSize: 12, fontWeight: '600' },
    statusPending: { color: theme.muted, fontSize: 12, fontWeight: '600' },
  });
}
