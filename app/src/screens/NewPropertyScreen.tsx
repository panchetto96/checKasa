import React, { useState } from 'react';
import { View, Text, Pressable, TextInput, StyleSheet, ScrollView, Alert } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTheme, Theme } from '../theme/colors';
import { insertProperty } from '../db/database';
import { newId } from '../lib/id';
import type { RootStackParamList } from '../types/navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'NuovaProprieta'>;

export default function NewPropertyScreen({ navigation }: Props) {
  const theme = useTheme();
  const styles = makeStyles(theme);
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (saving) return;
    const trimmedName = name.trim();
    if (!trimmedName) {
      Alert.alert(
        'Nome mancante',
        'Dai un nome alla proprietà per riconoscerla facilmente (es. "Casa in affitto - Via Roma").'
      );
      return;
    }
    setSaving(true);
    try {
      await insertProperty({
        id: newId(),
        name: trimmedName,
        address: address.trim() || undefined,
        createdAt: new Date().toISOString(),
      });
      navigation.goBack();
    } catch (err) {
      Alert.alert('Errore', 'Non è stato possibile salvare la proprietà. Riprova.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.screenTitle}>Nuova proprietà</Text>

      <Text style={styles.label}>Nome</Text>
      <TextInput
        style={styles.input}
        placeholder='Es. "Casa in affitto - Via Roma"'
        placeholderTextColor={theme.muted}
        value={name}
        onChangeText={setName}
      />

      <Text style={styles.label}>Indirizzo (facoltativo)</Text>
      <TextInput
        style={styles.input}
        placeholder="Via, città"
        placeholderTextColor={theme.muted}
        value={address}
        onChangeText={setAddress}
      />

      <Pressable style={[styles.saveBtn, saving && styles.saveBtnDisabled]} onPress={handleSave} disabled={saving}>
        <Text style={styles.saveBtnText}>{saving ? 'Salvataggio...' : 'Salva proprietà'}</Text>
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
