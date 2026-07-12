import React, { useCallback, useState } from 'react';
import { View, Text, Image, FlatList, Pressable, TextInput, StyleSheet, ScrollView, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTheme, Theme } from '../theme/colors';
import {
  getRoom,
  getPhotosForRoom,
  insertPhoto,
  deletePhoto,
  getNoteForRoom,
  upsertNote,
  deleteNoteForRoom,
} from '../db/database';
import { roomTypeInfo } from '../types/property';
import type { Room } from '../types/property';
import type { Photo } from '../types/session';
import { newId } from '../lib/id';
import { savePickedPhoto, deletePhotoFile } from '../lib/photos';
import type { RootStackParamList } from '../types/navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'CatturaStanza'>;

export default function RoomCaptureScreen({ navigation, route }: Props) {
  const theme = useTheme();
  const styles = makeStyles(theme);
  const { sessionId, roomId } = route.params;
  const [room, setRoom] = useState<Room | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [note, setNote] = useState('');
  const [capturing, setCapturing] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const [loadedRoom, loadedPhotos, loadedNote] = await Promise.all([
      getRoom(roomId),
      getPhotosForRoom(sessionId, roomId),
      getNoteForRoom(sessionId, roomId),
    ]);
    setRoom(loadedRoom);
    setPhotos(loadedPhotos);
    setNote(loadedNote?.text ?? '');
  }, [sessionId, roomId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function addPhotoFrom(source: 'camera' | 'library') {
    if (capturing) return;
    setCapturing(true);
    try {
      const permission =
        source === 'camera'
          ? await ImagePicker.requestCameraPermissionsAsync()
          : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          source === 'camera' ? 'Permesso fotocamera necessario' : 'Permesso galleria necessario',
          'CheckCasa ha bisogno di questo permesso per allegare una foto alla documentazione. Puoi attivarlo dalle impostazioni del telefono.'
        );
        return;
      }
      const result =
        source === 'camera'
          ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.7 })
          : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 });
      if (result.canceled || !result.assets[0]) return;
      const uri = await savePickedPhoto(result.assets[0].uri);
      await insertPhoto({ id: newId(), sessionId, roomId, uri, createdAt: new Date().toISOString() });
      await load();
    } catch (err) {
      Alert.alert('Errore', 'Non è stato possibile aggiungere la foto. Riprova.');
    } finally {
      setCapturing(false);
    }
  }

  function confirmDeletePhoto(photo: Photo) {
    Alert.alert('Rimuovi foto', 'Rimuovere questa foto dalla documentazione?', [
      { text: 'Annulla', style: 'cancel' },
      {
        text: 'Rimuovi',
        style: 'destructive',
        onPress: async () => {
          await deletePhoto(photo.id);
          await deletePhotoFile(photo.uri);
          await load();
        },
      },
    ]);
  }

  async function handleDone() {
    if (saving) return;
    setSaving(true);
    try {
      const trimmed = note.trim();
      if (trimmed) {
        await upsertNote({ id: newId(), sessionId, roomId, text: trimmed, createdAt: new Date().toISOString() });
      } else {
        await deleteNoteForRoom(sessionId, roomId);
      }
      navigation.goBack();
    } finally {
      setSaving(false);
    }
  }

  if (!room) {
    return <View style={styles.container} />;
  }

  const info = roomTypeInfo(room.type);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.screenTitle}>
        {info.icon} {room.name}
      </Text>

      <Text style={styles.label}>Foto</Text>
      {photos.length === 0 ? (
        <Text style={styles.hint}>Nessuna foto ancora per questa stanza.</Text>
      ) : (
        <FlatList
          data={photos}
          keyExtractor={(item) => item.id}
          horizontal
          contentContainerStyle={styles.photoList}
          renderItem={({ item }) => (
            <Pressable style={styles.photoThumb} onPress={() => confirmDeletePhoto(item)}>
              <Image source={{ uri: item.uri }} style={styles.photoImage} />
              <Text style={styles.photoRemove}>🗑</Text>
            </Pressable>
          )}
        />
      )}

      <View style={styles.captureButtons}>
        <Pressable
          style={[styles.captureBtn, capturing && styles.captureBtnDisabled]}
          onPress={() => addPhotoFrom('camera')}
          disabled={capturing}
        >
          <Text style={styles.captureBtnText}>📷 Scatta foto</Text>
        </Pressable>
        <Pressable
          style={[styles.captureBtn, capturing && styles.captureBtnDisabled]}
          onPress={() => addPhotoFrom('library')}
          disabled={capturing}
        >
          <Text style={styles.captureBtnText}>🖼 Scegli dalla galleria</Text>
        </Pressable>
      </View>

      <Text style={styles.label}>Nota (facoltativa)</Text>
      <TextInput
        style={styles.textArea}
        placeholder='Es. "graffio sul parquet già presente"'
        placeholderTextColor={theme.muted}
        multiline
        numberOfLines={3}
        value={note}
        onChangeText={setNote}
      />

      <Pressable style={[styles.doneBtn, saving && styles.doneBtnDisabled]} onPress={handleDone} disabled={saving}>
        <Text style={styles.doneBtnText}>{saving ? 'Salvataggio...' : 'Fatto'}</Text>
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
    hint: { color: theme.muted, fontSize: 13 },
    photoList: { gap: 10 },
    photoThumb: { width: 96, height: 96, borderRadius: 10, overflow: 'hidden', position: 'relative' },
    photoImage: { width: '100%', height: '100%' },
    photoRemove: {
      position: 'absolute',
      right: 4,
      top: 4,
      backgroundColor: 'rgba(0,0,0,0.55)',
      color: '#FFFFFF',
      fontSize: 12,
      paddingHorizontal: 4,
      borderRadius: 6,
    },
    captureButtons: { flexDirection: 'row', gap: 10, marginTop: 12 },
    captureBtn: {
      flex: 1,
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.line,
      borderRadius: 12,
      paddingVertical: 14,
      alignItems: 'center',
    },
    captureBtnDisabled: { opacity: 0.6 },
    captureBtnText: { color: theme.text, fontSize: 13, fontWeight: '600' },
    textArea: {
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.line,
      borderRadius: 12,
      padding: 14,
      color: theme.text,
      fontSize: 14,
      textAlignVertical: 'top',
      minHeight: 80,
    },
    doneBtn: {
      backgroundColor: theme.accent,
      borderRadius: 12,
      padding: 16,
      alignItems: 'center',
      marginTop: 32,
    },
    doneBtnDisabled: { opacity: 0.6 },
    doneBtnText: { color: theme.accentInk, fontSize: 16, fontWeight: '700' },
  });
}
