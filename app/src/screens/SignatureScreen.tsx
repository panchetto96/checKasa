import React, { useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Alert } from 'react-native';
import SignatureCanvas, { SignatureViewRef } from 'react-native-signature-canvas';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTheme, Theme } from '../theme/colors';
import { insertSignature } from '../db/database';
import { saveSignature } from '../lib/signature';
import { newId } from '../lib/id';
import type { RootStackParamList } from '../types/navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'Firma'>;

const WEB_STYLE = `
  .m-signature-pad--footer { display: none; margin: 0; }
  .m-signature-pad--body { border: none; }
  .m-signature-pad { box-shadow: none; border: none; }
  body, html { background-color: #FFFFFF; }
`;

export default function SignatureScreen({ navigation, route }: Props) {
  const theme = useTheme();
  const styles = makeStyles(theme);
  const { sessionId } = route.params;
  const signatureRef = useRef<SignatureViewRef>(null);
  const [saving, setSaving] = useState(false);

  async function handleOK(dataUrl: string) {
    if (saving) return;
    setSaving(true);
    try {
      const uri = await saveSignature(dataUrl);
      await insertSignature({ id: newId(), sessionId, uri, createdAt: new Date().toISOString() });
      navigation.goBack();
    } catch (err) {
      Alert.alert('Errore', 'Non è stato possibile salvare la firma. Riprova.');
    } finally {
      setSaving(false);
    }
  }

  function handleEmpty() {
    Alert.alert('Firma mancante', 'Disegna la firma prima di salvare.');
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Firma</Text>
      <Text style={styles.hint}>Chiedi all'altra parte di firmare qui sotto, con il dito.</Text>

      <View style={styles.canvasWrap}>
        <SignatureCanvas
          ref={signatureRef}
          onOK={handleOK}
          onEmpty={handleEmpty}
          webStyle={WEB_STYLE}
          descriptionText=""
          backgroundColor="#FFFFFF"
          penColor="#000000"
        />
      </View>

      <View style={styles.buttons}>
        <Pressable style={styles.secondaryBtn} onPress={() => signatureRef.current?.clearSignature()}>
          <Text style={styles.secondaryBtnText}>Cancella</Text>
        </Pressable>
        <Pressable
          style={[styles.primaryBtn, saving && styles.primaryBtnDisabled]}
          onPress={() => signatureRef.current?.readSignature()}
          disabled={saving}
        >
          <Text style={styles.primaryBtnText}>{saving ? 'Salvataggio...' : 'Salva firma'}</Text>
        </Pressable>
      </View>

      <Pressable style={styles.cancelBtn} onPress={() => navigation.goBack()}>
        <Text style={styles.cancelBtnText}>Annulla</Text>
      </Pressable>
    </View>
  );
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.bg, padding: 20, paddingTop: 60 },
    title: { fontSize: 22, fontWeight: '700', color: theme.text, marginBottom: 8 },
    hint: { color: theme.muted, fontSize: 13, marginBottom: 16 },
    canvasWrap: {
      flex: 1,
      backgroundColor: '#FFFFFF',
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.line,
      overflow: 'hidden',
      marginBottom: 16,
    },
    buttons: { flexDirection: 'row', gap: 10 },
    secondaryBtn: {
      flex: 1,
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.line,
      borderRadius: 12,
      paddingVertical: 14,
      alignItems: 'center',
    },
    secondaryBtnText: { color: theme.text, fontSize: 14, fontWeight: '600' },
    primaryBtn: {
      flex: 1,
      backgroundColor: theme.accent,
      borderRadius: 12,
      paddingVertical: 14,
      alignItems: 'center',
    },
    primaryBtnDisabled: { opacity: 0.6 },
    primaryBtnText: { color: theme.accentInk, fontSize: 14, fontWeight: '700' },
    cancelBtn: { padding: 14, alignItems: 'center', marginTop: 4 },
    cancelBtnText: { color: theme.muted, fontSize: 14 },
  });
}
