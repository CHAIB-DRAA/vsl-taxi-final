import 'react-native-url-polyfill/auto';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import {
  NavigationContainer,
  DefaultTheme,
  DarkTheme,
  createNavigationContainerRef,
} from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import * as SecureStore from 'expo-secure-store';
import { ActivityIndicator, View, Linking } from 'react-native';
import { DataProvider, useData } from './contexts/DataContext';
import { ThemeProvider, useTheme } from './contexts/ThemeContext';
import GlobalInvitationModal from './components/GlobalInvitationModal';

import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';

// --- IMPORTS DES ÉCRANS ---
import SignInScreen from './screens/SigninScreen';
import SignUpScreen from './screens/SignupScreen';
import MainTabs from './screens/MainTabs';
import ContactScreen from './screens/ContactScreen';
import DocumentsScreen from './screens/DocumentsScreen';

import HistoryScreen from './screens/HistoryScreen';
import PatientsScreen from './screens/PatientsScreen';
import ProfileScreen from './screens/ProfileScreen';
import AddRideScreen from './screens/CreateRideScreen';
import FacturationScreen from './screens/FacturationScreen';
import SettingAppScreen from './screens/SettingAppScreen';
import SettingsScreen from './screens/SettingsScreen';

import api from './services/api';
import { setupNotifications } from './services/notificationService';

export const navigationRef = createNavigationContainerRef();

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

const Stack = createNativeStackNavigator();
const SESSION_KEY = 'user_session';

