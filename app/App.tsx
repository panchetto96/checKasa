import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator, useColorScheme } from 'react-native';
import { NavigationContainer, DefaultTheme, DarkTheme, Theme as NavTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { initDatabase } from './src/db/database';
import { useTheme, Theme } from './src/theme/colors';
import type { RootStackParamList } from './src/types/navigation';
import PropertiesScreen from './src/screens/PropertiesScreen';
import NewPropertyScreen from './src/screens/NewPropertyScreen';
import PropertyDetailScreen from './src/screens/PropertyDetailScreen';
import NewRoomScreen from './src/screens/NewRoomScreen';
import SessionScreen from './src/screens/SessionScreen';
import RoomCaptureScreen from './src/screens/RoomCaptureScreen';
import CronologiaScreen from './src/screens/CronologiaScreen';
import RiepilogoSessioneScreen from './src/screens/RiepilogoSessioneScreen';
import SignatureScreen from './src/screens/SignatureScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

function LoadingScreen({ theme, danger }: { theme: Theme; danger?: boolean }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.bg }}>
      <ActivityIndicator color={danger ? theme.danger : theme.accent} />
    </View>
  );
}

function AppNavigator() {
  const theme = useTheme();
  const scheme = useColorScheme();

  const baseNavTheme = scheme === 'light' ? DefaultTheme : DarkTheme;
  const navTheme: NavTheme = {
    ...baseNavTheme,
    colors: {
      ...baseNavTheme.colors,
      background: theme.bg,
      card: theme.surface,
      text: theme.text,
      border: theme.line,
      primary: theme.accent,
    },
  };

  return (
    <NavigationContainer theme={navTheme}>
      <StatusBar style={scheme === 'light' ? 'dark' : 'light'} />
      <Stack.Navigator screenOptions={{ headerShown: false }} initialRouteName="Proprieta">
        <Stack.Screen name="Proprieta" component={PropertiesScreen} />
        <Stack.Screen name="NuovaProprieta" component={NewPropertyScreen} options={{ presentation: 'modal' }} />
        <Stack.Screen name="DettaglioProprieta" component={PropertyDetailScreen} />
        <Stack.Screen name="NuovaStanza" component={NewRoomScreen} options={{ presentation: 'modal' }} />
        <Stack.Screen name="Sessione" component={SessionScreen} />
        <Stack.Screen name="CatturaStanza" component={RoomCaptureScreen} />
        <Stack.Screen name="Cronologia" component={CronologiaScreen} />
        <Stack.Screen name="RiepilogoSessione" component={RiepilogoSessioneScreen} />
        <Stack.Screen name="Firma" component={SignatureScreen} options={{ presentation: 'modal' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  const [ready, setReady] = useState(false);
  const [dbError, setDbError] = useState<string | null>(null);
  const theme = useTheme();

  useEffect(() => {
    initDatabase()
      .catch((err) => setDbError(String(err)))
      .finally(() => setReady(true));
  }, []);

  if (!ready) {
    return <LoadingScreen theme={theme} />;
  }

  if (dbError) {
    return <LoadingScreen theme={theme} danger />;
  }

  return <AppNavigator />;
}
