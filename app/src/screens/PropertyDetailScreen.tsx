import React, { useCallback, useState } from 'react';
import { View, Text, FlatList, Pressable, StyleSheet, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTheme, Theme } from '../theme/colors';
import { getProperty, getRoomsForProperty, deleteRoom, deleteProperty } from '../db/database';
import { roomTypeInfo } from '../types/property';
import type { Property, Room } from '../types/property';
import type { RootStackParamList } from '../types/navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'DettaglioProprieta'>;

export default function PropertyDetailScreen({ navigation, route }: Props) {
  const theme = useTheme();
  const styles = makeStyles(theme);
  const { id } = route.params;
  const [property, setProperty] = useState<Property | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);

  const load = useCallback(async () => {
    const [loadedProperty, loadedRooms] = await Promise.all([getProperty(id), getRoomsForProperty(id)]);
    setProperty(loadedProperty);
    setRooms(loadedRooms);
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  function confirmDeleteRoom(room: Room) {
    Alert.alert('Rimuovi stanza', `Rimuovere "${room.name}" da questa proprietà?`, [
      { text: 'Annulla', style: 'cancel' },
      {
        text: 'Rimuovi',
        style: 'destructive',
        onPress: async () => {
          await deleteRoom(room.id);
          await load();
        },
      },
    ]);
  }

  function confirmDeleteProperty() {
    Alert.alert('Elimina proprietà', `Eliminare "${property?.name}" e tutte le sue stanze?`, [
      { text: 'Annulla', style: 'cancel' },
      {
        text: 'Elimina',
        style: 'destructive',
        onPress: async () => {
          await deleteProperty(id);
          navigation.goBack();
        },
      },
    ]);
  }

  if (!property) {
    return <View style={styles.container} />;
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{property.name}</Text>
        {property.address ? <Text style={styles.subtitle}>{property.address}</Text> : null}
      </View>

      {rooms.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>🚪</Text>
          <Text style={styles.emptyText}>Aggiungi le stanze di questa proprietà, una alla volta.</Text>
        </View>
      ) : (
        <FlatList
          data={rooms}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => {
            const info = roomTypeInfo(item.type);
            return (
              <View style={styles.row}>
                <Text style={styles.rowIcon}>{info.icon}</Text>
                <View style={styles.rowBody}>
                  <Text style={styles.rowTitle}>{item.name}</Text>
                </View>
                <Pressable onPress={() => confirmDeleteRoom(item)} accessibilityLabel={`Rimuovi ${item.name}`}>
                  <Text style={styles.rowDelete}>🗑</Text>
                </Pressable>
              </View>
            );
          }}
        />
      )}

      <Pressable
        style={styles.fab}
        onPress={() => navigation.navigate('NuovaStanza', { propertyId: id })}
        accessibilityLabel="Aggiungi una stanza"
      >
        <Text style={styles.fabText}>+</Text>
      </Pressable>

      <Pressable style={styles.deletePropertyBtn} onPress={confirmDeleteProperty}>
        <Text style={styles.deletePropertyText}>Elimina proprietà</Text>
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
    empty: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
    emptyIcon: { fontSize: 40, marginBottom: 16 },
    emptyText: { color: theme.muted, textAlign: 'center', fontSize: 15, lineHeight: 22, maxWidth: 280 },
    list: { paddingHorizontal: 20, paddingBottom: 140 },
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
    rowDelete: { fontSize: 18, paddingHorizontal: 6 },
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
    deletePropertyBtn: { position: 'absolute', left: 20, bottom: 44, padding: 8 },
    deletePropertyText: { color: theme.danger, fontSize: 13, fontWeight: '600' },
  });
}