// --- COMPOSANT DE NAVIGATION PRINCIPAL (Séparé pour utiliser le hook useTheme) ---
const AppNavigator = () => {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  // Counts dérivés de DataContext — plus d'appel API séparé
  const { allRides } = useData();
  const todayString = new Date().toDateString();
  const todayRidesCount = useMemo(() =>
    allRides.filter(r => new Date(r.date).toDateString() === todayString && r.status !== 'Annulée').length,
    [allRides, todayString]
  );
  const webPendingCount = useMemo(() =>
    allRides.filter(r => r.source === 'Web' && r.status === 'En attente').length,
    [allRides]
  );

  // 👇 RÉCUPÉRATION DU THÈME ACTUEL
  const { isDark, colors } = useTheme();

  // 👇 DÉFINITION DES THÈMES DE NAVIGATION
  const MyDarkTheme = {
    ...DarkTheme,
    colors: {
      ...DarkTheme.colors,
      primary: colors.primary, // Orange
      background: colors.background, // Noir/Gris foncé
      card: colors.card, // Gris foncé
      text: colors.text, // Blanc
      border: colors.border,
      notification: colors.danger,
    },
  };

  const MyLightTheme = {
    ...DefaultTheme,
    colors: {
      ...DefaultTheme.colors,
      primary: colors.primary, // Orange
      background: colors.background, // Blanc/Gris clair
      card: colors.card, // Blanc
      text: colors.text, // Noir
      border: colors.border,
      notification: colors.danger,
    },
  };

  // --- NOTIFICATIONS ---
  const registerForPushNotificationsAsync = async () => {
    let token;
    if (Device.isDevice) {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      if (finalStatus !== 'granted') return;
      
      token = (await Notifications.getExpoPushTokenAsync({
        projectId: Constants.expoConfig?.extra?.eas?.projectId,
      })).data;
    }
    return token;
  };

  const sendTokenToBackend = async (token) => {
    try {
      await api.put('/auth/push-token', { pushToken: token });
    } catch (e) {
      // Échec silencieux — non bloquant
    }
  };

  // 1. Session
  useEffect(() => {
    const loadSession = async () => {
      try {
        const savedSession = await SecureStore.getItemAsync(SESSION_KEY);
        if (savedSession) setSession(JSON.parse(savedSession));
      } catch (e) {
        // Session corrompue — on reste déconnecté
      } finally {
        setLoading(false);
      }
    };
    loadSession();
  }, []);

  // 2. Notifs
  useEffect(() => {
    setupNotifications().catch(() => {});
    if (session) {
      registerForPushNotificationsAsync().then(token => {
        if (token) sendTokenToBackend(token);
      });
    }
  }, [session]);

  // Tap sur une notification de départ → ouvre Waze sur l'adresse de prise en charge
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener(async (response) => {
      const data = response.notification.request.content.data;
      if (data?.type === 'departure_alert' && data?.startLocation) {
        const encoded = encodeURIComponent(data.startLocation);
        const wazeNative = `waze://?q=${encoded}&navigate=yes`;
        const wazeWeb   = `https://waze.com/ul?q=${encoded}&navigate=yes`;
        try {
          const canWaze = await Linking.canOpenURL(wazeNative);
          await Linking.openURL(canWaze ? wazeNative : wazeWeb);
        } catch {
          Linking.openURL(wazeWeb).catch(() => {});
        }
      }
      // Ancienne compatibilité
      if (data?.type === 'proximity_alert' && navigationRef.isReady()) {
        navigationRef.navigate('Main');
      }
    });
    return () => sub.remove();
  }, []);

  // 3. Login
  const handleLogin = async (data) => {
    try {
      await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(data));
      setSession(data);
    } catch (e) { /* échec sauvegarde session */ }
  };

  // 4. Logout
  const handleLogout = async () => {
    try {
      await SecureStore.deleteItemAsync(SESSION_KEY);
      await SecureStore.deleteItemAsync('token');
      setSession(null);
    } catch (error) { /* échec suppression session */ }
  };


  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color="#F05A28" />
      </View>
    );
  }

  return (
    // 👇 ICI LA LIAISON DU THÈME NAVIGATION
    <NavigationContainer ref={navigationRef} theme={isDark ? MyDarkTheme : MyLightTheme}>
      <Stack.Navigator screenOptions={{ headerTintColor: '#FF6B00' }}>
        {!session ? (
          <Stack.Group screenOptions={{ headerShown: false }}>
            <Stack.Screen name="SignIn">
              {props => <SignInScreen {...props} onSignIn={handleLogin} />}
            </Stack.Screen>
            <Stack.Screen name="SignUp">
              {props => <SignUpScreen {...props} onSignUp={handleLogin} />}
            </Stack.Screen>
          </Stack.Group>
        ) : (
          <Stack.Group>
            <Stack.Screen name="Main" options={{ headerShown: false }}>
              {props => (
                <MainTabs
                  {...props}
                  todayRidesCount={todayRidesCount}
                  webPendingCount={webPendingCount}
                />
              )}
            </Stack.Screen>
            
            <Stack.Screen 
              name="History" 
              component={HistoryScreen} 
              options={{ title: 'Historique' }} 
            />
            <Stack.Screen 
              name="Patients" 
              component={PatientsScreen} 
              options={{ title: 'Mes Patients' }} 
            />
            <Stack.Screen 
              name="AddRide" 
              component={AddRideScreen} 
              options={{ title: 'Nouvelle Course' }} 
            />
            <Stack.Screen 
              name="Profile" 
              options={{ headerShown: false }} 
            >
              {props => <ProfileScreen {...props} onLogout={handleLogout} />}
            </Stack.Screen>
            <Stack.Screen 
              name="SettingsApp" 
              component={SettingAppScreen} 
              options={{ headerShown: false }} 
            />
            <Stack.Screen 
              name="Facturation" 
              component={FacturationScreen} 
              options={{ title: 'Facturation Auto' }} 
            />
            <Stack.Screen 
              name="Contact" 
              component={ContactScreen} 
              options={{ title: 'Mes Collègues' }} 
            />
            <Stack.Screen 
              name="Documents" 
              component={DocumentsScreen} 
              options={{ title: 'Mes Documents' }} 
            />
            <Stack.Screen name="Settings" options={{ headerShown: false }}>
              {props => <SettingsScreen {...props} onLogout={handleLogout} />}
            </Stack.Screen>
          </Stack.Group>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};

// --- COMPOSANT RACINE (Providers) ---
export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider> 
          <DataProvider>
            {/* On sépare AppNavigator pour qu'il puisse utiliser useTheme() qui est fourni par ThemeProvider juste au-dessus */}
            <AppNavigator />
            <GlobalInvitationModal />
          </DataProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}