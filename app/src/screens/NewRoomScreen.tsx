import React, { useState } from 'react';
import { View, Text, Pressable, TextInput, StyleSheet, ScrollView, Alert } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTheme, Theme } from '../theme/colors';
import { insertRoom } from '../db/database';
import { newId } from '../lib/id';
import { ROOM_TYPES, RoomType } from '../types/property';
import type { RootStackParamList } from '../types/navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'NuovaStanza'>;

export default function NewRoomScreen({ navigation, route }: Props) {
  const theme = useTheme();
  const styles = makeStyles(theme);
  const { propertyId } = route.params;
  const [type, setType] = useState<RoomType>('camera');
  const [name, setName] = useState(ROOM_TYPES[0].label);
  const [nameEdited, setNameEdited] = useState(false);
  const [saving, setSaving] = useState(false);

  function selectType(next: RoomType) {
    setType(next);
    if (!nameEdited) {
      const info = ROOM_TYPES.find((t) => t.value === next);
      setName(next === 'altro' ? '' : info?.label ?? '');
    }
  }

  async function handleSave() {
    if (saving) return;
    const trimmedName = name.trim();
    if (!trimmedName) {
      Alert.alert('Nome mancante', 'Dai un nome a questa stanza (es. "Ripostiglio").');
      return;
    }
    setSaving(true);
    try {
      await insertRoom({
        id: newId(),
        propertyId,
        name: trimmedName,
        type,
        createdAt: new Date().toISOString(),
      });
      navigation.goBack();
    } catch (err) {
      Alert.alert('Errore', 'Non è stato possibile salvare la stanza. Riprova.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.screenTitle}>Nuova stanza</Text>

      <Text style={styles.label}>Tipo</Text>
      <View style={styles.typeGrid}>
        {ROOM_TYPES.map((t) => (
          <Pressable
            key={t.value}
            onPress={() => selectType(t.value)}
            style={[styles.typeChip, type === t.value && styles.typeChipActive]}
          >
            <Text style={styles.typeIcon}>{t.icon}</Text>
            <Text style={[styles.typeLabel, type === t.value && styles.typeLabelActive]}>{t.label}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.label}>Nome stanza</Text>
      <TextInput
        style={styles.input}
        placeholder='Es. "Camera 1"'
        placeholderTextColor={theme.muted}
        value={name}
        onChangeText={(text) => {
          setName(text);
          setNameEdited(true);
        }}
      />

      <Pressable style={[styles.saveBtn, saving && styles.saveBtnDisabled]} onPress={handleSave} disabled={saving}>
        <Text style={styles.saveBtnText}>{saving ? 'Salvataggio...' : 'Salva stanza'}</Text>
      </Pressable>

      <Pressable style={styles.cancelBtn} onPress={() => navigation.goBack()}>
        <Text style={styles.cancelBtnText}>Annulla</Text>
      </Pressable>
    </ScrollView>
  );
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.bg },
    content: { padding: 20, paddingTop: 60, paddingBottom: 60 },
    screenTitle: { fontSize: 22, fontWeight: '700', color: theme.text, marginBottom: 8 },
    label: { color: theme.text, fontSize: 15, fontWeight: '700', marginTop: 24, marginBottom: 10 },
    typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    typeChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.line,
      borderRadius: 999,
      paddingVertical: 10,
      paddingHorizontal: 14,
    },
    typeChipActive: { borderColor: theme.accent, backgroundColor: theme.surface2 },
    typeIcon: { fontSize: 15 },
    typeLabel: { color: theme.muted, fontSize: 13 },
    typeLabelActive: { color: theme.text, fontWeight: '600' },
    input: {
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.line,
      borderRadius: 12,
      padding: 14,
      color: theme.text,
      fontSize: 14,
    },
    saveBtn: { backgroundColor: theme.accent, borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 32 },
    saveBtnDisabled: { opacity: 0.6 },
    saveBtnText: { color: theme.accentInk, fontSize: 16, fontWeight: '700' },
    cancelBtn: { padding: 14, alignItems: 'center', marginTop: 4 },
    cancelBtnText: { color: theme.muted, fontSize: 14 },
  });
}
