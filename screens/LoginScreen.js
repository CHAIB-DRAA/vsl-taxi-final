import React, { useState } from 'react';
import { View, Text, TextInput, Button, Alert, Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';

// ⚠️ Assure-toi que "api" est bien configuré pour ajouter le Token JWT dans les headers
// car la route /user/push-token est protégée !
import api, { loginUser } from '../services/api'; 

// ============================================================
// 🚀 FONCTION DE GÉNÉRATION DU PUSH TOKEN
// ============================================================
async function registerForPushNotificationsAsync() {
  let token;

  // 1. Configuration spéciale pour Android
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
    });
  }

  // 2. Vérification sur appareil physique et demande de permission
  if (Device.isDevice) {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    
    // Si la permission n'a jamais été demandée, on affiche la pop-up
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    
    if (finalStatus !== 'granted') {
      console.log('Permission refusée pour les notifications push !');
      return null;
    }
    
    // 3. Récupération du Token depuis les serveurs d'Expo
    try {
      token = (await Notifications.getExpoPushTokenAsync({
        // Si tu utilises EAS Build, il faudra mettre ton projectId ici plus tard.
        // Exemple : projectId: "ton-id-eas-qui-est-dans-app.json"
      })).data;
    } catch (e) {
      console.error("Erreur lors de la génération du token Expo :", e);
    }
  } else {
    console.log('Les notifications Push nécessitent un appareil physique (pas un simulateur Android/iOS).');
  }

  return token;
}


// ============================================================
// ÉCRAN DE CONNEXION
// ============================================================
export default function LoginScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false); // Petit bonus pour le bouton

  const handleLogin = async () => {
    if (!email || !password) return Alert.alert('Erreur', 'Veuillez remplir tous les champs');
    
    setLoading(true);
    try {
      // 1. On se connecte et on reçoit le JWT
      await loginUser({ email, password });
      
      // 2. On génère le Push Token (Le téléphone va demander l'autorisation si c'est la 1ère fois)
      const pushToken = await registerForPushNotificationsAsync();
      
      // 3. On envoie le Push Token au serveur (Le JWT doit déjà être dans les headers via 'api')
      if (pushToken) {
        try {
          await api.put('/user/push-token', { pushToken });
          console.log("✅ Token Push enregistré sur le serveur :", pushToken);
        } catch (tokenErr) {
          console.error("⚠️ Impossible d'envoyer le Push Token au serveur :", tokenErr);
          // On ne bloque pas la connexion si le token échoue
        }
      }

      // 4. On redirige vers l'Agenda
      navigation.replace('Agenda'); 

    } catch (err) {
      Alert.alert('Erreur', 'Email ou mot de passe invalide');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ padding: 20, flex: 1, justifyContent: 'center' }}>
      <Text style={{ fontSize: 24, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' }}>
        Connexion
      </Text>

      <Text>Email</Text>
      <TextInput 
        value={email} 
        onChangeText={setEmail} 
        keyboardType="email-address"
        autoCapitalize="none"
        style={{ borderWidth: 1, marginBottom: 15, padding: 10, borderRadius: 5, borderColor: '#ccc' }} 
      />

      <Text>Mot de passe</Text>
      <TextInput 
        value={password} 
        onChangeText={setPassword} 
        secureTextEntry 
        style={{ borderWidth: 1, marginBottom: 20, padding: 10, borderRadius: 5, borderColor: '#ccc' }} 
      />

      <View style={{ marginBottom: 10 }}>
        <Button 
          title={loading ? "Connexion en cours..." : "Se connecter"} 
          onPress={handleLogin} 
          disabled={loading}
        />
      </View>
      
      <Button 
        title="Créer un compte" 
        onPress={() => navigation.navigate('Register')} 
        color="#888"
      />
    </View>
  );
}