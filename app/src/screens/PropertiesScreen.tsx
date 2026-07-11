import React, { useCallback, useState } from 'react';
import { View, Text, FlatList, Pressable, StyleSheet, RefreshControl } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTheme, Theme } from '../theme/colors';
import { getAllProperties } from '../db/database';
import type { Property } from '../types/property';
import type { RootStackParamList } from '../types/navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'Proprieta'>;

export default function PropertiesScreen({ navigation }: Props) {
  const theme = useTheme();
  const styles = makeStyles(theme);
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setProperties(await getAllProperties());
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Le tue proprietà</Text>
        <Text style={styles.subtitle}>
          {properties.length === 0 ? 'Nessuna proprietà ancora' : `${properties.length} proprietà`}
        </Text>
      </View>

      {properties.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>🏠</Text>
          <Text style={styles.emptyText}>
            Aggiungi una proprietà e le sue stanze per iniziare a documentare un check-in o un check-out.
          </Text>
        </View>
      ) : (
        <FlatList
          data={properties}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={theme.accent} />}
          renderItem={({ item }) => (
            <Pressable
              style={styles.row}
              onPress={() => navigation.navigate('DettaglioProprieta', { id: item.id })}
            >
              <Text style={styles.rowIcon}>🏠</Text>
              <View style={styles.rowBody}>
                <Text style={styles.rowTitle}>{item.name}</Text>
                {item.address ? <Text style={styles.rowMeta}>{item.address}</Text> : null}
              </View>
            </Pressable>
          )}
        />
      )}

      <Pressable
        style={styles.fab}
        onPress={() => navigation.navigate('NuovaProprieta')}
        accessibilityLabel="Aggiungi una nuova proprietà"
      >
        <Text style={styles.fabText}>+</Text>
      </Pressable>
    </View>
  );
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.bg },
    header: { paddingHorizontal: 20, paddingTop: 64, paddingBottom: 20 },
    title: { fontSize: 28, fontWeight: '700', color: theme.text },
    subtitle: { fontSize: 13, color: theme.muted, marginTop: 4 },
    empty: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
    emptyIcon: { fontSize: 40, marginBottom: 16 },
    emptyText: { color: theme.muted, textAlign: 'center', fontSize: 15, lineHeight: 22, maxWidth: 280 },
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
    fab: {
      position: 'absolute',
      right: 20,
      bottom: 32,
      width: 58,
      height: 58,
      borderRadius: 29,
      backgroundColor: theme.accent,
      justifyContent: 'center',
      alignItems: 'center',
      elevation: 6,
    },
    fabText: { color: theme.accentInk, fontSize: 30, fontWeight: '400', marginTop: -2 },
  });
}
